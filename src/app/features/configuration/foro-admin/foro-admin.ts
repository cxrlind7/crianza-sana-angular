import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ForoAccion,
  ForoEstado,
  ForoModeracion,
  ForoModeracionItem,
  ForoService,
  categoriaMeta,
  foroError,
} from '../../../core/services/foro.service';

type Pestana = 'pendiente' | 'reportados' | 'aprobado' | 'rechazado' | 'bloqueados';

const MOTIVOS = [
  'Contiene publicidad o enlaces no permitidos',
  'Comparte datos personales de menores',
  'Lenguaje ofensivo o falta de respeto',
  'No es un tema del foro',
  'Está repetida',
];

@Component({
  selector: 'app-foro-admin',
  imports: [FormsModule],
  templateUrl: './foro-admin.html',
  styleUrl: './foro-admin.scss',
})
export class ForoAdmin implements OnInit {
  private readonly foro = inject(ForoService);

  /** Avisa a Configuración cuántos pendientes quedan (para el contador del menú). */
  readonly pendientes = output<number>();

  readonly categoriaMeta = categoriaMeta;
  readonly motivos = MOTIVOS;

  readonly pestana = signal<Pestana>('pendiente');
  readonly datos = signal<ForoModeracion | null>(null);
  readonly cargando = signal(true);
  readonly mensaje = signal<{ tipo: 'success' | 'danger'; texto: string } | null>(null);
  readonly ocupado = signal<string | null>(null);
  /** Elemento con el formulario de rechazo abierto. */
  readonly rechazando = signal<string | null>(null);
  motivo = '';

  readonly items = computed<ForoModeracionItem[]>(() => {
    const d = this.datos();
    if (!d) return [];
    if (this.pestana() === 'reportados') return d.reportados;
    return [...d.hilos, ...d.respuestas, ...(d.comentarios ?? [])].sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cambiar(p: Pestana): Promise<void> {
    this.pestana.set(p);
    this.rechazando.set(null);
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    const p = this.pestana();
    const estado: ForoEstado = p === 'aprobado' || p === 'rechazado' ? p : p === 'reportados' || p === 'bloqueados' ? 'aprobado' : 'pendiente';
    try {
      const d = await this.foro.getModeracion(estado);
      this.datos.set(d);
      this.pendientes.emit(d.totalPendientes);
    } catch (error) {
      this.mensaje.set({ tipo: 'danger', texto: foroError(error, 'No se pudo cargar el foro.') });
    } finally {
      this.cargando.set(false);
    }
  }

  async accion(item: ForoModeracionItem, accion: ForoAccion, motivo = ''): Promise<void> {
    const confirmacion =
      item.tipo === 'hilo' ? '¿Eliminar esta pregunta y todas sus respuestas? No se puede deshacer.' : `¿Eliminar este ${this.tipoLabel(item).toLowerCase()}? No se puede deshacer.`;
    if (accion === 'eliminar' && !confirm(confirmacion)) return;
    this.ocupado.set(item.id);
    try {
      await this.foro.moderar(item, accion, motivo);
      this.rechazando.set(null);
      this.mensaje.set({ tipo: 'success', texto: this.textoExito(accion) });
      await this.cargar();
    } catch (error) {
      this.mensaje.set({ tipo: 'danger', texto: foroError(error, 'No se pudo aplicar la acción.') });
    } finally {
      this.ocupado.set(null);
    }
  }

  abrirRechazo(item: ForoModeracionItem): void {
    this.motivo = MOTIVOS[0];
    this.rechazando.set(item.id);
  }

  async bloquear(uid: string, nombre: string, bloqueado: boolean): Promise<void> {
    const texto = bloqueado
      ? `¿Bloquear a ${nombre}? Ya no podrá publicar en el foro (lo ya publicado no se borra).`
      : `¿Desbloquear a ${nombre}?`;
    if (!confirm(texto)) return;
    try {
      await this.foro.bloquear(uid, bloqueado);
      this.mensaje.set({ tipo: 'success', texto: bloqueado ? 'Cuenta bloqueada.' : 'Cuenta desbloqueada.' });
      await this.cargar();
    } catch (error) {
      this.mensaje.set({ tipo: 'danger', texto: foroError(error, 'No se pudo actualizar la cuenta.') });
    }
  }

  tipoLabel(item: ForoModeracionItem): string {
    if (item.tipo === 'hilo') return 'Pregunta';
    if (item.tipo === 'respuesta') return 'Respuesta';
    return item.origen === 'programa' ? 'Comentario en programa' : item.origen === 'foto' ? 'Comentario en foto' : 'Comentario en blog';
  }

  enlace(item: ForoModeracionItem): string {
    if (item.tipo === 'comentario') return item.enlace || '/';
    return '/foro/' + (item.tipo === 'hilo' ? item.id : item.hiloId);
  }

  fecha(iso: string): string {
    return iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }

  private textoExito(accion: ForoAccion): string {
    const textos: Record<ForoAccion, string> = {
      aprobar: 'Publicado en el foro.',
      rechazar: 'Rechazado. La persona verá el motivo en "Mis publicaciones".',
      eliminar: 'Eliminado.',
      fijar: 'Pregunta fijada arriba del foro.',
      desfijar: 'Pregunta desfijada.',
      cerrar: 'Conversación cerrada.',
      abrir: 'Conversación abierta de nuevo.',
      'descartar-reportes': 'Reportes descartados.',
    };
    return textos[accion];
  }
}
