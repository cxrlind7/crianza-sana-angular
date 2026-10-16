import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, Comment, comentarioError } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { filterPublished } from '../../core/utils/schedule';
import { parseFlexibleDate, toSortableTime } from '../../core/utils/date-utils';
import { trackEvent, withShareUtm } from '../../core/utils/tracking';

interface ProgramVideo {
  id: string;
  title: string;
  thumbnail?: string;
  url: string;
  description?: string;
  category: string;
  participant?: string | null;
  date: string;
  formattedDate?: string;
  publishAt?: string;
}

type SortOrder = 'recent' | 'oldest';

const STATIC_VIDEOS: ProgramVideo[] = [
  {
    id: '1',
    title: '30 de abril: Día del niño',
    thumbnail: 'https://csdkids-images.s3.us-east-2.amazonaws.com/vidEsp1.png',
    url: 'https://csdkids-images.s3.us-east-2.amazonaws.com/30AbrilDia.mp4',
    description:
      'Celebrando el Día del Niño con amor y alegría. En este día especial, recordamos la importancia de proteger, educar y brindar un entorno seguro para que todos los niños puedan crecer felices y saludables. ¡Feliz Día del Niño a todos los pequeños que llenan nuestras vidas de luz y esperanza!',
    category: 'especiales',
    date: '2024-04-30',
  },
  {
    id: '2',
    title: 'Emma: La luz que inspira el camino de otros',
    thumbnail: 'https://csdkids-images.s3.us-east-2.amazonaws.com/flyer10Abril.jpeg',
    url: 'https://csdkids-images.s3.us-east-2.amazonaws.com/Emma_+La+luz+que+inspira+el+camino+de+otros.mp4',
    category: 'webinar',
    date: '2024-04-10',
  },
  {
    id: '3',
    title: 'Mi casa es neurodiversa y neurodivergente',
    thumbnail: 'https://csdkids-images.s3.us-east-2.amazonaws.com/14AgostoWebinar.jpeg',
    url: 'https://csdkids-images.s3.us-east-2.amazonaws.com/Mi+casa+es.mp4',
    category: 'webinar',
    date: '2024-08-14',
  },
  {
    id: '4',
    title: 'Radio Universidad 100.5 FM. Crianza Sana by D-kids.',
    thumbnail: 'https://csdkids-images.s3.us-east-2.amazonaws.com/radio-u.png',
    url: 'https://csdkids-images.s3.us-east-2.amazonaws.com/RadioUniversidad100.5FM.mp4',
    description:
      'Gracias a Radio Universidad 100.5 FM. Por la invitación y dar conoceré el propósito de Crianza Sana by D-kids. #reeducarparaformar #crianzasana #niños #niñas #adolescentes',
    category: 'especiales',
    date: '2024-01-01',
  },
];

const CATEGORY_NAMES: Record<string, string> = {
  radio: 'Radio',
  webinar: 'Webinar',
  especiales: 'Especiales',
};

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

@Component({
  selector: 'app-programs',
  imports: [FormsModule],
  templateUrl: './programs.html',
  styleUrl: './programs.scss',
})
export class Programs implements OnInit {
  private readonly api = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;
  readonly defaultAvatar = DEFAULT_AVATAR;

  readonly allVideos = signal<ProgramVideo[]>([]);
  readonly isLoading = signal(true);
  readonly videoError = signal(false);
  readonly fallbackThumbnail = '/logo_original.png';
  readonly showFilters = signal(false);
  readonly selectedCategories = signal<string[]>([]);
  readonly selectedSpecialist = signal<string | null>(null);
  readonly sortOrder = signal<SortOrder>('recent');

  readonly selectedVideo = signal<ProgramVideo | null>(null);
  readonly newComment = signal('');
  readonly comments = signal<Comment[]>([]);
  /** Aviso bajo el campo de comentario (en revisión, sin sesión, etc.). */
  readonly comentarioAviso = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  /** Para el anti-spam: el servidor rechaza comentarios enviados al instante. */
  private readonly abiertoEn = Date.now();
  readonly activeMenu = signal<number | null>(null);
  readonly showToast = signal(false);

  readonly uniqueCategories = ['radio', 'webinar', 'especiales'];

  readonly uniqueSpecialists = computed(() => {
    const specialists = this.allVideos()
      .map((v) => v.participant)
      .filter((p): p is string => !!p && p.trim() !== '');
    return [...new Set(specialists)].sort();
  });

  readonly filteredAndSortedVideos = computed(() => {
    let result = [...this.allVideos()];
    const categories = this.selectedCategories();
    const specialist = this.selectedSpecialist();

    if (categories.length > 0) {
      result = result.filter((video) => categories.includes(video.category));
    }
    if (specialist) {
      result = result.filter((video) => video.participant === specialist);
    }

    const order = this.sortOrder();
    result.sort((a, b) => {
      const dateA = toSortableTime(a.date);
      const dateB = toSortableTime(b.date);
      return order === 'recent' ? dateB - dateA : dateA - dateB;
    });

    return result;
  });

