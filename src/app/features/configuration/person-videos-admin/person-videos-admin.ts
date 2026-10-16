import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, ShortVideo, ShortVideoType } from '../../../core/services/api.service';
import { AwsService } from '../../../core/services/aws.service';
import { getActivePeople } from '../../../core/utils/people-visibility';
import { captureVideoPoster } from '../../../core/utils/video-poster';

interface VideoTypeMeta {
  key: ShortVideoType;
  label: string;
  icon: string;
  help: string;
  /** Solo se muestra uno por especialista; subir otro reemplaza al anterior. */
  single: boolean;
}

const VIDEO_TYPES: VideoTypeMeta[] = [
  {
    key: 'conociendo',
    label: 'Conociendo a…',
    icon: 'bi-person-video2',
    help: 'Presentación personal. Se abre con el botón "Conociendo a…" junto a su foto.',
    single: true,
  },
  {
    key: 'negocio',
    label: 'Su espacio / negocio',
    icon: 'bi-shop',
    help: 'Recorrido por su consultorio o negocio. Aparece destacado en la sección "Mi espacio".',
    single: true,
  },
  {
    key: 'educativo',
    label: 'Clips educativos',
    icon: 'bi-collection-play',
    help: 'Videos cortos con consejos. Se muestran en un carrusel y se abren en ventana emergente.',
    single: false,
  },
];

/** Tamaño a partir del cual se avisa: los videos pesados tardan en cargar en celular. */
const HEAVY_VIDEO_MB = 150;

@Component({
  selector: 'app-person-videos-admin',
  imports: [FormsModule],
  templateUrl: './person-videos-admin.html',
  styleUrl: './person-videos-admin.scss',
})
export class PersonVideosAdmin {
  private readonly api = inject(ApiService);
  private readonly aws = inject(AwsService);

  get people(): { id: number; name: string; image: string; color?: string }[] {
    return getActivePeople();
  }
  readonly types = VIDEO_TYPES;

  readonly selectedPersonId = signal<number | null>(null);
  readonly videos = signal<ShortVideo[]>([]);
  readonly loading = signal(false);

  // Formulario de subida
  readonly uploadType = signal<ShortVideoType>('educativo');
  readonly uploadTitle = signal('');
  readonly uploadFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly progress = signal(0);
  readonly uploadStep = signal('');
  readonly message = signal<{ kind: 'success' | 'danger' | 'warning'; text: string } | null>(null);

  readonly editingId = signal<string | null>(null);
  readonly editTitle = signal('');

  readonly selectedPerson = computed(() => this.people.find((p) => p.id === this.selectedPersonId()) ?? null);

  readonly videosByType = computed(() => {
    const list = this.videos();
    return Object.fromEntries(
      VIDEO_TYPES.map((t) => [t.key, list.filter((v) => (v.tipo ?? 'educativo') === t.key)]),
    ) as Record<ShortVideoType, ShortVideo[]>;
  });

