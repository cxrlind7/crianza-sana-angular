import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

interface SpotifyEpisode {
  id: string;
  name: string;
  description: string;
  release_date: string;
  duration_ms: number;
  images: { url: string }[];
}

@Component({
  selector: 'app-spotify-section',
  templateUrl: './spotify-section.html',
  styleUrl: './spotify-section.scss',
})
export class SpotifySection implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly backendUrl = 'https://backend-crianza-sana-production.up.railway.app/api/episodios';

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly episodes = signal<SpotifyEpisode[]>([]);
  readonly currentEpisodeId = signal<string | null>(null);
  readonly showList = signal(false);

  readonly currentEpisodeEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const id = this.currentEpisodeId();
    if (!id) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://open.spotify.com/embed/episode/${id}?utm_source=generator&theme=0`,
    );
  });

  async ngOnInit(): Promise<void> {
    await this.fetchEpisodes();
  }

  private async fetchEpisodes(): Promise<void> {
    try {
      this.loading.set(true);
      const episodes = await firstValueFrom(this.http.get<SpotifyEpisode[]>(this.backendUrl));
      this.episodes.set(episodes);
      if (episodes.length > 0) {
        this.currentEpisodeId.set(episodes[0].id);
      }
      this.loading.set(false);
    } catch (err) {
      console.error('Error fetching episodes:', err);
      this.error.set(true);
      this.loading.set(false);
    }
  }

  playEpisode(id: string): void {
    this.currentEpisodeId.set(id);
    document.getElementById('spotify-player-anchor')?.scrollIntoView({ behavior: 'smooth' });
  }

  toggleList(): void {
    this.showList.update((v) => !v);
  }

  formatDate(dateString: string): string {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('es-MX', options);
  }

  formatDuration(ms: number): number {
    return Math.floor(ms / 60000);
  }
}