  readonly selectedVideoUrl = computed<SafeResourceUrl | null>(() => {
    const video = this.selectedVideo();
    if (!video || this.isDirectVideo(video.url)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(video.url);
  });

  toggleCategory(category: string): void {
    this.selectedCategories.update((list) =>
      list.includes(category) ? list.filter((c) => c !== category) : [...list, category],
    );
  }

  clearFilters(): void {
    this.selectedCategories.set([]);
    this.selectedSpecialist.set(null);
  }

  formatCategory(cat: string | undefined): string {
    if (!cat) return '';
    return CATEGORY_NAMES[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
  }

  private formatDate(rawDate: unknown): string {
    const dateObj = parseFlexibleDate(rawDate);
    if (!dateObj) return '';
    return dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  shareVideo(video: ProgramVideo | null): void {
    if (!video?.id) return;
    const url = withShareUtm(`${window.location.origin}/programs?id=${video.id}`);
    const message = `"${video.title}" - ¡Mira este programa en Crianza Sana! 📺 ${url}`;

    navigator.clipboard
      .writeText(message)
      .then(() => {
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 3000);
      })
      .catch((err) => console.error('❌ Error al copiar enlace:', err));
  }

  onThumbnailError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith(this.fallbackThumbnail)) img.src = this.fallbackThumbnail;
  }

  async selectVideo(video: ProgramVideo): Promise<void> {
    this.videoError.set(false);
    this.selectedVideo.set(video);
    // Los videos directos (<video>) se cuentan solos al reproducirse; los embebidos, al abrirlos.
    if (!this.isDirectVideo(video.url)) {
      const provider = /youtu/i.test(video.url) ? 'youtube' : /facebook|fb\./i.test(video.url) ? 'facebook' : 'embebido';
      trackEvent('ver_video', { video_title: video.title.slice(0, 100), video_url: video.url.slice(0, 100), video_provider: provider });
    }
    await this.loadComments(video.id);
    this.router.navigate([], { queryParams: { id: video.id } });
  }

  private async loadComments(videoId: string): Promise<void> {
    try {
      const comments = await this.api.getCommentsVideo(videoId);
      this.comments.set(comments);
    } catch (error) {
      console.error('❌ Error al cargar los comentarios:', error);
    }
  }

  async addNewComment(): Promise<void> {
    const text = this.newComment().trim();
    if (!text) return;
    const video = this.selectedVideo();
    if (!video) return;
    this.comentarioAviso.set(null);
    try {
      const { estado, comentario } = await this.api.comentar({ tipo: 'programa', id: video.id.toString() }, text, Date.now() - this.abiertoEn);
      if (estado === 'aprobado' && comentario) this.comments.update((list) => [...list, comentario]);
      this.newComment.set('');
      this.comentarioAviso.set({
        tipo: 'ok',
        texto: estado === 'aprobado' ? 'Comentario publicado.' : '¡Gracias! Tu comentario se publicará en cuanto el equipo lo revise.',
      });
    } catch (error) {
      this.comentarioAviso.set({ tipo: 'error', texto: comentarioError(error) });
    }
  }

  closeVideo(): void {
    this.selectedVideo.set(null);
    this.comments.set([]);
    this.activeMenu.set(null);
    this.router.navigate([], { queryParams: {} });
  }

  async deleteComment(comment: Comment, idx: number): Promise<void> {
    const user = this.currentUser();
    if (!user || user.uid !== comment['userId']) return;
    const video = this.selectedVideo();
    if (!video) return;
    if (!confirm('¿Estás seguro de que deseas eliminar este comentario?')) return;

    try {
      await this.api.borrarComentario(`programas/${video.id}/comments/${comment.id}`);
      this.comments.update((list) => list.filter((_, i) => i !== idx));
      this.activeMenu.set(null);
    } catch (error) {
      console.error('❌ Error al eliminar comentario:', error);
    }
  }

  toggleMenu(index: number): void {
    this.activeMenu.set(this.activeMenu() === index ? null : index);
  }

  isDirectVideo(url: string | undefined): boolean {
    if (!url) return false;
    return /\.(mp4|webm|mov|ogg)(\?|#|$)/i.test(url);
  }

  async ngOnInit(): Promise<void> {
    try {
      const firestoreVideos = filterPublished(
        (await this.api.getVideos()) as unknown as (ProgramVideo & { publishAt?: string })[],
      );

      const mappedFirestoreVideos: ProgramVideo[] = firestoreVideos.map((v) => ({
        ...v,
        category: 'radio',
        participant: (v as unknown as { participant?: string }).participant || null,
        date: v.date || new Date().toISOString(),
      }));

      const combined = [...STATIC_VIDEOS, ...mappedFirestoreVideos];
      combined.forEach((v) => {
        v.formattedDate = this.formatDate(v.date);
      });
      this.allVideos.set(combined);

      const videoId = this.route.snapshot.queryParamMap.get('id');
      if (videoId) {
        const video = combined.find((v) => v.id === videoId);
        if (video) this.selectVideo(video);
      }
    } catch (error) {
      console.error('❌ Error al cargar los videos:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
}
