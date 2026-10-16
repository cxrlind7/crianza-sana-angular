import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  FORO_CATEGORIAS,
  ForoCategoria,
  ForoHilo,
  ForoService,
  MiPublicacion,
  categoriaMeta,
} from '../../core/services/foro.service';
import { ForoComposer } from './foro-composer/foro-composer';
import { haceCuanto, iniciales } from './foro-utils';
import { trackSearch } from '../../core/utils/tracking';

type Orden = 'recientes' | 'respondidos' | 'sin-respuesta';

@Component({
  selector: 'app-foro',
  imports: [FormsModule, RouterLink, ForoComposer],
  templateUrl: './foro.html',
  styleUrl: './foro.scss',
})
export class Foro implements OnInit {
  private readonly foro = inject(ForoService);
  private readonly auth = inject(AuthService);

  readonly categorias = FORO_CATEGORIAS;
  readonly categoriaMeta = categoriaMeta;
  readonly haceCuanto = haceCuanto;
  readonly iniciales = iniciales;
  readonly user = this.auth.currentUser;

  readonly hilos = signal<ForoHilo[]>([]);
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly categoria = signal<ForoCategoria | null>(null);
  readonly busqueda = signal('');
  readonly orden = signal<Orden>('recientes');
  readonly mostrarComposer = signal(false);
  readonly misPublicaciones = signal<MiPublicacion[]>([]);

  readonly totalRespuestas = computed(() => this.hilos().reduce((n, h) => n + h.respuestas, 0));

  readonly visibles = computed(() => {
    const q = this.busqueda()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
    const cat = this.categoria();
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    let lista = this.hilos().filter(
      (h) => (!cat || h.categoria === cat) && (!q || norm(`${h.titulo} ${h.cuerpo}`).includes(q)),
    );
    if (this.orden() === 'respondidos') lista = [...lista].sort((a, b) => b.respuestas - a.respuestas);
    if (this.orden() === 'sin-respuesta') lista = lista.filter((h) => h.respuestas === 0);
    // Los fijados siempre arriba.
    return [...lista].sort((a, b) => Number(b.fijado) - Number(a.fijado));
  });

  readonly conteoPorCategoria = computed(() => {
    const conteo = new Map<string, number>();
    for (const h of this.hilos()) conteo.set(h.categoria, (conteo.get(h.categoria) ?? 0) + 1);
    return conteo;
  });

  readonly enRevision = computed(() => this.misPublicaciones().filter((p) => p.estado !== 'aprobado'));

  constructor() {
    // La sesión de Firebase puede restaurarse después de crear el componente.
    effect(() => {
      if (this.user()) untracked(() => this.cargarMisPublicaciones());
      else this.misPublicaciones.set([]);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      this.hilos.set(await this.foro.getHilos());
    } catch {
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarMisPublicaciones(): Promise<void> {
    try {
      this.misPublicaciones.set(await this.foro.misPublicaciones());
    } catch {
      this.misPublicaciones.set([]);
    }
  }

  buscar(texto: string): void {
    this.busqueda.set(texto);
    trackSearch(texto, 'foro');
  }

  toggleCategoria(key: ForoCategoria): void {
    this.categoria.set(this.categoria() === key ? null : key);
  }

  abrirComposer(): void {
    this.mostrarComposer.set(true);
    setTimeout(() => document.getElementById('foro-composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  onEnviado(): void {
    this.cargarMisPublicaciones();
    this.cargar();
  }

  extracto(texto: string): string {
    return texto.length > 170 ? `${texto.slice(0, 170).trimEnd()}…` : texto;
  }

  estadoLabel(p: MiPublicacion): string {
    return p.estado === 'pendiente' ? 'En revisión' : p.estado === 'rechazado' ? 'No publicada' : 'Publicada';
  }
}
