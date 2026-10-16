import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { sendEmailVerification } from 'firebase/auth';
import { AuthService } from '../../../core/services/auth.service';
import { FORO_CATEGORIAS, ForoCategoria, ForoEstado, ForoService, foroError } from '../../../core/services/foro.service';
import { trackEvent } from '../../../core/utils/tracking';
import { environment } from '../../../../environments/environment';

/**
 * Formulario para preguntar o responder en el foro. Muestra lo que haga falta según la cuenta:
 * invitación a entrar, aviso de verificar el correo o el formulario.
 */
@Component({
  selector: 'app-foro-composer',
  imports: [FormsModule, RouterLink],
  templateUrl: './foro-composer.html',
  styleUrl: './foro-composer.scss',
})
export class ForoComposer {
  private readonly auth = inject(AuthService);
  private readonly foro = inject(ForoService);
  private readonly router = inject(Router);

  readonly modo = input<'hilo' | 'respuesta'>('hilo');
  readonly hiloId = input('');
  readonly enviado = output<ForoEstado>();
  readonly cancelar = output<void>();

  readonly categorias = FORO_CATEGORIAS;
  readonly user = this.auth.currentUser;
  /** Se actualiza al pulsar "Ya verifiqué" (Firebase no avisa solo cuando se verifica el correo). */
  private readonly verificadoManual = signal(false);
  readonly verificado = computed(() => this.verificadoManual() || !!this.user()?.emailVerified || this.esEquipo());
  readonly esEquipo = computed(() => {
    const email = this.user()?.email;
    return !!email && environment.adminEmails.includes(email);
  });

  readonly returnUrl = computed(() => this.router.url.split('?')[0]);

  categoria = signal<ForoCategoria | ''>('');
  titulo = signal('');
  cuerpo = signal('');
  anonimo = signal(false);
  aceptaNormas = signal(false);
  sitioWeb = '';

  private inicio = 0;
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly resultado = signal<ForoEstado | null>(null);

  readonly maxCuerpo = computed(() => (this.modo() === 'hilo' ? 4000 : 2000));
  readonly listo = computed(() => {
    const cuerpoOk = this.cuerpo().trim().length >= (this.modo() === 'hilo' ? 20 : 2);
    if (this.modo() === 'respuesta') return cuerpoOk && this.aceptaNormas();
    return cuerpoOk && this.titulo().trim().length >= 8 && !!this.categoria() && this.aceptaNormas();
  });

  /** El reloj anti-bots arranca con la primera interacción. */
  empezar(): void {
    if (!this.inicio) this.inicio = Date.now();
  }

  async enviar(): Promise<void> {
    if (!this.listo() || this.enviando()) return;
    this.enviando.set(true);
    this.error.set('');
    const payload = {
      titulo: this.titulo().trim(),
      cuerpo: this.cuerpo().trim(),
      categoria: (this.categoria() || 'otro') as ForoCategoria,
      anonimo: this.anonimo(),
      sitioWeb: this.sitioWeb,
      tiempoMs: this.inicio ? Date.now() - this.inicio : 0,
    };
    try {
      const res =
        this.modo() === 'hilo' ? await this.foro.crearHilo(payload) : await this.foro.responder(this.hiloId(), payload);
      trackEvent(this.modo() === 'hilo' ? 'foro_pregunta' : 'foro_respuesta', { method: payload.categoria });
      this.resultado.set(res.estado);
      this.titulo.set('');
      this.cuerpo.set('');
      this.aceptaNormas.set(false);
      this.inicio = 0;
      this.enviado.emit(res.estado);
    } catch (error) {
      this.error.set(foroError(error, 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.'));
    } finally {
      this.enviando.set(false);
    }
  }

  otraVez(): void {
    this.resultado.set(null);
  }

  async reenviarVerificacion(): Promise<void> {
    const user = this.user();
    if (!user) return;
    try {
      await sendEmailVerification(user);
      this.aviso.set(`Te enviamos un nuevo correo a ${user.email}.`);
    } catch {
      this.aviso.set('Ya te enviamos un correo hace poco; espera unos minutos e intenta de nuevo.');
    }
  }

  async yaVerifique(): Promise<void> {
    const user = this.user();
    if (!user) return;
    await user.reload();
    if (user.emailVerified) {
      await user.getIdToken(true); // token nuevo con email_verified para el servidor
      this.verificadoManual.set(true);
      this.aviso.set('');
    } else {
      this.aviso.set('Todavía no aparece verificado. Abre el enlace del correo y vuelve a intentar.');
    }
  }
}
