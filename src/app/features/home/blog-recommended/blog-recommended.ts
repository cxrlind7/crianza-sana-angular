import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, Blog } from '../../../core/services/api.service';
import { filterPublished } from '../../../core/utils/schedule';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

@Component({
  selector: 'app-blog-recommended',
  imports: [RouterLink],
  templateUrl: './blog-recommended.html',
  styleUrl: './blog-recommended.scss',
})
export class BlogRecommended implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);

  readonly blogs = signal<Blog[]>([]);
  readonly currentIndex = signal(0);
  private interval: ReturnType<typeof setInterval> | null = null;

  readonly sortedBlogs = computed(() => {
    const blogs = this.blogs();
    if (!blogs.length) return [];
    return [...blogs].sort((a, b) => (b.orden || 0) - (a.orden || 0)).slice(0, 2);
  });

  readonly blogCycle = computed(() => [...this.sortedBlogs()]);

  readonly blog = computed(() => {
    const cycle = this.blogCycle();
    if (!cycle.length) return null;
    return cycle[this.currentIndex()];
  });

  ngOnInit(): void {
    this.loadBlogs();
  }

  ngOnDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  private async loadBlogs(): Promise<void> {
    try {
      const fetchedBlogs = await this.api.getCollection<Blog>('blogs');
      const published = filterPublished(fetchedBlogs as (Blog & { publishAt?: string })[]);
      this.blogs.set(published.filter((b) => b.title && b.imageUrl));

      if (this.blogCycle().length > 1) {
        this.startAlternating();
      }
    } catch (error) {
      console.error('❌ Error cargando blogs recomendados:', error);
    }
  }

  trackBlogClick(blogTitle: string): void {
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'click_blog_leer', {
        event_category: 'navegacion_blog',
        event_label: blogTitle,
      });
    }
  }

  private startAlternating(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      this.currentIndex.set((this.currentIndex() + 1) % this.blogCycle().length);
    }, 7000);
  }

  goToIndex(index: number): void {
    this.currentIndex.set(index);
    this.startAlternating();
  }
}
