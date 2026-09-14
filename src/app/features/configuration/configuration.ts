import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  Ad,
  Banner,
  Blog,
  CampaignData,
  EventItem,
  Programa,
  Subscriber,
  Video,
} from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { AwsService } from '../../core/services/aws.service';
import { people } from '../../core/data/people-data';
import { environment } from '../../../environments/environment';

type CollectionKey = 'ad' | 'banner' | 'blogs' | 'campana' | 'eventos' | 'programas' | 'temas' | 'suscriptores';
type ModalType = 'blog' | 'ad' | 'banner' | 'evento' | 'video' | '';

interface CollectionMeta {
  key: CollectionKey;
  label: string;
  icon: string;
}

interface TemasData {
  id: string | null;
  temas: string[];
  colores: { primario: string; secundario: string; titulo: string };
  evento: { fecha: string; hora: string; mensaje: string };
  participantes: number[];
}

const COLLECTIONS: CollectionMeta[] = [
  { key: 'ad', label: 'Anuncios', icon: '📢' },
  { key: 'banner', label: 'Banners', icon: '🖼️' },
  { key: 'blogs', label: 'Blogs', icon: '✍️' },
  { key: 'campana', label: 'Campañas', icon: '📣' },
  { key: 'eventos', label: 'Eventos', icon: '📅' },
  { key: 'programas', label: 'Programas', icon: '🎬' },
  { key: 'temas', label: 'Temas', icon: '🎨' },
  { key: 'suscriptores', label: 'Suscriptores', icon: '📧' },
];