  readonly fileInfo = computed(() => {
    const file = this.uploadFile();
    if (!file) return null;
    const mb = file.size / (1024 * 1024);
    return { name: file.name, size: mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`, heavy: mb > HEAVY_VIDEO_MB };
  });

  readonly uploadTypeMeta = computed(() => VIDEO_TYPES.find((t) => t.key === this.uploadType())!);

  async selectPerson(id: number): Promise<void> {
    this.selectedPersonId.set(id);
    this.message.set(null);
    this.resetForm();
    await this.loadVideos();
  }

  private async loadVideos(): Promise<void> {
    const id = this.selectedPersonId();
    if (id === null) return;
    this.loading.set(true);
    const list = await this.api.getShortVideos(id);
    this.videos.set(list);
    this.loading.set(false);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.message.set(null);
    if (file && !file.type.startsWith('video/')) {
      this.message.set({ kind: 'danger', text: 'El archivo no es un video.' });
      input.value = '';
      return;
    }
    this.uploadFile.set(file);
  }

  async upload(fileInput: HTMLInputElement): Promise<void> {
    const person = this.selectedPerson();
    const file = this.uploadFile();
    if (!person || !file || this.uploading()) return;

    const type = this.uploadTypeMeta();
    const replaced = type.single ? this.videosByType()[type.key] : [];
    this.uploading.set(true);
    this.progress.set(0);
    this.message.set(null);

    try {
      // 1. Miniatura: se saca del propio video, sin pedir otra imagen.
      this.uploadStep.set('Preparando miniatura…');
      const capture = await captureVideoPoster(file);
      let poster = '';
      if (capture) {
        poster = (await this.aws.uploadFile(capture.poster, 'video-poster')) ?? '';
      }

      // 2. Video, con barra de avance.
      this.uploadStep.set('Subiendo video…');
      const url = await this.aws.uploadFileWithProgress(file, `video-${type.key}`, (pct) => this.progress.set(pct));
      if (!url) throw new Error('upload');

      // 3. Registro en Firestore; los clips nuevos van al final del carrusel.
      this.uploadStep.set('Guardando…');
      const lastOrder = Math.max(0, ...this.videos().map((v) => v.orden ?? 0));
      const id = await this.api.createShortVideo({
        personId: String(person.id),
        title: this.uploadTitle().trim(),
        url,
        poster,
        tipo: type.key,
        orden: lastOrder + 1,
      });
      if (!id) throw new Error('save');

      // 4. "Conociendo a…" y "Su espacio" son únicos: el nuevo reemplaza al anterior.
      for (const old of replaced) await this.api.deleteShortVideo(old.id);

      this.message.set({
        kind: capture ? 'success' : 'warning',
        text: capture
          ? `Video subido a "${type.label}" de ${person.name}.`
          : 'Video subido, pero este navegador no pudo leerlo para sacar la miniatura. Puede que no se reproduzca en todos los navegadores: de preferencia usa MP4 (H.264).',
      });
      this.resetForm();
      fileInput.value = '';
      await this.loadVideos();
    } catch {
      this.message.set({ kind: 'danger', text: 'No se pudo subir el video. Revisa tu conexión e intenta de nuevo.' });
    } finally {
      this.uploading.set(false);
      this.uploadStep.set('');
    }
  }

  startEdit(video: ShortVideo): void {
    this.editingId.set(video.id);
    this.editTitle.set(video.title);
  }

  async saveTitle(video: ShortVideo): Promise<void> {
    const title = this.editTitle().trim();
    if (await this.api.updateShortVideo(video.id, { title })) {
      this.videos.update((list) => list.map((v) => (v.id === video.id ? { ...v, title } : v)));
    }
    this.editingId.set(null);
  }

  /** Mueve un clip una posición en el carrusel intercambiando su orden con el vecino. */
  async move(video: ShortVideo, direction: -1 | 1): Promise<void> {
    const clips = this.videosByType()['educativo'];
    const index = clips.findIndex((v) => v.id === video.id);
    const other = clips[index + direction];
    if (!other) return;
    // Si dos clips comparten orden (datos viejos), se normaliza a su posición.
    const a = video.orden ?? index;
    const b = other.orden === a ? index + direction : (other.orden ?? index + direction);
    await Promise.all([this.api.updateShortVideo(video.id, { orden: b }), this.api.updateShortVideo(other.id, { orden: a })]);
    await this.loadVideos();
  }

  async remove(video: ShortVideo): Promise<void> {
    if (!confirm(`¿Eliminar el video "${video.title || 'sin título'}"? Ya no se verá en el perfil.`)) return;
    if (await this.api.deleteShortVideo(video.id)) {
      this.videos.update((list) => list.filter((v) => v.id !== video.id));
    } else {
      this.message.set({ kind: 'danger', text: 'No se pudo eliminar el video.' });
    }
  }

  private resetForm(): void {
    this.uploadTitle.set('');
    this.uploadFile.set(null);
    this.progress.set(0);
  }
}
