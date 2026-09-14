import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService, Banner } from '../../../core/services/api.service';

@Component({
  selector: 'app-main-banner',
  templateUrl: './main-banner.html',
  styleUrl: './main-banner.scss',
})
export class MainBanner implements OnInit {
  private readonly api = inject(ApiService);

  readonly banner = signal<Banner | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const banner = await this.api.getBanner();
      this.banner.set(banner);
      if (banner) {
        console.log('✅ Banner cargado:', banner);
      } else {
        console.warn('⚠️ No hay banner activo disponible.');
      }
    } catch (error) {
      console.error('❌ Error cargando banner:', error);
    }
  }
}
