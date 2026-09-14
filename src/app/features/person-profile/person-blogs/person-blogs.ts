import { AfterViewInit, CUSTOM_ELEMENTS_SCHEMA, Component, ElementRef, Input, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { SwiperOptions } from 'swiper/types';
import { ApiService, Blog } from '../../../core/services/api.service';
import { areNamesEquivalent } from '../../../core/utils/string-utils';

interface FirestoreTimestamp {
  toDate?: () => Date;
  _seconds?: number;
}

@Component({
  selector: 'app-person-blogs',
  templateUrl: './person-blogs.html',
  styleUrl: './person-blogs.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PersonBlogs implements OnInit, AfterViewInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  @Input() personName = '';
  @Input() personColor = '#2563eb';

  @ViewChild('swiperContainer') swiperContainer?: ElementRef<HTMLElement>;

  private readonly allBlogs = signal<Blog[]>([]);

  readonly filteredBlogs = computed(() => {
    const blogs = this.allBlogs();
    if (!this.personName || blogs.length === 0) return [];
    return blogs
      .filter((blog) => blog.authorName && areNamesEquivalent(blog.authorName, this.personName))
      .slice(0, 5);
  });

  async ngOnInit(): Promise<void> {
    try {
      const data = await this.api.getCollection<Blog>('blogs');
      const sorted = [...data].sort((a, b) => {
        const dateA = this.parseTimestamp(a.date as unknown as FirestoreTimestamp | string);
        const dateB = this.parseTimestamp(b.date as unknown as FirestoreTimestamp | string);
        return dateB.getTime() - dateA.getTime();
      });
      this.allBlogs.set(sorted);
      if (this.filteredBlogs().length > 0) {
        setTimeout(() => this.initSwiper());
      }
    } catch (error) {
      console.error('Error loading blogs:', error);
    }
  }

  ngAfterViewInit(): void {
    if (this.filteredBlogs().length > 0) {
      this.initSwiper();
    }
  }

  private initSwiper(): void {
    const swiperEl = this.swiperContainer?.nativeElement as (HTMLElement & { initialize: () => void }) | undefined;
    if (!swiperEl) return;

    const params: SwiperOptions = {
      slidesPerView: 1.1,
      spaceBetween: 30,
      autoplay: { delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true },
      pagination: { clickable: true, dynamicBullets: true },
      navigation: { nextEl: '.custom-next', prevEl: '.custom-prev' },
      breakpoints: {
        576: { slidesPerView: 1.5, spaceBetween: 20 },
        768: { slidesPerView: 2.2, spaceBetween: 30 },
        1024: { slidesPerView: 3, spaceBetween: 30 },
      },
      loop: this.filteredBlogs().length > 1.1,
      injectStyles: [],
    };

    Object.assign(swiperEl, params);
    swiperEl.initialize();
  }

  goToBlog(id: string): void {
    this.router.navigate(['/blog', id]);
  }

  truncateText(text: string | undefined, length: number): string {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  }

  private parseTimestamp(timestamp: FirestoreTimestamp | string | undefined): Date {
    if (!timestamp) return new Date(0);
    if (typeof timestamp === 'object' && typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'object' && typeof timestamp._seconds === 'number') return new Date(timestamp._seconds * 1000);
    return new Date(timestamp as string);
  }

  formatDate(timestamp: FirestoreTimestamp | string | undefined): string {
    if (!timestamp) return '';
    const date = this.parseTimestamp(timestamp);

    if (isNaN(date.getTime())) {
      return 'Fecha no disp.';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCompare = new Date(date);
    dateToCompare.setHours(0, 0, 0, 0);

    const differenceInDays = Math.floor((today.getTime() - dateToCompare.getTime()) / (1000 * 60 * 60 * 24));

    if (differenceInDays === 0) {
      return '¡Nuevo!✨';
    } else if (differenceInDays > 0 && differenceInDays <= 3) {
      return `Hace ${differenceInDays} días`;
    } else {
      return date
        .toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
        .replace(/\//g, '-');
    }
  }
}
