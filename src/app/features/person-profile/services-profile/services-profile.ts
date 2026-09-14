import { AfterViewInit, CUSTOM_ELEMENTS_SCHEMA, Component, ElementRef, Input, ViewChild } from '@angular/core';
import type { SwiperOptions } from 'swiper/types';

interface Servicio {
  titulo: string;
  descripcion: string;
  image: string;
}

@Component({
  selector: 'app-services-profile',
  templateUrl: './services-profile.html',
  styleUrl: './services-profile.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ServicesProfile implements AfterViewInit {
  @Input() servicios: Servicio[] = [];
  @Input() personColor = '#333';

  @ViewChild('swiperContainer') swiperContainer?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    const swiperEl = this.swiperContainer?.nativeElement as (HTMLElement & { initialize: () => void }) | undefined;
    if (!swiperEl) return;

    const params: SwiperOptions = {
      slidesPerView: 1.1,
      spaceBetween: 30,
      autoplay: { delay: 3500, disableOnInteraction: false, pauseOnMouseEnter: true },
      pagination: { clickable: true, dynamicBullets: true },
      navigation: { nextEl: '.custom-next', prevEl: '.custom-prev' },
      breakpoints: {
        576: { slidesPerView: 1.5, spaceBetween: 20 },
        768: { slidesPerView: 2.2, spaceBetween: 30 },
        1024: { slidesPerView: 3, spaceBetween: 30 },
        1400: { slidesPerView: 4, spaceBetween: 30 },
      },
      loop: this.servicios.length > 1.1,
      injectStyles: [],
    };

    Object.assign(swiperEl, params);
    swiperEl.initialize();
  }
}
