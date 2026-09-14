import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

interface FirebaseAuthError {
  code?: string;
  message: string;
}

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

    if (!this.name || !this.email || !this.password) {
      this.errorMessage.set('Por favor, completa todos los campos.');
      return;
    }

    try {
      await this.authService.register(this.email, this.password, this.name);
      alert('✅ Registro exitoso. Revisa tu correo para verificar tu cuenta.');
      this.close.emit();
    } catch (error) {
      const err = error as FirebaseAuthError;
      console.error(err.message);
      if (err.code === 'auth/email-already-in-use') {
        this.errorMessage.set('Este correo ya está en uso.');
      } else if (err.code === 'auth/invalid-email') {
        this.errorMessage.set('Correo no válido.');
      } else if (err.code === 'auth/weak-password') {
        this.errorMessage.set('La contraseña es muy débil. Usa al menos 6 caracteres.');
      } else {
        this.errorMessage.set('❌ Error registrando usuario.');
      }
    }
  }

  async handleLogin(): Promise<void> {
    this.errorMessage.set('');
    if (!this.email || !this.password) {
      this.errorMessage.set('Debes ingresar tu correo y contraseña.');
      return;
    }

    try {
      await this.authService.login(this.email, this.password);
      alert('✅ Inicio de sesión exitoso');
      this.close.emit();
    } catch (error) {
      const err = error as FirebaseAuthError;
      console.error(err.message);
      if (err.code === 'auth/user-not-found') {
        this.errorMessage.set('Usuario no encontrado.');
      } else if (err.code === 'auth/wrong-password') {
        this.errorMessage.set('Contraseña incorrecta.');
      } else if (err.code === 'auth/invalid-email') {
        this.errorMessage.set('Correo no válido.');
      } else if (err.code === 'auth/invalid-credential') {
        this.errorMessage.set('Correo o contraseña inválidos.');
      } else {
        this.errorMessage.set('❌ Error iniciando sesión.');
      }
    }
  }
}
