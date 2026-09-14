import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, Comment, Gallery as GalleryAlbum, GalleryImage } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

type SortOrder = 'recent' | 'oldest';

const NAME_MAPPING: Record<string, string> = {
  'Galería de Karen': 'Karen Meraz Cardosa',
  'Galería de Andrea': 'Andrea Soria',
  'Galería de Carina': 'Carina Lares',
  'Galería de Patricia Peña': 'Patricia Peña Raigosa',
};

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

@Component({
  selector: 'app-gallery',
  imports: [FormsModule],
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss',
})
export class Gallery implements OnInit {
  private readonly api = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;
  readonly defaultAvatar = DEFAULT_AVATAR;

  readonly allAlbums = signal<GalleryAlbum[]>([]);
  readonly showFilters = signal(false);
  readonly sortOrder = signal<SortOrder>('recent');
  readonly selectedPerson = signal<string | null>(null);
  readonly showToast = signal(false);

  readonly selectedAlbum = signal<GalleryAlbum | null>(null);
  readonly selectedImageIndex = signal(0);
  readonly newComment = signal('');
  readonly comments = signal<Comment[]>([]);
  readonly activeMenu = signal<number | null>(null);

  getPersonName(albumName: string | undefined): string | null {
    if (!albumName) return null;
    const parts = albumName.split(' - ');
    let name = parts.length > 0 && parts[0].trim() !== '' ? parts[0].trim() : null;

    if (name) {
      if (NAME_MAPPING[name]) return NAME_MAPPING[name];
      if (name.startsWith('Galería de ')) return name.replace('Galería de ', '').trim();
    }
    return name;
  }

  readonly uniquePeople = computed(() => {
    const people = this.allAlbums()
      .map((album) => this.getPersonName(album.name))
      .filter((p): p is string => p !== null);
    return [...new Set(people)].sort();
  });

  readonly filteredAndSortedAlbums = computed(() => {
    let result = [...this.allAlbums()];
    const person = this.selectedPerson();

    if (person) {
      result = result.filter((album) => this.getPersonName(album.name) === person);
    }

    const order = this.sortOrder();
    result.sort((a, b) => {
      const dateA = this.toDate(a.date);
      const dateB = this.toDate(b.date);
      return order === 'recent' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
    });

    return result;
  });

  readonly currentImage = computed<GalleryImage | null>(() => {
    const album = this.selectedAlbum();
    if (!album || album.images.length === 0) return null;
    return album.images[this.selectedImageIndex()];
  });

  readonly hasMultipleImages = computed(() => (this.selectedAlbum()?.images.length ?? 0) > 1);

  async ngOnInit(): Promise<void> {
    try {
      const albums = await this.api.getGalleries();
      this.allAlbums.set(albums);

      const idAlbum = this.route.snapshot.queryParamMap.get('idAlbum');
      const idFoto = this.route.snapshot.queryParamMap.get('idFoto');

      if (idAlbum) {
        const album = albums.find((a) => a.id === idAlbum);
        if (album) {
          this.openAlbum(album, idFoto);
        }
      }
    } catch (error) {
      console.error('❌ Error al cargar los álbumes:', error);
    }
  }

  private toDate(rawDate: unknown): Date {
    if (!rawDate) return new Date(0);
    const d = rawDate as { seconds?: number };
    if (d.seconds) return new Date(d.seconds * 1000);
    return new Date(rawDate as string);
  }

  clearFilters(): void {
    this.selectedPerson.set(null);
  }

  formatDate(rawDate: unknown): string {
    if (!rawDate) return '';
    const d = rawDate as { toDate?: () => Date; seconds?: number; _seconds?: number };
    let dateObj: Date;
    if (typeof d.toDate === 'function') {
      dateObj = d.toDate();
    } else if (d.seconds || d._seconds) {
      dateObj = new Date((d.seconds || d._seconds || 0) * 1000);
    } else {
      dateObj = new Date(rawDate as string);
    }

    if (isNaN(dateObj.getTime())) return 'Fecha no disponible';

    return dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  private showToastNotification(): void {
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 3000);
  }

  async openAlbum(album: GalleryAlbum, imageId: string | null = null): Promise<void> {
    this.selectedAlbum.set(album);
    let index = 0;
    if (imageId) {
      const found = album.images.findIndex((img) => img.id === imageId);
      if (found !== -1) index = found;
    }
    this.selectedImageIndex.set(index);
    this.updateRouterQuery();
    await this.loadCommentsForCurrentImage();
  }

