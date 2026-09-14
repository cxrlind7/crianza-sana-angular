import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { courses } from '../../core/data/course-data';

@Component({
  selector: 'app-store',
  templateUrl: './store.html',
  styleUrl: './store.scss',
})
export class Store {
  private readonly router = inject(Router);

  readonly courses = courses;

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  goToCourse(id: string): void {
    this.router.navigate(['/store', id]);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price);
  }
}
