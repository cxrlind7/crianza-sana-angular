import { AfterViewInit, CUSTOM_ELEMENTS_SCHEMA, Component, ElementRef, Input, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { SwiperOptions } from 'swiper/types';

interface ShortVideo {
  id?: string;
  title: string;
  url: string;
  poster?: string;
}

@Component({
  selector: 'app-person-short-videos',
  templateUrl: './person-short-videos.html',
  styleUrl: './person-short-videos.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PersonShortVideos implements AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private _videos: ShortVideo[] = [];
  @Input()
  set videos(value: ShortVideo[]) {
    this._videos = value || [];
    this.tryOpenFromQueryParam();
  }
  get videos(): ShortVideo[] {
    return this._videos;
  }

  @Input() personColor = '#2563eb';

  readonly showToast = signal(false);
  readonly selectedVideo = signal<ShortVideo | null>(null);

  @ViewChild('swiperContainer') swiperContainer?: ElementRef<HTMLElement>;
  @ViewChild('sectionRoot') sectionRoot?: ElementRef<HTMLElement>;

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

  private tryOpenFromQueryParam(): void {
    if (this.selectedVideo()) return;
    const id = this.route.snapshot.queryParamMap.get('video');
    if (!id) return;
    const match = this.videos.find((v) => v.id === id);
    if (!match) return;
    this.selectedVideo.set(match);
    setTimeout(() => {
      this.sectionRoot?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async shareVideo(video: ShortVideo): Promise<void> {
    if (!video.id) return;
    const url = `${window.location.origin}${window.location.pathname}?video=${video.id}`;
    try {
      await navigator.clipboard.writeText(url);
      this.showToast.set(true);
      setTimeout(() => this.showToast.set(false), 3000);
    } catch (error) {
      console.error('❌ Error al copiar el enlace del video:', error);
    }
  }

  closeVideo(): void {
    this.selectedVideo.set(null);
    this.router.navigate([], { queryParams: {} });
  }
}