  closeAlbum(): void {
    this.selectedAlbum.set(null);
    this.selectedImageIndex.set(0);
    this.comments.set([]);
    this.activeMenu.set(null);
    this.router.navigate([], { queryParams: {} });
  }

  async selectImageByIndex(index: number): Promise<void> {
    this.selectedImageIndex.set(index);
    this.updateRouterQuery();
    await this.loadCommentsForCurrentImage();
  }

  prevImage(): void {
    const album = this.selectedAlbum();
    if (!album) return;
    if (this.selectedImageIndex() > 0) {
      this.selectImageByIndex(this.selectedImageIndex() - 1);
    } else {
      this.selectImageByIndex(album.images.length - 1);
    }
  }

  nextImage(): void {
    const album = this.selectedAlbum();
    if (!album) return;
    if (this.selectedImageIndex() < album.images.length - 1) {
      this.selectImageByIndex(this.selectedImageIndex() + 1);
    } else {
      this.selectImageByIndex(0);
    }
  }

  private updateRouterQuery(): void {
    const album = this.selectedAlbum();
    const image = this.currentImage();
    if (!album || !image) return;
    this.router.navigate([], { queryParams: { idAlbum: album.id, idFoto: image.id } });
  }

  shareAlbum(album: GalleryAlbum | null): void {
    if (!album?.id) return;
    const url = `${window.location.origin}/gallery?idAlbum=${album.id}`;
    const message = `"${album.name}" - ¡Mira este álbum de fotos! 📷 ${url}`;
    navigator.clipboard.writeText(message).then(() => this.showToastNotification());
  }

  shareImage(image: GalleryImage | null): void {
    const album = this.selectedAlbum();
    if (!image || !album) return;
    const url = `${window.location.origin}/gallery?idAlbum=${album.id}&idFoto=${image.id}`;
    const message = `"${image.title || 'Foto'}" - ¡Mira esta imagen! 📸 ${url}`;
    navigator.clipboard.writeText(message).then(() => this.showToastNotification());
  }

  private async loadCommentsForCurrentImage(): Promise<void> {
    const album = this.selectedAlbum();
    const image = this.currentImage();
    if (!album || !image) return;
    this.comments.set([]);
    try {
      const comments = await this.api.getImageComments(album.id, image.id);
      this.comments.set(comments);
    } catch (error) {
      console.error('❌ Error al cargar comentarios:', error);
    }
  }

  async addNewComment(): Promise<void> {
    const text = this.newComment().trim();
    if (!text) return;
    const user = this.currentUser();

    const commentData = {
      userId: user ? user.uid : 'guest_' + Date.now(),
      userName: user ? user.displayName || 'Usuario Invitado' : 'Usuario Invitado',
      commentText: text,
      image: user ? user.photoURL || DEFAULT_AVATAR : DEFAULT_AVATAR,
      createdAt: new Date().toISOString(),
    };

    const album = this.selectedAlbum();
    const image = this.currentImage();
    if (!album || !image) return;

    try {
      const commentId = await this.api.addImageComment(album.id, image.id, commentData);
      this.comments.update((list) => [...list, { ...commentData, id: commentId }]);
      this.newComment.set('');
    } catch (error) {
      console.error('❌ Error al agregar comentario:', error);
      alert('Error al publicar el comentario');
    }
  }

  async deleteComment(comment: Comment, idx: number): Promise<void> {
    const user = this.currentUser();
    if (!user || user.uid !== comment['userId']) {
      alert('No tienes permiso para eliminar este comentario.');
      return;
    }
    if (!confirm('¿Estás seguro de que deseas eliminar este comentario?')) return;

    const album = this.selectedAlbum();
    const image = this.currentImage();
    if (!album || !image) return;

    try {
      await this.api.deleteCommentGaleria(album.id, image.id, comment.id);
      this.comments.update((list) => list.filter((_, i) => i !== idx));
      this.activeMenu.set(null);
    } catch (error) {
      console.error('❌ Error al eliminar comentario:', error);
    }
  }

  toggleMenu(index: number): void {
    this.activeMenu.set(this.activeMenu() === index ? null : index);
  }
}
