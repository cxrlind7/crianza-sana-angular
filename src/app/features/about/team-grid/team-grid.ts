import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { people as peopleData } from '../../../core/data/people-data';

interface TeamPerson {
  id: string | number;
  name: string;
  title: string;
  description: string;
  image: string;
  color?: string;
  socials?: { iconClass: string; link: string }[];
  servicios?: { titulo: string }[];
  showFullDetails: boolean;
  [key: string]: unknown;
}

@Component({
  selector: 'app-team-grid',
  templateUrl: './team-grid.html',
  styleUrl: './team-grid.scss',
})
export class TeamGrid {
  private readonly router = inject(Router);

  readonly people = signal<TeamPerson[]>(
    (peopleData as TeamPerson[]).slice(0, 8).map((person) => ({ ...person, showFullDetails: false })),
  );

  toggleContent(index: number): void {
    this.people.update((list) =>
      list.map((p, i) => (i === index ? { ...p, showFullDetails: !p.showFullDetails } : p)),
    );
  }

  goToPersonPage(id: string | number): void {
    this.router.navigate(['/person', id]);
  }

  getCardStyle(color: string | undefined) {
    const accentColor = color || '#6b7280';
    return {
      '--theme-accent': accentColor,
      '--theme-soft': `color-mix(in srgb, ${accentColor}, white 85%)`,
    };
  }
}
