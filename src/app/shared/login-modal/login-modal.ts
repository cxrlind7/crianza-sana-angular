import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { getAuthErrorMessage, isValidEmail } from '../../core/utils/auth-errors';

@Component({
  selector: 'app-login-modal',
  imports: [FormsModule],
  templateUrl: './login-modal.html',
  styleUrl: './login-modal.scss',
})
export class LoginModal {
  private readonly authService = inject(AuthService);

  @Output() close = new EventEmitter<void>();

  name = '';
  email = '';
  password = '';
  readonly isSignup = signal(false);
  readonly showPassword = signal(false);
  readonly errorMessage = signal('');

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

    try {
      await this.authService.register(this.email.trim(), this.password, this.name.trim());
      alert('✅ Registro exitoso. Revisa tu correo para verificar tu cuenta.');
      this.close.emit();
    } catch (error) {
      console.error(error);
      this.errorMessage.set(getAuthErrorMessage(error, 'register'));
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

    try {
      await this.authService.login(this.email.trim(), this.password);
      this.close.emit();
    } catch (error) {
      console.error(error);
      this.errorMessage.set(getAuthErrorMessage(error, 'login'));
    }
  }
}
