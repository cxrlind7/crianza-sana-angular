import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { getAuthErrorMessage, isValidEmail } from '../../core/utils/auth-errors';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Página a la que se regresa al entrar (p. ej. el foro). Solo rutas internas. */
  private readonly returnUrl = (() => {
    const url = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    return url.startsWith('/') && !url.startsWith('//') ? url : '/';
  })();

  name = '';
  email = '';
  password = '';
  readonly isSignup = signal(this.route.snapshot.queryParamMap.has('registro'));
  readonly showPassword = signal(false);
  readonly errorMessage = signal('');
  readonly isSubmitting = signal(false);

  toggleForm(): void {
    this.isSignup.update((v) => !v);
    this.errorMessage.set('');
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  async handleRegister(): Promise<void> {
    this.errorMessage.set('');

    if (!this.name.trim() || !this.email || !this.password) {
      this.errorMessage.set('Por favor, completa todos los campos.');
      return;
    }
    if (!isValidEmail(this.email)) {
      this.errorMessage.set('Correo no válido.');
      return;
    }
    if (this.password.length < 6) {
      this.errorMessage.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.isSubmitting.set(true);
    try {
      await this.authService.register(this.email.trim(), this.password, this.name.trim());
      alert('✅ Registro exitoso. Revisa tu correo para verificar tu cuenta.');
      this.router.navigateByUrl(this.returnUrl);
    } catch (error) {
      console.error(error);
      this.errorMessage.set(getAuthErrorMessage(error, 'register'));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async handleLogin(): Promise<void> {
    this.errorMessage.set('');
    if (!this.email || !this.password) {
      this.errorMessage.set('Debes ingresar tu correo y contraseña.');
      return;
    }
    if (!isValidEmail(this.email)) {
      this.errorMessage.set('Correo no válido.');
      return;
    }

    this.isSubmitting.set(true);
    try {
      await this.authService.login(this.email.trim(), this.password);
      this.router.navigateByUrl(this.returnUrl);
    } catch (error) {
      console.error(error);
      this.errorMessage.set(getAuthErrorMessage(error, 'login'));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
