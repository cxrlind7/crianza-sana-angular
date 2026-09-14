import { Component, Input } from '@angular/core';
import { Course } from '../../../core/data/course-data';

@Component({
  selector: 'app-course-hero',
  templateUrl: './course-hero.html',
  styleUrl: './course-hero.scss',
})
export class CourseHero {
  @Input({ required: true }) course!: Course;
}
