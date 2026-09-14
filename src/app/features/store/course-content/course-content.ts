import { Component, Input, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Course, CourseContentItem } from '../../../core/data/course-data';

@Component({
  selector: 'app-course-content',
  templateUrl: './course-content.html',
  styleUrl: './course-content.scss',
})
export class CourseContent {
  private readonly sanitizer = inject(DomSanitizer);

  @Input({ required: true }) course!: Course;

  readonly activeIndex = signal(0);

  readonly activeContent = computed<CourseContentItem>(() => this.course.content[this.activeIndex()]);

  readonly activeVideoUrl = computed<SafeResourceUrl | null>(() => {
    const content = this.activeContent();
    if (content.type !== 'video' || !content.videoId) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${content.videoId}?rel=0&modestbranding=1`,
    );
  });

  setActiveContent(index: number): void {
    this.activeIndex.set(index);
    if (window.innerWidth < 992) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getIconForType(type: string): string {
    switch (type) {
      case 'video':
        return 'bi bi-play-circle-fill';
      case 'file':
        return 'bi bi-file-earmark-text-fill';
      default:
        return 'bi bi-file-earmark';
    }
  }
}
