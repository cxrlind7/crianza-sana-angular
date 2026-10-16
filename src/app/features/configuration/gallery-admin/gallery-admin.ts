import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Gallery, GalleryImage } from '../../../core/services/api.service';
import { AwsService } from '../../../core/services/aws.service';
import { activePeople } from '../../../core/utils/people-visibility';
import { parseFlexibleDate, toDateInputValue, toSortableTime } from '../../../core/utils/date-utils';

/** Pedido desde el calendario: abrir un álbum o crear uno con fecha. */
export interface GalleryFocus {
  albumId?: string;
  createDate?: string;
  nonce: number;
}

interface AlbumForm {
  person: string;
  title: string;
  date: string;
  publishAt: string;
}

const GENERAL = 'Crianza Sana';
const UPLOAD_CONCURRENCY = 3;

const pad = (n: number) => String(n).padStart(2, '0');

function toDateTimeInput(value: unknown): string {
  const d = parseFlexibleDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'app-gallery-admin',
  imports: [FormsModule, NgTemplateOutlet],
  templateUrl: './gallery-admin.html',
  styleUrl: './gallery-admin.scss',
})
export class GalleryAdmin {
  private readonly api = inject(ApiService);
  private readonly aws = inject(AwsService);

  readonly focus = input<GalleryFocus | null>(null);

  readonly people = [GENERAL, ...(activePeople as { id: number; name: string }[]).map((p) => p.name)];

  readonly albums = signal<Gallery[]>([]);
  readonly loading = signal(true);
  readonly selectedId = signal<string | null>(null);
  readonly showCreate = signal(false);
  readonly form = signal<AlbumForm>(this.emptyForm());
  readonly files = signal<File[]>([]);
  readonly busy = signal(false);
  readonly progress = signal<{ done: number; total: number } | null>(null);
  readonly message = signal<{ kind: 'success' | 'danger' | 'warning'; text: string } | null>(null);

  readonly sortedAlbums = computed(() =>
    [...this.albums()].sort((a, b) => toSortableTime(b['publishAt'] || b.date) - toSortableTime(a['publishAt'] || a.date)),
  );

  readonly selected = computed(() => this.albums().find((a) => a.id === this.selectedId()) ?? null);

  constructor() {
    this.load();
    effect(() => {
      const f = this.focus();
      if (!f) return;
      untracked(() => {
        if (f.albumId) this.openAlbum(f.albumId);
        else if (f.createDate) this.startCreate(f.createDate);
      });
    });
  }

