import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import html2canvas from 'html2canvas';
import { ApiService, Blog, Comment } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { getImagePerCategory, DEFAULT_AUTHOR_IMAGE } from '../../../core/utils/blog-author-images';
import { people } from '../../../core/data/people-data';

@Component({
  selector: 'app-blog-detail',
  imports: [FormsModule],
  templateUrl: './blog-detail.html',
  styleUrl: './blog-detail.scss',
})
export class BlogDetail implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  @ViewChild('instagramStoryRef') instagramStoryRef?: ElementRef<HTMLElement>;

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly defaultAvatar = DEFAULT_AUTHOR_IMAGE;

  readonly blogs = signal<Blog[]>([]);
  readonly comments = signal<Comment[]>([]);
  readonly newComment = signal('');
  readonly activeMenu = signal<number | null>(null);
  readonly showToast = signal(false);
  readonly isGeneratingImage = signal(false);

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
    const d = dateField as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof d.toDate === 'function') return d.toDate();
    if (d.seconds || d._seconds) return new Date((d.seconds || d._seconds || 0) * 1000);
    return new Date(dateField as string);
  }

  async ngOnInit(): Promise<void> {
    try {
      this.blogs.set(await this.api.getCollection<Blog>('blogs'));
    } catch (error) {
      console.error('❌ Error cargando blogs:', error);
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
    const backendUrl = 'https://backend-crianza-sana-production.up.railway.app';
    const shareUrl = encodeURIComponent(`${backendUrl}/blog/${id}`);
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
