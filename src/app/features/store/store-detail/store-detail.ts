import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Course, courses } from '../../../core/data/course-data';
import { CourseHero } from '../course-hero/course-hero';
import { CoursePricing } from '../course-pricing/course-pricing';
import { CourseContent } from '../course-content/course-content';

@Component({
  selector: 'app-store-detail',
  imports: [RouterLink, CourseHero, CoursePricing, CourseContent],
  templateUrl: './store-detail.html',
  styleUrl: './store-detail.scss',
})
export class StoreDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);

  readonly course = signal<Course | null>(null);
  readonly hasPurchased = signal(false);

  ngOnInit(): void {
    const courseId = this.route.snapshot.paramMap.get('id');
    this.course.set(courses.find((c) => c.id === courseId) ?? null);
  }

  simulatePurchase(): void {
    setTimeout(() => {
      alert('¡Bienvenido! Tu inscripción al curso de Luis ha sido exitosa.');
      this.hasPurchased.set(true);
      window.scrollTo(0, 0);
    }, 1500);
  }
}
