import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import html2canvas from 'html2canvas';
import { ApiService, Blog, Comment } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { getImagePerCategory, DEFAULT_AUTHOR_IMAGE } from '../../../core/utils/blog-author-images';
import { people } from '../../../core/data/people-data';
import { parseFlexibleDate } from '../../../core/utils/date-utils';
import { SpeechSegment, buildSpeechSegments, findSegmentAtPoint } from '../../../core/utils/speech-segments';

@Component({
  selector: 'app-blog-detail',
  imports: [FormsModule, RouterLink],
  templateUrl: './blog-detail.html',
  styleUrl: './blog-detail.scss',
})
export class BlogDetail implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  @ViewChild('instagramStoryRef') instagramStoryRef?: ElementRef<HTMLElement>;
  @ViewChild('titleRef') titleRef?: ElementRef<HTMLElement>;
  @ViewChild('subtitleRef') subtitleRef?: ElementRef<HTMLElement>;
  @ViewChild('contentRef') contentRef?: ElementRef<HTMLElement>;
  // El reproductor flotante aparece cuando el botón "Escuchar" del encabezado sale de la pantalla.
  @ViewChild('listenActionsRef') set listenActionsRef(ref: ElementRef<HTMLElement> | undefined) {
    this.listenObserver?.disconnect();
    if (!ref || typeof IntersectionObserver === 'undefined') return;
    this.listenObserver = new IntersectionObserver(
      ([entry]) => this.listenButtonVisible.set(entry.isIntersecting),
      { rootMargin: '-80px 0px 0px 0px' },
    );
    this.listenObserver.observe(ref.nativeElement);
  }

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly defaultAvatar = DEFAULT_AUTHOR_IMAGE;

  readonly blogs = signal<Blog[]>([]);
  readonly comments = signal<Comment[]>([]);
  readonly newComment = signal('');
  readonly activeMenu = signal<number | null>(null);
  readonly showToast = signal(false);
  readonly isGeneratingImage = signal(false);
  readonly isLoading = signal(true);
  readonly speechState = signal<'idle' | 'playing' | 'paused'>('idle');
  readonly speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  readonly listenButtonVisible = signal(true);

  private speechSegments: SpeechSegment[] = [];
  private speechIndex = 0;
  private speechSession = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private listenObserver?: IntersectionObserver;

  readonly authUser = this.authService.currentUser;

  readonly blog = computed(() => this.blogs().find((b) => b.id === this.id));

  readonly formattedDate = computed(() => {
    const blog = this.blog();
    if (!blog?.date) return '';
    const publicationDate = this.parseDate(blog.date);
    if (isNaN(publicationDate.getTime())) return 'Fecha no disponible';
    return publicationDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  });

  readonly formattedText = computed(() => {
    const blog = this.blog();
    return blog?.text ? blog.text.replace(/(?:\r\n|\r|\n)/g, '<br>') : '';
  });

  private readonly closeMenuHandler = (e: MouseEvent) => {
    if (this.activeMenu() !== null && !(e.target as HTMLElement).closest('.comment-options')) {
      this.activeMenu.set(null);
    }
  };

  private scrollListener: (() => void) | null = null;

  private parseDate(dateField: unknown): Date {
    return parseFlexibleDate(dateField) ?? new Date(NaN);
  }

  async ngOnInit(): Promise<void> {
    // Chrome carga las voces de forma asíncrona; pedirlas aquí evita que el primer clic use la voz por defecto.
    if (this.speechSupported) window.speechSynthesis.getVoices();

    try {
      this.blogs.set(await this.api.getCollection<Blog>('blogs'));
    } catch (error) {
      console.error('❌ Error cargando blogs:', error);
    } finally {
      this.isLoading.set(false);
    }
    await this.loadComments();

    document.addEventListener('click', this.closeMenuHandler);

    this.scrollListener = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = scrollTop / docHeight;
      if (scrollPercent >= 0.8) {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'scroll_blog_completo', {
            event_category: 'lectura_blog',
            event_label: this.blog()?.title || this.id,
          });
        }
        if (this.scrollListener) window.removeEventListener('scroll', this.scrollListener);
      }
    };
    window.addEventListener('scroll', this.scrollListener);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.closeMenuHandler);
    if (this.scrollListener) window.removeEventListener('scroll', this.scrollListener);
    this.stopSpeech();
    this.listenObserver?.disconnect();
  }

  toggleSpeech(): void {
    if (!this.speechSupported) return;
    const state = this.speechState();
    if (state === 'playing') this.pauseSpeech();
    else if (state === 'paused') this.speakFrom(this.speechIndex);
    else this.startSpeech();
  }

  stopSpeech(): void {
    if (!this.speechSupported) return;
    this.speechSession++;
    window.speechSynthesis.cancel();
    this.speechState.set('idle');
    this.speechIndex = 0;
    this.highlightSegment(null);
  }

  /** Durante la lectura, tocar una frase hace que la lectura continúe desde ahí. */
  onReadingClick(event: MouseEvent): void {
    if (this.speechState() === 'idle') return;
    if ((event.target as HTMLElement).closest('a, button, input, textarea')) return;
    if (window.getSelection()?.isCollapsed === false) return;
    const index = findSegmentAtPoint(this.speechSegments, event.clientX, event.clientY);
    if (index !== -1) this.speakFrom(index);
  }

  private startSpeech(): void {
    const blog = this.blog();
    if (!blog) return;
    this.speechSegments = [this.titleRef, this.subtitleRef, this.contentRef].flatMap((ref) =>
      ref ? buildSpeechSegments(ref.nativeElement) : [],
    );
    if (!this.speechSegments.length) return;

    this.speakFrom(0);

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'escuchar_blog', {
        event_category: 'lectura_blog',
        event_label: blog.title || this.id,
      });
    }
  }

  // speechSynthesis.pause() no funciona en Chrome para Android, así que pausar es cancelar y recordar la frase;
  // al reanudar se repite esa frase desde el inicio.
  private pauseSpeech(): void {
    this.speechSession++;
    window.speechSynthesis.cancel();
    this.speechState.set('paused');
  }

  private speakFrom(index: number): void {
    const synth = window.speechSynthesis;
    const session = ++this.speechSession;
    this.speechState.set('playing');
    const voice = this.pickSpanishVoice();

    if (synth.speaking || synth.pending) {
      synth.cancel();
      // Chrome a veces ignora un speak() inmediatamente después de cancel().
      setTimeout(() => this.speakSegment(index, session, voice), 60);
    } else {
      // Sin espera: iOS solo permite iniciar la voz dentro del gesto del usuario.
      this.speakSegment(index, session, voice);
    }
  }

  // Las frases se encadenan una a una (en lugar de encolarlas todas) para poder saltar y pausar de forma fiable.
  private speakSegment(index: number, session: number, voice: SpeechSynthesisVoice | undefined): void {
    if (session !== this.speechSession) return;
    const segment = this.speechSegments[index];
    if (!segment) {
      this.stopSpeech();
      return;
    }

    const follow = index === this.speechIndex || this.isCurrentSegmentVisible();
    this.speechIndex = index;
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = voice?.lang ?? 'es-MX';
    if (voice) utterance.voice = voice;
    utterance.onend = () => this.speakSegment(index + 1, session, voice);
    utterance.onerror = (e) => {
      if (session !== this.speechSession || e.error === 'canceled' || e.error === 'interrupted') return;
      console.error('Error en lectura en voz alta:', e.error);
      this.stopSpeech();
    };
    // Se guarda la referencia porque Chrome puede liberar la locución y no disparar onend.
    this.currentUtterance = utterance;
    this.highlightSegment(segment.range, follow);
    window.speechSynthesis.speak(utterance);
  }

  private highlightSegment(range: Range | null, follow = false): void {
    // CSS Custom Highlight API: marca el texto sin modificar el DOM generado por [innerHTML].
    const highlights = typeof CSS !== 'undefined' && 'highlights' in CSS ? CSS.highlights : null;
    if (!highlights) return;
    if (!range) {
      highlights.delete('blog-reading');
      return;
    }
    highlights.set('blog-reading', new Highlight(range));

    // Solo sigue la lectura con el scroll si el usuario no se ha ido a otra parte de la página.
    const rect = range.getBoundingClientRect();
    if (follow && (rect.top < 100 || rect.bottom > window.innerHeight - 100)) {
      window.scrollBy({ top: rect.top - window.innerHeight / 3, behavior: 'smooth' });
    }
  }

  private isCurrentSegmentVisible(): boolean {
    const rect = this.speechSegments[this.speechIndex]?.range.getBoundingClientRect();
    return !!rect && rect.bottom > 0 && rect.top < window.innerHeight;
  }
  // La Web Speech API no expone el género de la voz, así que se identifica por nombres conocidos de voces femeninas
  // (Windows/Edge, Chrome, macOS/iOS y Android).
  private static readonly FEMALE_VOICE_NAMES =
    /dalia|sabina|helena|laura|elvira|paloma|lupe|pen[eé]lope|m[oó]nica|paulina|marisol|m[ií]a|renata|elena|ximena|valentina|camila|larissa|triana|abril|carlota|irene|nuria|beatriz|candela|carmen|sof[ií]a|isabel|female|mujer|google español/i;

  private pickSpanishVoice(): SpeechSynthesisVoice | undefined {
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es'));
    const female = voices.filter((v) => BlogDetail.FEMALE_VOICE_NAMES.test(v.name));
    // Las voces "Natural"/"Online" de Edge suenan mucho mejor que las locales.
    const rank = (v: SpeechSynthesisVoice) =>
      (v.lang === 'es-MX' ? 4 : v.lang === 'es-US' ? 2 : 0) + (/natural|online/i.test(v.name) ? 1 : 0);
    const best = (list: SpeechSynthesisVoice[]) => [...list].sort((a, b) => rank(b) - rank(a))[0];
    return best(female) ?? best(voices);
  }

  private async loadComments(): Promise<void> {
    if (!this.id) return;
    try {
      this.comments.set(await this.api.getComments(this.id));
    } catch (error) {
      console.error('❌ Error cargando comentarios:', error);
    }
  }

  toggleMenu(index: number): void {
    this.activeMenu.set(this.activeMenu() === index ? null : index);
  }

  getImagePerCategory(authorName: string | undefined): string {
    return getImagePerCategory(authorName);
  }

  async addNewComment(): Promise<void> {
    const text = this.newComment().trim();
    if (!text) return;
    const user = this.authUser();

    try {
      const newCommentData = {
        userId: user ? user.uid : 'guest_' + Date.now(),
        userName: user ? user.displayName || 'Usuario Invitado' : 'Usuario Invitado',
        commentText: text,
        image: user ? user.photoURL : null,
        createdAt: new Date().toISOString(),
      };
      const commentId = await this.api.addComment(this.id, newCommentData);
      this.comments.update((list) => [...list, { ...newCommentData, id: commentId }]);
      this.newComment.set('');
    } catch (error) {
      console.error('❌ Error al agregar comentario:', error);
    }
  }

  async deleteComment(comment: Comment, idx: number): Promise<void> {
    const user = this.authUser();
    const blog = this.blog();
    if (!user || !blog || user.uid !== comment['userId']) return;
    if (!confirm('¿Estás seguro de que deseas eliminar este comentario?')) return;

    try {
      await this.api.deleteComment(blog.id, comment.id);
      this.comments.update((list) => list.filter((_, i) => i !== idx));
      this.activeMenu.set(null);
    } catch (error) {
      console.error('❌ Error al eliminar comentario:', error);
    }
  }

  shareBlog(id: string): void {
    if (!this.blog()) return;
    const blogUrl = `${window.location.origin}/blog/${id}`;
    navigator.clipboard
      .writeText(blogUrl)
      .then(() => {
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 3000);
        this.trackShare('clipboard', id);
      })
      .catch((err) => console.error('Error al copiar:', err));
  }

  shareToFacebook(id: string): void {
    if (!this.blog()) return;
    // server.js inyecta las etiquetas Open Graph del blog en /blog/:id del mismo dominio.
    const shareUrl = encodeURIComponent(`${window.location.origin}/blog/${id}`);
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
    window.open(facebookShareUrl, 'facebook-share-dialog', 'width=626,height=436');
  }

  async generateInstagramStory(): Promise<void> {
    if (this.isGeneratingImage()) return;
    this.isGeneratingImage.set(true);
    const blog = this.blog();

    try {
      const element = this.instagramStoryRef?.nativeElement;
      if (!element || !blog) {
        console.error('No se encontró el elemento para la historia');
        this.isGeneratingImage.set(false);
        return;
      }

      const canvas = await html2canvas(element, {
        useCORS: true,
        scale: 2,
        backgroundColor: null,
        logging: false,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const blob = this.dataURItoBlob(dataUrl);
      const file = new File([blob], `crianza-sana-story-${blog.id}.png`, { type: 'image/png' });

      if (navigator.share) {
        try {
          await navigator.share({ files: [file] });
          this.trackShare('instagram_story_share_api', blog.id);
        } catch (shareError) {
          if ((shareError as Error).name !== 'AbortError') {
            console.warn('Share API falló, fallback a descarga:', shareError);
            this.downloadImage(dataUrl);
          }
        }
      } else {
        this.downloadImage(dataUrl);
      }
    } catch (error) {
      console.error('Error generando historia:', error);
      alert('Hubo un error al generar la imagen.');
    } finally {
      this.isGeneratingImage.set(false);
    }
  }

  private dataURItoBlob(dataURI: string): Blob {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  }

  private downloadImage(dataUrl: string): void {
    const blog = this.blog();
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `crianza-sana-story-${blog?.id}.png`;
    link.click();
    if (blog) this.trackShare('instagram_story_download', blog.id);

    alert('No se pudo abrir Instagram directamente. La imagen se ha guardado en tu dispositivo. ¡Ábrela desde Instagram Stories!');
  }

  getCategoryColor(blog: Blog | undefined): string {
    if (!blog) return '#718096';

    if (blog.authorName) {
      const authorName = blog.authorName.toLowerCase().trim();
      const specialist = (people as { name: string; color?: string }[]).find(
        (p) => p.name.toLowerCase().trim() === authorName,
      );
      if (specialist?.color) return specialist.color;
    }

    if (blog.categoryColor) return blog.categoryColor;

    const cat = (blog.category || '').toLowerCase().trim();
    if (cat.includes('crianza')) return '#e53e3e';
    if (cat.includes('salud')) return '#38a169';
    if (cat.includes('educa')) return '#3182ce';
    if (cat.includes('nutri')) return '#dd6b20';
    if (cat.includes('psico')) return '#805ad5';
    if (cat.includes('odont')) return '#d53f8c';

    return '#718096';
  }

  getStoryGradient(blog: Blog | undefined): string {
    if (!blog) return 'linear-gradient(180deg, #1a202c 0%, #2d3748 100%)';
    const color = this.getCategoryColor(blog);
    return `linear-gradient(180deg, ${color} 0%, #1a202c 100%)`;
  }

  private trackShare(method: string, id: string): void {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'share_blog', {
        event_category: 'interacción',
        event_label: this.blog()?.title,
        blog_id: id,
        method,
      });
    }
  }

  goBack(): void {
    this.location.back();
  }
}
