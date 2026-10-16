import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ForoCategoria = 'sueno' | 'alimentacion' | 'emociones' | 'desarrollo' | 'salud' | 'escuela' | 'familia' | 'otro';
export type ForoEstado = 'pendiente' | 'aprobado' | 'rechazado';

export const FORO_CATEGORIAS: { key: ForoCategoria; label: string; icon: string; color: string }[] = [
  { key: 'sueno', label: 'Sueño', icon: 'fas fa-moon', color: '#6366f1' },
  { key: 'alimentacion', label: 'Alimentación y lactancia', icon: 'fas fa-apple-alt', color: '#16a34a' },
  { key: 'emociones', label: 'Conducta y emociones', icon: 'fas fa-heart', color: '#e11d48' },
  { key: 'desarrollo', label: 'Desarrollo y lenguaje', icon: 'fas fa-puzzle-piece', color: '#0891b2' },
  { key: 'salud', label: 'Salud', icon: 'fas fa-stethoscope', color: '#dc2626' },
  { key: 'escuela', label: 'Escuela y aprendizaje', icon: 'fas fa-book-open', color: '#d97706' },
  { key: 'familia', label: 'Crianza en familia', icon: 'fas fa-home', color: '#7c3aed' },
  { key: 'otro', label: 'Otro tema', icon: 'fas fa-comments', color: '#64748b' },
];

export function categoriaMeta(key: string | undefined) {
  return FORO_CATEGORIAS.find((c) => c.key === key) ?? FORO_CATEGORIAS[FORO_CATEGORIAS.length - 1];
}

export interface ForoAutor {
  nombre: string;
  foto: string;
  rol: 'padre' | 'equipo';
}

export interface ForoHilo {
  id: string;
  titulo: string;
  cuerpo: string;
  categoria: ForoCategoria;
  autor: ForoAutor;
  creadoEn: string;
  ultimaActividad: string;
  respuestas: number;
  respondidoPorEquipo: boolean;
  fijado: boolean;
  cerrado: boolean;
}

export interface ForoRespuesta {
  id: string;
  hiloId: string;
  cuerpo: string;
  autor: ForoAutor;
  creadoEn: string;
}

export interface MiPublicacion {
  tipo: 'hilo' | 'respuesta';
  id: string;
  hiloId: string;
  titulo: string;
  estado: ForoEstado;
  motivo: string;
  creadoEn: string;
}

/** Elemento en la bandeja de moderación (incluye datos privados del autor). */
export interface ForoModeracionItem {
  tipo: 'hilo' | 'respuesta' | 'comentario';
  /** Solo comentarios: ruta en Firestore, enlace y de dónde viene (blog, programa o foto). */
  ruta?: string;
  enlace?: string;
  origen?: 'blog' | 'programa' | 'foto';
  id: string;
  titulo?: string;
  hiloId?: string;
  hiloTitulo?: string;
  cuerpo: string;
  categoria?: ForoCategoria;
  autor: ForoAutor & { uid: string; email: string; anonimo?: boolean };
  estado: ForoEstado;
  alertas?: string[];
  reportes?: number;
  motivo?: string;
  fijado?: boolean;
  cerrado?: boolean;
  respuestas?: number;
  creadoEn: string;
}

export interface ForoModeracion {
  hilos: ForoModeracionItem[];
  respuestas: ForoModeracionItem[];
  comentarios: ForoModeracionItem[];
  reportados: ForoModeracionItem[];
  bloqueados: { uid: string; nombre: string; email: string }[];
  totalPendientes: number;
}

export interface PublicarPayload {
  titulo?: string;
  cuerpo: string;
  categoria?: ForoCategoria;
  anonimo: boolean;
  /** Honeypot: va oculto; si trae algo, es un bot. */
  sitioWeb: string;
  /** Tiempo que tardó en llenar el formulario. */
  tiempoMs: number;
}

export type ForoAccion = 'aprobar' | 'rechazar' | 'eliminar' | 'fijar' | 'desfijar' | 'cerrar' | 'abrir' | 'descartar-reportes';

/** Mensaje de error del servidor o uno genérico. */
export function foroError(error: unknown, fallback: string): string {
  return (error instanceof HttpErrorResponse && error.error?.error) || fallback;
}

@Injectable({ providedIn: 'root' })
export class ForoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.backendUrl}/api/foro`;

  getHilos(): Promise<ForoHilo[]> {
    return firstValueFrom(this.http.get<ForoHilo[]>(`${this.api}/hilos`));
  }

  getHilo(id: string): Promise<{ hilo: ForoHilo; respuestas: ForoRespuesta[] }> {
    return firstValueFrom(this.http.get<{ hilo: ForoHilo; respuestas: ForoRespuesta[] }>(`${this.api}/hilos/${id}`));
  }

  crearHilo(data: PublicarPayload): Promise<{ id: string | null; estado: ForoEstado }> {
    return firstValueFrom(this.http.post<{ id: string | null; estado: ForoEstado }>(`${this.api}/hilos`, data));
  }

  responder(hiloId: string, data: PublicarPayload): Promise<{ id: string | null; estado: ForoEstado }> {
    return firstValueFrom(this.http.post<{ id: string | null; estado: ForoEstado }>(`${this.api}/hilos/${hiloId}/respuestas`, data));
  }

  misPublicaciones(): Promise<MiPublicacion[]> {
    return firstValueFrom(this.http.get<MiPublicacion[]>(`${this.api}/mis-publicaciones`));
  }

  reportar(tipo: 'hilo' | 'respuesta', id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.api}/reportar`, { tipo, id }));
  }

  // ---------------------------------------------------------------- Admin

  getModeracion(estado: ForoEstado): Promise<ForoModeracion> {
    return firstValueFrom(this.http.get<ForoModeracion>(`${this.api}/admin/moderacion`, { params: { estado } }));
  }

  async pendientesTotal(): Promise<number> {
    try {
      return (await firstValueFrom(this.http.get<{ total: number }>(`${this.api}/admin/pendientes-total`))).total;
    } catch {
      return 0;
    }
  }

  moderar(item: Pick<ForoModeracionItem, 'tipo' | 'id' | 'ruta'>, accion: ForoAccion, motivo = ''): Promise<unknown> {
    const { tipo, id, ruta } = item;
    return firstValueFrom(this.http.post(`${this.api}/admin/moderar`, { tipo, id, ruta, accion, motivo }));
  }

  bloquear(uid: string, bloqueado: boolean): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.api}/admin/bloquear`, { uid, bloqueado }));
  }
}
