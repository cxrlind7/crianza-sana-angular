import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Course } from '../../../core/data/course-data';

@Component({
  selector: 'app-course-pricing',
  templateUrl: './course-pricing.html',
  styleUrl: './course-pricing.scss',
})
export class CoursePricing {
  @Input({ required: true }) course!: Course;
  @Output() triggerPurchase = new EventEmitter<void>();
}
