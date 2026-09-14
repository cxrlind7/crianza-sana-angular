import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, Blog as BlogModel } from '../../core/services/api.service';
import { filterPublished } from '../../core/utils/schedule';
import { getImagePerCategory } from '../../core/utils/blog-author-images';

interface BlogWithPublish extends BlogModel {
  publishAt?: string;
}

type SortOrder = 'recent' | 'oldest';

@Component({
  selector: 'app-blog',
  templateUrl: './blog.html',
  styleUrl: './blog.scss',
})
export class Blog implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly showToast = signal(false);
  readonly originalBlogs = signal<BlogWithPublish[]>([]);
  readonly selectedCategories = signal<string[]>([]);
  readonly sortOrder = signal<SortOrder>('recent');
  readonly showFilters = signal(false);
  readonly currentPage = signal(1);
  readonly itemsPerPage = 9;

  readonly blogs = computed(() => {
    let filtered = [...this.originalBlogs()];
    const categories = this.selectedCategories();
    if (categories.length > 0) {
      filtered = filtered.filter((blog) => blog.category && categories.includes(blog.category));
    }
    const order = this.sortOrder();
    filtered.sort((a, b) => {
      const dateA = this.parseBlogDate(a.date).getTime();
      const dateB = this.parseBlogDate(b.date).getTime();
      return order === 'recent' ? dateB - dateA : dateA - dateB;
    });
    return filtered;
  });

  readonly paginatedBlogs = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    return this.blogs().slice(start, start + this.itemsPerPage);
  });

  readonly totalPages = computed(() => Math.ceil(this.blogs().length / this.itemsPerPage));

  readonly pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  readonly uniqueCategories = computed(() => {
    const categories = this.originalBlogs()
      .map((blog) => blog.category)
      .filter((c): c is string => !!c);
    return [...new Set(categories)];
  });

  private parseBlogDate(dateField: unknown): Date {
    if (!dateField) return new Date(0);
    const d = dateField as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof d.toDate === 'function') return d.toDate();
    if (d.seconds || d._seconds) return new Date((d.seconds || d._seconds || 0) * 1000);
    return new Date(dateField as string);
  }

  toggleCategory(category: string): void {
    this.selectedCategories.update((list) =>
      list.includes(category) ? list.filter((c) => c !== category) : [...list, category],
    );
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.selectedCategories.set([]);
    this.currentPage.set(1);
  }

  getCategoryColor(category: string): string {
    const blog = this.originalBlogs().find((b) => b.category === category);
    return blog?.categoryColor || '#6c757d';
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((p) => p + 1);
      this.scrollToTop();
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
      this.scrollToTop();
    }
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.scrollToTop();
  }

  getImagePerCategory(authorName: string | undefined): string {
    return getImagePerCategory(authorName);
  }

  private scrollToTop(): void {
    document.querySelector('.blog-grid-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async ngOnInit(): Promise<void> {
    try {
      const data = await this.api.getCollection<BlogWithPublish>('blogs');
      this.originalBlogs.set(filterPublished(data));
    } catch (error) {
      console.error('Error cargando blogs:', error);
    }
  }

  goToBlogDetail(id: string): void {
    this.router.navigate(['/blog', id]);
  }

  shareBlog(id: string): void {
    const blog = this.blogs().find((b) => b.id === id);
    if (!blog) return;
    const blogUrl = `${window.location.origin}/blog/${id}`;
    const message = `"${blog.title}" - ¡Echa un vistazo a este artículo! ${blogUrl}`;
    navigator.clipboard
      .writeText(message)
      .then(() => {
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 3000);
      })
      .catch((err) => console.error('Error al copiar el enlace:', err));
  }

  truncateText(text: string | undefined, length: number): string {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  getFormattedFirestoreDate(timestamp: unknown): string {
    if (!timestamp) return '';
    const date = this.parseBlogDate(timestamp);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCompare = new Date(date);
    dateToCompare.setHours(0, 0, 0, 0);

    const differenceInDays = Math.floor((today.getTime() - dateToCompare.getTime()) / (1000 * 60 * 60 * 24));

    if (differenceInDays === 0) {
      return '¡Nuevo hoy! ✨';
    } else if (differenceInDays > 0 && differenceInDays <= 7) {
      return `Hace ${differenceInDays} días`;
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    }
  }
}
