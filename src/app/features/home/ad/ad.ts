import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService, Ad as AdModel } from '../../../core/services/api.service';

@Component({
  selector: 'app-ad',
  templateUrl: './ad.html',
  styleUrl: './ad.scss',
})
export class Ad implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);

  readonly isMobile = signal(false);
  readonly isMobileExpanded = signal(false);
  readonly ads = signal<AdModel[]>([]);
  readonly currentAdIndex = signal(0);

  private imageInterval: ReturnType<typeof setInterval> | null = null;

  readonly currentAd = computed(() => this.ads()[this.currentAdIndex()] ?? null);
  readonly currentImageSrc = computed(() => this.currentAd()?.imageSrc ?? '');
  readonly currentAltText = computed(() => this.currentAd()?.altText ?? 'Anuncio');

  async ngOnInit(): Promise<void> {
    this.checkDeviceType();

    try {
      const ads = await this.api.getAd();
      this.ads.set(ads);
      if (ads.length > 0) {
        console.log('✅ Anuncios cargados:', ads);
        setTimeout(() => {
          this.isMobileExpanded.set(true);
        }, 5000);

        if (ads.length > 1) {
          this.startAdCarousel();
        }
      } else {
        console.warn('⚠️ No hay anuncios activos.');
      }
    } catch (error) {
      console.error('❌ Error cargando anuncios:', error);
    }
  }

  ngOnDestroy(): void {
    this.stopAdCarousel();
  }

  @HostListener('window:resize')
  checkDeviceType(): void {
    this.isMobile.set(window.innerWidth <= 768);
  }

  handleToggle(): void {
    if (this.isMobile()) {
      this.isMobileExpanded.update((v) => !v);
    }
  }

  closePromo(): void {
    this.isMobileExpanded.set(false);
  }

  private startAdCarousel(): void {
    this.stopAdCarousel();
    this.imageInterval = setInterval(() => {
      this.currentAdIndex.set((this.currentAdIndex() + 1) % this.ads().length);
    }, 4000);
  }

  private stopAdCarousel(): void {
    if (this.imageInterval) {
      clearInterval(this.imageInterval);
      this.imageInterval = null;
    }
  }
}
