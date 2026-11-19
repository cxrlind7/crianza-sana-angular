import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AwsService } from '../../../core/services/aws.service';

interface Importacion {
  id: string;
  fbUrl: string;
  flyerUrl: string;
  estado: 'pendiente' | 'procesando' | 'publicado' | 'error';
  paso?: string;
  error?: string;
  fecha?: string;
  temas?: { titulo: string; especialista: string; inicio: number | null }[];
  procesarDesde?: { _seconds: number };
}

const ESTADOS: Record<Importacion['estado'], { label: string; clase: string }> = {
  pendiente: { label: 'En espera', clase: 'bg-secondary' },
  procesando: { label: 'Procesando', clase: 'bg-primary' },
  publicado: { label: 'Publicado', clase: 'bg-success' },
  error: { label: 'Error', clase: 'bg-danger' },
};

/**
 * Importa el live de Facebook de cada lunes: se pega el enlace y se sube el flyer.
 * El servidor lo procesa por la noche (21:00) y publica los dos temas con sus portadas.
 */
@Component({
  selector: 'app-importar-live',
  imports: [FormsModule, DatePipe],
  templateUrl: './importar-live.html',
  styleUrl: './importar-live.scss',
})
export class ImportarLive implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly aws = inject(AwsService);
  private readonly baseUrl = environment.backendUrl;
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly estados = ESTADOS;
  readonly fbUrl = signal('');
  readonly flyer = signal<File | null>(null);
  readonly enviando = signal(false);
  readonly mensaje = signal<{ kind: 'success' | 'danger'; text: string } | null>(null);
  readonly importaciones = signal<Importacion[]>([]);

  ngOnInit(): void {
    this.cargar();
    this.timer = setInterval(() => {
      if (this.importaciones().some((i) => i.estado === 'procesando')) this.cargar();
    }, 15000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async cargar(): Promise<void> {
    try {
      this.importaciones.set(await firstValueFrom(this.http.get<Importacion[]>(`${this.baseUrl}/api/importaciones-live`)));
    } catch (error) {
      console.error('❌ Error cargando importaciones:', error);
    }
  }

  onFlyer(event: Event): void {
    this.flyer.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  async enviar(procesarAhora: boolean): Promise<void> {
    const file = this.flyer();
    if (!this.fbUrl().trim() || !file) return;
    this.enviando.set(true);
    this.mensaje.set(null);
    try {
      const flyerUrl = await this.aws.uploadFile(file, 'programas/flyers');
      if (!flyerUrl) throw new Error('No se pudo subir el flyer');
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/importaciones-live`, { fbUrl: this.fbUrl().trim(), flyerUrl, procesarAhora }),
      );
      this.fbUrl.set('');
      this.flyer.set(null);
      this.mensaje.set({
        kind: 'success',
        text: procesarAhora ? 'Listo, se está procesando.' : 'Listo, se procesa a las 9:00 p. m.',
      });
      await this.cargar();
    } catch (error: unknown) {
      const e = error as { error?: { error?: string }; message?: string };
      this.mensaje.set({ kind: 'danger', text: e.error?.error || e.message || 'No se pudo guardar' });
    } finally {
      this.enviando.set(false);
    }
  }

  async procesar(item: Importacion): Promise<void> {
    await firstValueFrom(this.http.post(`${this.baseUrl}/api/importaciones-live/${item.id}/procesar`, {}));
    await this.cargar();
  }

  async borrar(item: Importacion): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/api/importaciones-live/${item.id}`));
    await this.cargar();
  }

  fechaDe(ts?: { _seconds: number }): Date | null {
    return ts ? new Date(ts._seconds * 1000) : null;
  }

  minuto(seg: number | null): string {
    if (!seg) return '0:00';
    return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  }
}
