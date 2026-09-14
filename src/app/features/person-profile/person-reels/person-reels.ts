import { Component, Input, computed, signal } from '@angular/core';

interface InstagramProfileData {
  url: string;
  username: string;
  profileImage: string;
  imagenInstagram?: string;
  stats: { posts: number; followers: number; following: number };
  fullName: string;
  bio: string;
}

@Component({
  selector: 'app-person-reels',
  templateUrl: './person-reels.html',
  styleUrl: './person-reels.scss',
})
export class PersonReels {
  private readonly _instagramProfileData = signal<InstagramProfileData | null>(null);

  @Input() set instagramProfileData(value: InstagramProfileData | null) {
    this._instagramProfileData.set(value);
  }

  readonly instaData = this._instagramProfileData.asReadonly();

  readonly formattedBio = computed(() => {
    const bio = this.instaData()?.bio;
    if (!bio) return '';
    return bio.replace(/\n/g, '<br>');
  });

  formatNumber(num: number | undefined): string {
    if (!num) return '0';
    return new Intl.NumberFormat('es-ES', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(num);
  }
}
