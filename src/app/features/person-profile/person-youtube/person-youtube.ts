import { AfterViewInit, CUSTOM_ELEMENTS_SCHEMA, Component, ElementRef, Input, ViewChild } from '@angular/core';
import type { SwiperOptions } from 'swiper/types';

interface YoutubeVideo {
  id: string;
  title: string;
}

@Component({
  selector: 'app-person-youtube',
  templateUrl: './person-youtube.html',
  styleUrl: './person-youtube.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PersonYoutube implements AfterViewInit {
  @Input() videos: YoutubeVideo[] = [];
  @Input() channelUrl = '';
  @Input() personColor = '#2563eb';

  @ViewChild('swiperContainer') swiperContainer?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    const swiperEl = this.swiperContainer?.nativeElement as (HTMLElement & { initialize: () => void }) | undefined;
    if (!swiperEl) return;

    const params: SwiperOptions = {
      slidesPerView: 1.1,
      spaceBetween: 30,
      autoplay: { delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true },
      pagination: { clickable: true, dynamicBullets: true },
      navigation: { nextEl: '.yt-custom-next', prevEl: '.yt-custom-prev' },
      breakpoints: {
        576: { slidesPerView: 1.5, spaceBetween: 20 },
        768: { slidesPerView: 2.2, spaceBetween: 30 },
        1024: { slidesPerView: 3, spaceBetween: 30 },
      },
      loop: this.videos.length > 1.1,
      injectStyles: [],
    };

    Object.assign(swiperEl, params);
    swiperEl.initialize();
  }

  thumbnailUrl(id: string): string {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
}
