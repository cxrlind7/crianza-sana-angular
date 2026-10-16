import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { findPerson, isPersonActive } from '../../core/utils/people-visibility';
import { ApiService, ShortVideo } from '../../core/services/api.service';
import { MisionProfile } from './mision-profile/mision-profile';
import { ServicesProfile } from './services-profile/services-profile';
import { PersonFAQs } from './person-faqs/person-faqs';
import { PersonDownloads } from './person-downloads/person-downloads';
import { PersonReels } from './person-reels/person-reels';
import { PersonBlogs } from './person-blogs/person-blogs';
import { PersonYoutube } from './person-youtube/person-youtube';
import { PersonShortVideos } from './person-short-videos/person-short-videos';
import { VideoModal } from '../../shared/video-modal/video-modal';
import { PersonFicha } from './person-ficha/person-ficha';
import { PersonFichaData } from '../../core/utils/person-card';

interface PersonRecord {
  id: number;
  name: string;
  title: string;
  detalle: string;
  image: string;
  color: string;
  mision: string;
  vision: string;
  servicios: { titulo: string; descripcion: string; image: string }[];
  preguntasFrecuentes: { pregunta: string; respuesta: string }[];
  files: { name: string; url: string }[];
  socials: { iconClass: string; link: string }[];
  direccion: { iconClass: string; link: string };
  instagramProfileData?: {
    url: string;
    username: string;
    profileImage: string;
    stats: { posts: number; followers: number; following: number };
    fullName: string;
    bio: string;
  } | null;
  youtubeVideos?: { id: string; title: string }[];
  youtubeChannelUrl?: string;
  ficha?: PersonFichaData;
  [key: string]: unknown;
}

@Component({
  selector: 'app-person-profile',
  imports: [
    MisionProfile,
    ServicesProfile,
    PersonFAQs,
    PersonDownloads,
    PersonReels,
    PersonBlogs,
    PersonYoutube,
    PersonShortVideos,
    VideoModal,
    PersonFicha,
  ],
  templateUrl: './person-profile.html',
  styleUrl: './person-profile.scss',
})
export class PersonProfile implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly id = signal<string>('');
  readonly shortVideos = signal<ShortVideo[]>([]);

  /** Solo se muestra uno de cada uno; si hubiera varios, gana el último. */
  readonly introVideo = computed(() => this.shortVideos().filter((v) => v.tipo === 'conociendo').at(-1) ?? null);
  readonly businessVideo = computed(() => this.shortVideos().filter((v) => v.tipo === 'negocio').at(-1) ?? null);
  readonly clips = computed(() => this.shortVideos().filter((v) => !v.tipo || v.tipo === 'educativo'));

  /** Video abierto en la ventana emergente (cualquiera de los tres tipos). */
  readonly openVideo = signal<ShortVideo | null>(null);

  readonly firstName = computed(() => this.person()?.name.split(' ')[0] ?? '');

  readonly openVideoHeading = computed(() => {
    const video = this.openVideo();
    if (!video) return '';
    if (video.tipo === 'conociendo') return `Conociendo a ${this.firstName()}`;
    if (video.tipo === 'negocio') return video.title || `El espacio de ${this.firstName()}`;
    return video.title;
  });

  readonly person = computed<PersonRecord | undefined>(() =>
    isPersonActive(this.id()) ? (findPerson(this.id()) as unknown as PersonRecord) : undefined,
  );

  ngOnInit(): void {
    this.id.set(this.route.snapshot.paramMap.get('id') ?? '');

    this.api.getShortVideos(this.id()).then((videos) => {
      this.shortVideos.set(videos);
      // Links compartidos: /person/2?video=ID abre ese video directo.
      const sharedId = this.route.snapshot.queryParamMap.get('video');
      const shared = sharedId ? videos.find((v) => v.id === sharedId) : null;
      if (shared) this.openVideo.set(shared);
    });

    if (typeof window.gtag === 'function') {
      const path = `/person/${this.id()}`;
      const title = this.person()?.name || `Perfil de persona ${this.id()}`;
      window.gtag('event', 'page_view', { page_path: path, page_title: title });
      window.gtag('event', 'view_person_profile', {
        person_id: this.id(),
        person_name: this.person()?.name || 'Desconocido',
      });
    }
  }

  goBack(): void {
    this.location.back();
  }

  playVideo(video: ShortVideo): void {
    this.openVideo.set(video);
  }

  closeVideo(): void {
    this.openVideo.set(null);
    if (this.route.snapshot.queryParamMap.has('video')) {
      this.router.navigate([], { queryParams: { video: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  getSocialName(iconClass: string | undefined): string {
    if (!iconClass) return 'Ver perfil';
    const lowerClass = iconClass.toLowerCase();
    if (lowerClass.includes('instagram')) return 'Instagram';
    if (lowerClass.includes('facebook')) return 'Facebook';
    if (lowerClass.includes('twitter') || lowerClass.includes('x-twitter')) return 'X (Twitter)';
    if (lowerClass.includes('linkedin')) return 'LinkedIn';
    if (lowerClass.includes('tiktok')) return 'TikTok';
    if (lowerClass.includes('youtube')) return 'YouTube';
    if (lowerClass.includes('whatsapp')) return 'WhatsApp';
    if (lowerClass.includes('web') || lowerClass.includes('globe')) return 'Sitio web';
    return 'Ver perfil';
  }
}
