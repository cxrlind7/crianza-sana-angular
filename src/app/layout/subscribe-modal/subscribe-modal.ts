import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

const STORAGE_KEY = 'csdkids_subscribe_dismissed';

@Component({
  selector: 'app-subscribe-modal',
  imports: [FormsModule],
  templateUrl: './subscribe-modal.html',
  styleUrl: './subscribe-modal.scss',
})
export class SubscribeModal implements OnInit {
  private readonly api = inject(ApiService);

  readonly visible = signal(false);
  email = '';
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly errorMsg = signal('');

  ngOnInit(): void {
    const alreadySeen = localStorage.getItem(STORAGE_KEY);
    if (!alreadySeen) {
      setTimeout(() => {
        this.visible.set(true);
      }, 4000);
    }
  }

  dismiss(): void {
    this.visible.set(false);
    localStorage.setItem(STORAGE_KEY, '1');
  }

  async subscribe(): Promise<void> {
    this.errorMsg.set('');
    if (!this.email || !this.email.includes('@')) {
      this.errorMsg.set('Por favor ingresa un correo válido.');
      return;
    }
    this.loading.set(true);
    try {
      const result = await this.api.subscribeEmail(this.email);
      if (result.success) {
        this.submitted.set(true);
        localStorage.setItem(STORAGE_KEY, '1');
      } else if (result.alreadyExists) {
        this.errorMsg.set('¡Ya estás suscrito/a con ese correo!');
      } else {
        this.errorMsg.set(result.error || 'Ocurrió un error. Intente de nuevo.');
      }
    } catch {
      this.errorMsg.set('Ocurrió un error. Intente de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
