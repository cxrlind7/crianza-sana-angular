import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ForoHilo, ForoRespuesta, ForoService, categoriaMeta, foroError } from '../../../core/services/foro.service';
import { trackEvent, withShareUtm } from '../../../core/utils/tracking';
import { ForoComposer } from '../foro-composer/foro-composer';
import { haceCuanto, iniciales } from '../foro-utils';

@Component({
  selector: 'app-foro-hilo',
  imports: [RouterLink, ForoComposer],
  templateUrl: './foro-hilo.html',
  styleUrl: './foro-hilo.scss',
})
export class ForoHiloPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly foro = inject(ForoService);
  private readonly auth = inject(AuthService);

  readonly categoriaMeta = categoriaMeta;
  readonly haceCuanto = haceCuanto;
  readonly iniciales = iniciales;
  readonly user = this.auth.currentUser;

  readonly hilo = signal<ForoHilo | null>(null);
  readonly respuestas = signal<ForoRespuesta[]>([]);
  readonly cargando = signal(true);
  readonly noExiste = signal(false);
  readonly reportados = signal<Set<string>>(new Set());
  readonly aviso = signal('');

  private get id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  async ngOnInit(): Promise<void> {
    try {
      const { hilo, respuestas } = await this.foro.getHilo(this.id);
      this.hilo.set(hilo);
      this.respuestas.set(respuestas);
      document.title = `${hilo.titulo} · Foro para padres`;
    } catch {
      this.noExiste.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  async reportar(tipo: 'hilo' | 'respuesta', id: string): Promise<void> {
    if (!this.user()) {
      this.flash('Inicia sesión para reportar un mensaje.');
      return;
    }
    if (!confirm('¿Reportar este mensaje al equipo para que lo revise?')) return;
    try {
      await this.foro.reportar(tipo, id);
      this.reportados.update((s) => new Set(s).add(id));
      this.flash('Gracias, el equipo lo revisará.');
    } catch (error) {
      this.flash(foroError(error, 'No se pudo enviar el reporte.'));
    }
  }

  async compartir(): Promise<void> {
    const hilo = this.hilo();
    if (!hilo) return;
    const url = withShareUtm(location.href.split('?')[0]);
    trackEvent('compartir', { method: 'foro', link_text: hilo.titulo.slice(0, 100) });
    if (navigator.share) {
      try {
        await navigator.share({ title: hilo.titulo, url });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      this.flash('¡Enlace copiado!');
    } catch {
      this.flash(url);
    }
  }

  private flash(texto: string): void {
    this.aviso.set(texto);
    setTimeout(() => this.aviso.set(''), 3500);
  }
}