const MODAL_TYPE_LABELS: Record<string, string> = {
  blog: 'Blog',
  ad: 'Anuncio',
  banner: 'Banner',
  evento: 'Evento',
  video: 'Programa',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModalData = Record<string, any>;

@Component({
  selector: 'app-configuration',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './configuration.html',
  styleUrl: './configuration.scss',
})
export class Configuration {
  private readonly api = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly aws = inject(AwsService);

  readonly isUploadingImage = signal(false);
  readonly uploadError = signal<string | null>(null);

  @ViewChild('richEditor') richEditorRef?: ElementRef<HTMLDivElement>;

  readonly currentUser = this.authService.currentUser;
  readonly collections = COLLECTIONS;
  readonly allPeople = people as { id: number; name: string; image: string }[];

  readonly currentCollection = signal<CollectionKey>('blogs');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isSaving = signal(false);

  readonly blogs = signal<Blog[]>([]);
  readonly expandedIndex = signal<number | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly currentPage = signal(1);
  readonly itemsPerPage = 10;

  readonly ads = signal<Ad[]>([]);
  readonly banners = signal<Banner[]>([]);
  readonly campanas = signal<(CampaignData & { id: string; finalDate?: string })[]>([]);
  readonly eventos = signal<EventItem[]>([]);

  readonly videos = signal<Video[]>([]);
  readonly videoExpandedIndex = signal<number | null>(null);
  readonly videoSearch = signal('');

  readonly temasData = signal<TemasData>({
    id: null,
    temas: [],
    colores: { primario: '#4a1a1a', secundario: '#fcd34d', titulo: '#ffffff' },
    evento: { fecha: '', hora: '', mensaje: '' },
    participantes: [],
  });

  readonly subscribers = signal<Subscriber[]>([]);
  readonly subscribersLoading = signal(false);
  readonly subscribersError = signal<string | null>(null);
  readonly newsletter = signal({ type: 'blog', title: '', description: '', link: '' });
  readonly isSendingNewsletter = signal(false);
  readonly newsletterResult = signal<{ success: boolean; sent?: number; errors?: number; error?: string } | null>(null);

  readonly showModal = signal(false);
  readonly modalMode = signal<'create' | 'edit'>('create');
  readonly modalType = signal<ModalType>('');
  readonly modalData = signal<ModalData>({});
  readonly isSubmitting = signal(false);
  readonly editorTab = signal<'editor' | 'preview'>('editor');

  readonly isAdmin = computed(() => {
    const email = this.currentUser()?.email;
    return !!email && environment.adminEmails.includes(email);
  });

  readonly currentCollectionLabel = computed(
    () => this.collections.find((c) => c.key === this.currentCollection())?.label ?? 'General',
  );
  readonly currentCollectionIcon = computed(
    () => this.collections.find((c) => c.key === this.currentCollection())?.icon ?? '📄',
  );

  readonly filteredBlogs = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.blogs();
    return this.blogs().filter(
      (b) => b.title?.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q),
    );
  });

  readonly totalPages = computed(() => Math.ceil(this.filteredBlogs().length / this.itemsPerPage));

  readonly paginatedBlogs = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    return this.filteredBlogs().slice(start, start + this.itemsPerPage);
  });

  readonly filteredVideos = computed(() => {
    const q = this.videoSearch().toLowerCase();
    if (!q) return this.videos();
    return this.videos().filter((v) => (v['title'] as string)?.toLowerCase().includes(q));
  });

  readonly modalTypeLabel = computed(() => MODAL_TYPE_LABELS[this.modalType()] || this.modalType());

  constructor() {
    if (this.isAdmin()) {
      this.fetchBlogs();
    }
  }

  switchCollection(key: CollectionKey): void {
    this.currentCollection.set(key);
    this.expandedIndex.set(null);
    this.videoExpandedIndex.set(null);
    this.editingId.set(null);
    this.searchQuery.set('');
    this.videoSearch.set('');
    this.currentPage.set(1);
    this.loadCollection(key);
  }

  private async loadCollection(key: CollectionKey): Promise<void> {
    switch (key) {
      case 'blogs':
        if (this.blogs().length === 0) await this.fetchBlogs();
        break;
      case 'ad':
        await this.fetchAds();
        break;
      case 'banner':
        await this.fetchBanners();
        break;
      case 'campana':
        await this.fetchCampanas();
        break;
      case 'eventos':
        await this.fetchEventos();
        break;
      case 'programas':
        await this.fetchVideos();
        break;
      case 'temas':
        await this.fetchTemas();
        break;
      case 'suscriptores':
        await this.fetchSubscribers();
        break;
    }
  }

  private async fetchBlogs(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.blogs.set(await this.api.getBlogs());
    } catch {
      this.error.set('Error al cargar blogs.');
    } finally {
      this.loading.set(false);
    }
  }

  async saveBlog(blog: Blog): Promise<void> {
    this.isSaving.set(true);
    try {
      const ok = await this.api.updateBlog(blog.id, blog);
      if (ok) {
        this.editingId.set(null);
        alert('Blog guardado correctamente');
      } else {
        alert('Error al guardar el blog');
      }
    } catch {
      alert('Error inesperado al guardar');
    } finally {
      this.isSaving.set(false);
    }
  }

  private async fetchAds(): Promise<void> {
    this.loading.set(true);
    try {
      this.ads.set(await this.api.getAllAds());
    } catch {
      this.error.set('Error al cargar anuncios.');
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchBanners(): Promise<void> {
    this.loading.set(true);
    try {
      this.banners.set(await this.api.getAllBanners());
    } catch {
      this.error.set('Error al cargar banners.');
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchCampanas(): Promise<void> {
    this.loading.set(true);
    try {
      this.campanas.set(await this.api.getAllCampanas() as (CampaignData & { id: string; finalDate?: string })[]);
    } catch {
      this.error.set('Error al cargar campañas.');
    } finally {
      this.loading.set(false);
    }
  }

  async saveCampana(camp: CampaignData & { id: string; finalDate?: string }): Promise<void> {
    this.isSaving.set(true);
    try {
      const ok = await this.api.updateCampana(camp.id, { img: camp.img, finalDate: camp.finalDate } as Partial<CampaignData>);
      if (ok) alert('Campaña guardada correctamente');
      else alert('Error al guardar campaña');
    } catch {
      alert('Error inesperado');
    } finally {
      this.isSaving.set(false);
    }
  }

  private async fetchEventos(): Promise<void> {
    this.loading.set(true);
    try {
      this.eventos.set(await this.api.getAllEventos());
    } catch {
      this.error.set('Error al cargar eventos.');
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchVideos(): Promise<void> {
    this.loading.set(true);
    try {
      this.videos.set(await this.api.getVideos());
    } catch {
      this.error.set('Error al cargar programas.');
    } finally {
      this.loading.set(false);
    }
  }

  async saveVideo(video: Video): Promise<void> {
    this.isSaving.set(true);
    try {
      const ok = await this.api.updateVideo(video.id, video);
      if (ok) {
        this.editingId.set(null);
        alert('Programa guardado correctamente');
      } else {
        alert('Error al guardar');
      }
    } catch {
      alert('Error inesperado');
    } finally {
      this.isSaving.set(false);
    }
  }

  private async fetchTemas(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const programs = await this.api.getPrograms();
      if (programs?.length > 0) {
        const p = programs[0] as Programa;
        this.temasData.set({
          id: p.id,
          temas: p.temas || [],
          colores: (p.colores as TemasData['colores']) || { primario: '#4a1a1a', secundario: '#fcd34d', titulo: '#ffffff' },
          evento: (p.evento as TemasData['evento']) || { fecha: '', hora: '', mensaje: '' },
          participantes: p.participantes || [],
        });
      }
    } catch {
      this.error.set('Error al cargar temas.');
    } finally {
      this.loading.set(false);
    }
  }

  addTema(): void {
    this.temasData.update((t) => ({ ...t, temas: [...t.temas, ''] }));
  }

  updateTema(index: number, value: string): void {
    this.temasData.update((t) => {
      const temas = [...t.temas];
      temas[index] = value;
      return { ...t, temas };
    });
  }

  removeTema(index: number): void {
    this.temasData.update((t) => ({ ...t, temas: t.temas.filter((_, i) => i !== index) }));
  }

  toggleParticipant(personId: number): void {
    this.temasData.update((t) => {
      const idx = t.participantes.indexOf(personId);
      const participantes =
        idx === -1 ? [...t.participantes, personId] : t.participantes.filter((id) => id !== personId);
      return { ...t, participantes };
    });
  }

  updateTemasField<K extends keyof TemasData>(field: K, value: TemasData[K]): void {
    this.temasData.update((t) => ({ ...t, [field]: value }));
  }

  updateTemasColor(colorField: keyof TemasData['colores'], value: string): void {
    this.temasData.update((t) => ({ ...t, colores: { ...t.colores, [colorField]: value } }));
  }

  updateTemasEvento(field: keyof TemasData['evento'], value: string): void {
    this.temasData.update((t) => ({ ...t, evento: { ...t.evento, [field]: value } }));
  }

  async saveTemas(): Promise<void> {
    const data = this.temasData();
    if (!data.id) return;
    this.isSaving.set(true);
    try {
      const payload = { ...data, id: data.id, temas: data.temas.filter((t) => t.trim()) };
      const ok = await this.api.updateProgram(data.id, payload as Partial<Programa>);
      if (ok) alert('Temas guardados correctamente');
      else alert('Error al guardar Temas');
    } catch {
      alert('Error inesperado al guardar Temas');
    } finally {
      this.isSaving.set(false);
    }
  }

  private async fetchSubscribers(): Promise<void> {
    this.subscribersLoading.set(true);
    this.subscribersError.set(null);
    try {
      this.subscribers.set(await this.api.getSubscribers());
    } catch {
      this.subscribersError.set('Error al cargar suscriptores.');
    } finally {
      this.subscribersLoading.set(false);
    }
  }

  refreshSubscribers(): void {
    this.fetchSubscribers();
  }

  async removeSubscriber(id: string): Promise<void> {
    if (!confirm('¿Eliminar este suscriptor?')) return;
    const ok = await this.api.deleteSubscriber(id);
    if (ok) this.subscribers.update((list) => list.filter((s) => s.id !== id));
    else alert('Error al eliminar suscriptor');
  }

  updateNewsletterField(field: 'type' | 'title' | 'description' | 'link', value: string): void {
    this.newsletter.update((n) => ({ ...n, [field]: value }));
  }

  async triggerNewsletter(): Promise<void> {
    const n = this.newsletter();
    if (!n.title.trim()) {
      alert('Escribe un título');
      return;
    }
    this.isSendingNewsletter.set(true);
    this.newsletterResult.set(null);
    try {
      this.newsletterResult.set(await this.api.sendNewsletter(n));
    } catch {
      this.newsletterResult.set({ success: false, error: 'Error al enviar' });
    } finally {
      this.isSendingNewsletter.set(false);
    }
  }

  async deleteItem(type: 'ad' | 'banner' | 'evento' | 'video', id: string): Promise<void> {
    if (!confirm('¿Eliminar este elemento? Esta acción no se puede deshacer.')) return;
    let ok = false;
    if (type === 'ad') ok = await this.api.deleteAd(id);
    else if (type === 'banner') ok = await this.api.deleteBanner(id);
    else if (type === 'evento') ok = await this.api.deleteEvento(id);
    else if (type === 'video') ok = await this.api.deleteVideo(id);

    if (ok) {
      if (type === 'ad') this.ads.update((list) => list.filter((i) => i.id !== id));
      else if (type === 'banner') this.banners.update((list) => list.filter((i) => i.id !== id));
      else if (type === 'evento') this.eventos.update((list) => list.filter((i) => i.id !== id));
      else if (type === 'video') this.videos.update((list) => list.filter((i) => i.id !== id));
    } else {
      alert('Error al eliminar');
    }
  }

  openCreateModal(type: ModalType): void {
    this.modalMode.set('create');
    this.modalType.set(type);
    const defaults: Record<string, ModalData> = {
      blog: {
        title: '',
        description: '',
        authorName: '',
        dateInput: new Date().toISOString().split('T')[0],
        category: '',
        categoryColor: '#000000',
        imageUrl: '',
        text: '',
        orden: 0,
        publishAt: '',
      },
      ad: { imageSrc: '', altText: '', active: 'true', publishAt: '' },
      banner: { imageSrc: '', altText: '', active: 'true', publishAt: '' },
      evento: {
        imageSrc: '',
        altText: '',
        message: '',
        buttonText: '',
        phone: '',
        type: 'call',
        showButton: 'true',
        publishAt: '',
      },
      video: { title: '', date: '', url: '', thumbnail: '', participant: '', description: '', publishAt: '' },
    };
    this.modalData.set({ ...defaults[type] });
    this.editorTab.set('editor');
    this.showModal.set(true);
    if (type === 'blog') {
      setTimeout(() => {
        if (this.richEditorRef) this.richEditorRef.nativeElement.innerHTML = this.modalData()['text'] || '';
      });
    }
  }

  openEditModal(type: ModalType, item: ModalData): void {
    this.modalMode.set('edit');
    this.modalType.set(type);
    const data: ModalData = { ...item };
    if (data['publishAt']) {
      data['publishAt'] = this.formatDateTimeForInput(data['publishAt']);
    }
    this.modalData.set(data);
    this.editorTab.set('editor');
    this.showModal.set(true);
    if (type === 'blog') {
      setTimeout(() => {
        if (this.richEditorRef) this.richEditorRef.nativeElement.innerHTML = this.modalData()['text'] || '';
      });
    }
  }

  closeModal(): void {
    this.showModal.set(false);
    this.modalData.set({});
  }

  updateModalField(field: string, value: unknown): void {
    this.modalData.update((d) => ({ ...d, [field]: value }));
  }

  async onImageFileSelected(event: Event, field: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isUploadingImage.set(true);
    this.uploadError.set(null);
    try {
      const publicUrl = await this.aws.uploadFile(file, this.modalType() || 'uploads');
      if (publicUrl) {
        this.updateModalField(field, publicUrl);
      } else {
        this.uploadError.set('No se pudo subir la imagen. Intenta de nuevo.');
      }
    } finally {
      this.isUploadingImage.set(false);
      input.value = '';
    }
  }

  syncEditorContent(): void {
    if (this.richEditorRef) this.updateModalField('text', this.richEditorRef.nativeElement.innerHTML);
  }

  execFormat(command: string): void {
    this.richEditorRef?.nativeElement.focus();
    document.execCommand(command, false);
    this.syncEditorContent();
  }

  formatBlock(tag: string): void {
    this.richEditorRef?.nativeElement.focus();
    document.execCommand('formatBlock', false, tag);
    this.syncEditorContent();
  }

  insertBlockquote(): void {
    this.richEditorRef?.nativeElement.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const selectedText = range.toString() || 'Escribe tu cita aquí...';
      const bq = document.createElement('blockquote');
      bq.textContent = selectedText;
      range.deleteContents();
      range.insertNode(bq);
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      bq.after(p);
      const newRange = document.createRange();
      newRange.setStart(p, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    this.syncEditorContent();
  }

  insertLink(): void {
    const url = prompt('URL del enlace:');
    if (url) {
      this.richEditorRef?.nativeElement.focus();
      document.execCommand('createLink', false, url);
      this.syncEditorContent();
    }
  }

  clearEditorFormat(): void {
    this.richEditorRef?.nativeElement.focus();
    document.execCommand('removeFormat', false);
    this.syncEditorContent();
  }

  handlePaste(e: ClipboardEvent): void {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
    this.syncEditorContent();
  }

  async submitModal(): Promise<void> {
    this.isSubmitting.set(true);
    try {
      if (this.modalMode() === 'create') {
        await this.createItem();
      } else {
        await this.editItem();
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private normalizeModalPublishAt(): void {
    const data = this.modalData();
    if (data['publishAt']) {
      const d = new Date(data['publishAt']);
      this.updateModalField('publishAt', isNaN(d.getTime()) ? '' : d.toISOString());
    }
  }

  private async createItem(): Promise<void> {
    this.normalizeModalPublishAt();
    const type = this.modalType();
    let newId: string | null = null;

    if (type === 'blog') {
      const data = { ...this.modalData() };
      data['date'] = data['dateInput'] ? new Date(data['dateInput']).toISOString() : new Date().toISOString();
      delete data['dateInput'];
      newId = await this.api.createBlog(data);
      if (newId) await this.fetchBlogs();
    } else if (type === 'ad') {
      newId = await this.api.createAd(this.modalData());
      if (newId) await this.fetchAds();
    } else if (type === 'banner') {
      newId = await this.api.createBanner(this.modalData());
      if (newId) await this.fetchBanners();
    } else if (type === 'evento') {
      newId = await this.api.createEvento(this.modalData());
      if (newId) await this.fetchEventos();
    } else if (type === 'video') {
      newId = await this.api.createVideo(this.modalData());
      if (newId) await this.fetchVideos();
    }

    if (newId) {
      alert(`${this.modalTypeLabel()} creado correctamente`);
      this.closeModal();
    } else {
      alert(`Error al crear ${this.modalTypeLabel()}`);
    }
  }

  private async editItem(): Promise<void> {
    this.normalizeModalPublishAt();
    const type = this.modalType();
    const data = this.modalData();
    const id = data['id'];
    let ok = false;

    if (type === 'ad') {
      ok = await this.api.updateAd(id, data);
      if (ok) this.ads.update((list) => list.map((a) => (a.id === id ? { ...(data as Ad) } : a)));
    } else if (type === 'banner') {
      ok = await this.api.updateBanner(id, data);
      if (ok) this.banners.update((list) => list.map((b) => (b.id === id ? { ...(data as Banner) } : b)));
    } else if (type === 'evento') {
      ok = await this.api.updateEvento(id, data);
      if (ok) this.eventos.update((list) => list.map((e) => (e.id === id ? { ...(data as EventItem) } : e)));
    } else if (type === 'video') {
      ok = await this.api.updateVideo(id, data);
      if (ok) await this.fetchVideos();
    }

    if (ok) {
      alert(`${this.modalTypeLabel()} actualizado correctamente`);
      this.closeModal();
    } else {
      alert(`Error al actualizar ${this.modalTypeLabel()}`);
    }
  }

  toggleExpand(index: number): void {
    this.expandedIndex.set(this.expandedIndex() === index ? null : index);
  }

  toggleVideoExpand(index: number): void {
    this.videoExpandedIndex.set(this.videoExpandedIndex() === index ? null : index);
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) this.currentPage.update((p) => p + 1);
  }

  prevPage(): void {
    if (this.currentPage() > 1) this.currentPage.update((p) => p - 1);
  }

  private parseDate(dateField: unknown): Date | null {
    if (!dateField) return null;
    const d = dateField as { seconds?: number; _seconds?: number };
    if (d.seconds || d._seconds) return new Date((d.seconds || d._seconds || 0) * 1000);
    const parsed = new Date(dateField as string);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  formatDate(dateString: unknown): string {
    const d = this.parseDate(dateString);
    return d ? d.toLocaleDateString() : 'Sin fecha';
  }

  formatDateForInput(dateString: unknown): string {
    const d = this.parseDate(dateString);
    return d ? d.toISOString().split('T')[0] : '';
  }

  updateDate(blog: Blog, value: string): void {
    if (!value) return;
    const d = new Date(value);
    if (!isNaN(d.getTime())) blog.date = d.toISOString();
  }

  updateVideoDate(video: Video, value: string): void {
    video['date'] = value;
  }

  formatDateTimeForInput(dateString: unknown): string {
    const d = this.parseDate(dateString);
    if (!d) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  updatePublishAt(item: { publishAt?: string }, value: string): void {
    item.publishAt = value ? new Date(value).toISOString() : '';
  }

  isScheduled(item: { publishAt?: string } | undefined): boolean {
    if (!item?.publishAt) return false;
    const d = this.parseDate(item.publishAt);
    return !!d && d.getTime() > Date.now();
  }
}
