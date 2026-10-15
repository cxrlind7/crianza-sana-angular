import { AfterViewInit, CUSTOM_ELEMENTS_SCHEMA, Component, ElementRef, Input, ViewChild, output, signal } from '@angular/core';
import type { SwiperOptions } from 'swiper/types';
import { ShortVideo } from '../../../core/services/api.service';
import { trackEvent, withShareUtm } from '../../../core/utils/tracking';

/** Carrusel de clips educativos; al tocar uno se abre en la ventana emergente del perfil. */
@Component({
  selector: 'app-person-short-videos',
  templateUrl: './person-short-videos.html',
  styleUrl: './person-short-videos.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PersonShortVideos implements AfterViewInit {
  @Input() videos: ShortVideo[] = [];
  @Input() personColor = '#2563eb';

  readonly play = output<ShortVideo>();
  readonly showToast = signal(false);

  @ViewChild('swiperContainer') swiperContainer?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    const swiperEl = this.swiperContainer?.nativeElement as (HTMLElement & { initialize: () => void }) | undefined;
    if (!swiperEl) return;

    const params: SwiperOptions = {
      slidesPerView: 1.3,
      spaceBetween: 20,
      pagination: { clickable: true, dynamicBullets: true },
      navigation: { nextEl: '.sv-custom-next', prevEl: '.sv-custom-prev' },
      breakpoints: {
        576: { slidesPerView: 2.1, spaceBetween: 20 },
        768: { slidesPerView: 2.6, spaceBetween: 24 },
        1024: { slidesPerView: 3.4, spaceBetween: 24 },
      },
      loop: this.videos.length > 3,
      injectStyles: [],
    };

    Object.assign(swiperEl, params);
    swiperEl.initialize();
  }

  async shareVideo(video: ShortVideo): Promise<void> {
    if (!video.id) return;
    const url = withShareUtm(`${window.location.origin}${window.location.pathname}?video=${video.id}`);
    try {
      await navigator.clipboard.writeText(url);
      trackEvent('compartir', { method: 'video_corto', link_text: video.title });
      this.showToast.set(true);
      setTimeout(() => this.showToast.set(false), 3000);
    } catch (error) {
      console.error('❌ Error al copiar el enlace del video:', error);
    }
  }
}
