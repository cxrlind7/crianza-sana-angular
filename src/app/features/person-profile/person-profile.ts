import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { people } from '../../core/data/people-data';
import { MisionProfile } from './mision-profile/mision-profile';
import { ServicesProfile } from './services-profile/services-profile';
import { PersonFAQs } from './person-faqs/person-faqs';
import { PersonDownloads } from './person-downloads/person-downloads';
import { PersonReels } from './person-reels/person-reels';
import { PersonBlogs } from './person-blogs/person-blogs';
import { PersonYoutube } from './person-youtube/person-youtube';

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
  [key: string]: unknown;
}

@Component({
  selector: 'app-person-profile',
  imports: [MisionProfile, ServicesProfile, PersonFAQs, PersonDownloads, PersonReels, PersonBlogs, PersonYoutube],
  templateUrl: './person-profile.html',
  styleUrl: './person-profile.scss',
})
export class PersonProfile implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  readonly id = signal<string>('');

  readonly person = computed<PersonRecord | undefined>(() =>
    (people as PersonRecord[]).find((p) => p.id === Number(this.id())),
  );

  ngOnInit(): void {
    this.id.set(this.route.snapshot.paramMap.get('id') ?? '');

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