  private emptyForm(date = toDateInputValue(new Date())): AlbumForm {
    return { person: GENERAL, title: '', date, publishAt: '' };
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.albums.set(await this.api.getGalleries());
    } catch {
      this.message.set({ kind: 'danger', text: 'No se pudieron cargar las galerías.' });
    } finally {
      this.loading.set(false);
    }
  }

  // ------------------------------------------------------------------ Helpers de vista

  splitName(name: string | undefined): { person: string; title: string } {
    const [person, ...rest] = String(name ?? '').split(' - ');
    return rest.length ? { person: person.trim(), title: rest.join(' - ').trim() } : { person: '', title: String(name ?? '') };
  }

  albumDate(album: Gallery): string {
    const d = parseFlexibleDate(album['publishAt'] || album.date);
    return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha';
  }

  isScheduled(album: Gallery): boolean {
    const d = parseFlexibleDate(album['publishAt']);
    return !!d && d.getTime() > Date.now();
  }

  updateForm<K extends keyof AlbumForm>(field: K, value: AlbumForm[K]): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.files.set(Array.from(input.files ?? []).filter((f) => f.type.startsWith('image/')));
  }

  private buildName(form: AlbumForm): string {
    const title = form.title.trim();
    return form.person === GENERAL ? title : `${form.person} - ${title}`;
  }

  /** La fecha del álbum se guarda a mediodía local para que no cambie de día por la zona horaria. */
  private payload(form: AlbumForm): { name: string; date: string; publishAt: string } {
    const date = parseFlexibleDate(form.date) ?? new Date();
    date.setHours(12, 0, 0, 0);
    const publish = form.publishAt ? new Date(form.publishAt) : null;
    return {
      name: this.buildName(form),
      date: date.toISOString(),
      publishAt: publish && !isNaN(publish.getTime()) ? publish.toISOString() : '',
    };
  }

  // ------------------------------------------------------------------ Crear

  startCreate(date?: string): void {
    this.selectedId.set(null);
    this.message.set(null);
    this.files.set([]);
    const form = this.emptyForm(date ?? toDateInputValue(new Date()));
    // Si el día elegido es futuro, se deja programado para ese día a las 9:00.
    if (date && date > toDateInputValue(new Date())) form.publishAt = `${date}T09:00`;
    this.form.set(form);
    this.showCreate.set(true);
  }

  async createAlbum(fileInput: HTMLInputElement): Promise<void> {
    const form = this.form();
    if (!form.title.trim()) {
      this.message.set({ kind: 'danger', text: 'Escribe el título del álbum.' });
      return;
    }
    this.busy.set(true);
    this.message.set(null);
    try {
      const id = await this.api.createGallery(this.payload(form));
      if (!id) throw new Error('create');
      const failed = await this.uploadPhotos(id, this.files());
      fileInput.value = '';
      this.files.set([]);
      this.showCreate.set(false);
      await this.load();
      this.selectedId.set(id);
      this.message.set(
        failed
          ? { kind: 'warning', text: `Álbum creado, pero ${failed} foto(s) no se pudieron subir.` }
          : { kind: 'success', text: 'Álbum creado.' },
      );
    } catch {
      this.message.set({ kind: 'danger', text: 'No se pudo crear el álbum. Intenta de nuevo.' });
    } finally {
      this.busy.set(false);
      this.progress.set(null);
    }
  }

  /** Sube las fotos de pocas en pocas y devuelve cuántas fallaron. */
  private async uploadPhotos(albumId: string, files: File[]): Promise<number> {
    if (!files.length) return 0;
    let done = 0;
    let failed = 0;
    this.progress.set({ done, total: files.length });
    const queue = [...files];
    const worker = async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        const url = await this.aws.uploadFile(file, 'gallery');
        const ok = url ? await this.api.addGalleryPhoto(albumId, { url, title: '' }) : null;
        if (!ok) failed++;
        this.progress.set({ done: ++done, total: files.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker));
    return failed;
  }

  // ------------------------------------------------------------------ Editar

  openAlbum(id: string): void {
    this.showCreate.set(false);
    this.message.set(null);
    this.selectedId.set(id);
    const album = this.albums().find((a) => a.id === id);
    if (album) this.fillForm(album);
    else this.load().then(() => this.selected() && this.fillForm(this.selected()!));
  }

  private fillForm(album: Gallery): void {
    const { person, title } = this.splitName(album.name);
    this.form.set({
      person: this.people.includes(person) ? person : GENERAL,
      title: this.people.includes(person) ? title : album.name,
      date: toDateInputValue(album.date),
      publishAt: toDateTimeInput(album['publishAt']),
    });
  }

  closeAlbum(): void {
    this.selectedId.set(null);
    this.message.set(null);
  }

  async saveAlbum(): Promise<void> {
    const album = this.selected();
    if (!album || !this.form().title.trim()) return;
    this.busy.set(true);
    const ok = await this.api.updateGallery(album.id, this.payload(this.form()));
    this.busy.set(false);
    if (ok) {
      await this.load();
      this.message.set({ kind: 'success', text: 'Cambios guardados.' });
    } else {
      this.message.set({ kind: 'danger', text: 'No se pudieron guardar los cambios.' });
    }
  }

  async addPhotos(fileInput: HTMLInputElement): Promise<void> {
    const album = this.selected();
    if (!album || !this.files().length) return;
    this.busy.set(true);
    const failed = await this.uploadPhotos(album.id, this.files());
    fileInput.value = '';
    this.files.set([]);
    this.busy.set(false);
    this.progress.set(null);
    await this.load();
    if (failed) this.message.set({ kind: 'warning', text: `${failed} foto(s) no se pudieron subir.` });
  }

  async saveCaption(image: GalleryImage, title: string): Promise<void> {
    const album = this.selected();
    if (!album || (image.title ?? '') === title.trim()) return;
    if (await this.api.updateGalleryPhoto(album.id, image.id, title)) {
      image.title = title.trim();
    }
  }

  async removePhoto(image: GalleryImage): Promise<void> {
    const album = this.selected();
    if (!album || !confirm('¿Quitar esta foto del álbum?')) return;
    if (await this.api.deleteGalleryPhoto(album.id, image.id)) {
      this.albums.update((list) =>
        list.map((a) => (a.id === album.id ? { ...a, images: a.images.filter((i) => i.id !== image.id) } : a)),
      );
    }
  }

  async removeAlbum(): Promise<void> {
    const album = this.selected();
    if (!album || !confirm(`¿Eliminar el álbum "${album.name}" y todas sus fotos? No se puede deshacer.`)) return;
    if (await this.api.deleteGallery(album.id)) {
      this.selectedId.set(null);
      this.albums.update((list) => list.filter((a) => a.id !== album.id));
      this.message.set({ kind: 'success', text: 'Álbum eliminado.' });
    } else {
      this.message.set({ kind: 'danger', text: 'No se pudo eliminar el álbum.' });
    }
  }
}
