import { Component, ElementRef, HostListener, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { Efemeride, efemeridesBetween } from '../../../core/data/efemerides';
import { parseFlexibleDate } from '../../../core/utils/date-utils';

export type CalendarKind =
  | 'blog'
  | 'programa'
  | 'evento'
  | 'galeria'
  | 'banner'
  | 'anuncio'
  | 'campana'
  | 'envivo'
  | 'efemeride'
  | 'festivo';

/** Lo que se puede crear desde un día del calendario. */
export type CalendarCreateKind = 'blog' | 'programa' | 'evento' | 'galeria' | 'banner' | 'anuncio';

export interface CalendarEntry {
  key: string;
  kind: CalendarKind;
  title: string;
  date: Date;
  /** Hora visible solo cuando la fecha la trae (publicación programada, programa en vivo). */
  time: string;
  status: 'programado' | 'publicado' | 'inactivo' | 'referencia';
  subtitle?: string;
  description?: string;
  image?: string;
  link?: string;
  efemeride?: Efemeride;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item?: any;
}

interface KindMeta {
  label: string;
  icon: string;
  color: string;
  creatable?: boolean;
}

export const KIND_META: Record<CalendarKind, KindMeta> = {
  blog: { label: 'Blog', icon: 'bi-journal-richtext', color: '#7c3aed', creatable: true },
  programa: { label: 'Programa', icon: 'bi-camera-reels', color: '#db2777', creatable: true },
  evento: { label: 'Evento', icon: 'bi-megaphone', color: '#ea580c', creatable: true },
  galeria: { label: 'Galería', icon: 'bi-images', color: '#0891b2', creatable: true },
  banner: { label: 'Banner', icon: 'bi-window-desktop', color: '#2563eb', creatable: true },
  anuncio: { label: 'Anuncio', icon: 'bi-badge-ad', color: '#16a34a', creatable: true },
  campana: { label: 'Fin de campaña', icon: 'bi-flag', color: '#ca8a04' },
  envivo: { label: 'Programa en vivo', icon: 'bi-broadcast', color: '#be185d' },
  efemeride: { label: 'Efeméride', icon: 'bi-stars', color: '#0f766e' },
  festivo: { label: 'Día festivo', icon: 'bi-calendar-heart', color: '#dc2626' },
};

const CREATE_ORDER: CalendarCreateKind[] = ['blog', 'programa', 'evento', 'galeria', 'banner', 'anuncio'];
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_CHIPS = 3;
const FILTERS_KEY = 'cfg-calendar-hidden-kinds';

interface DayCell {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  entries: CalendarEntry[];
  festivo?: CalendarEntry;
}

interface Popover {
  mode: 'entry' | 'day';
  entry?: CalendarEntry;
  day?: DayCell;
  top: number;
  left: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function stripHtml(html: unknown): string {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "7:00 PM", "19:00" o "7 pm" → "19:00" (la hora del programa en vivo se escribe a mano en Temas). */
export function hora24(value: unknown): string {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?/i.exec(String(value ?? ''));
  if (!m) return '';
  let h = Number(m[1]);
  const min = m[2] ?? '00';
  const sufijo = m[3]?.toLowerCase();
  if (sufijo === 'p' && h < 12) h += 12;
  if (sufijo === 'a' && h === 12) h = 0;
  return h > 23 ? '' : `${pad(h)}:${min}`;
}

function hasTime(value: unknown): boolean {
  return typeof value === 'string' && /T\d{2}:\d{2}/.test(value);
}

@Component({
  selector: 'app-content-calendar',
  templateUrl: './content-calendar.html',
  styleUrl: './content-calendar.scss',
})
export class ContentCalendar {
  private readonly api = inject(ApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Se incrementa desde Configuración cuando algo se guarda, para recargar. */
  readonly refreshKey = input(0);
  readonly create = output<{ kind: CalendarCreateKind; date: string }>();
  readonly edit = output<CalendarEntry>();

  readonly kindMeta = KIND_META;
  readonly weekdays = WEEKDAYS;
  readonly createKinds = CREATE_ORDER;
  readonly legendKinds = Object.keys(KIND_META) as CalendarKind[];
  readonly maxChips = MAX_CHIPS;

  readonly loading = signal(true);
  readonly failed = signal<string[]>([]);
  readonly entries = signal<CalendarEntry[]>([]);
  readonly cursor = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly view = signal<'mes' | 'agenda'>(typeof window !== 'undefined' && window.innerWidth < 768 ? 'agenda' : 'mes');
  readonly hiddenKinds = signal<Set<CalendarKind>>(this.readHiddenKinds());
  readonly popover = signal<Popover | null>(null);

  readonly monthLabel = computed(() => {
    const label = this.cursor().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  /** Semanas visibles (lunes a domingo) que cubren el mes actual. */
  private readonly range = computed(() => {
    const first = this.cursor();
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    const lastOfMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const end = new Date(lastOfMonth);
    end.setDate(lastOfMonth.getDate() + (6 - ((lastOfMonth.getDay() + 6) % 7)));
    end.setHours(23, 59, 59, 999);
    return { start, end };
  });

  private readonly referenceEntries = computed<CalendarEntry[]>(() => {
    const { start, end } = this.range();
    return efemeridesBetween(start, end).map((e, i) => ({
      key: `ef-${dayKey(e.date)}-${i}`,
      kind: e.official ? 'festivo' : 'efemeride',
      title: e.title,
      date: e.date,
      time: '',
      status: 'referencia',
      subtitle: e.area,
      description: e.note,
      efemeride: e,
    }));
  });

  readonly visibleEntries = computed(() => {
    const hidden = this.hiddenKinds();
    return [...this.entries(), ...this.referenceEntries()]
      .filter((e) => !hidden.has(e.kind))
      .sort((a, b) => a.date.getTime() - b.date.getTime() || this.kindRank(a) - this.kindRank(b));
  });

  readonly days = computed<DayCell[]>(() => {
    const { start, end } = this.range();
    const month = this.cursor().getMonth();
    const todayKey = dayKey(new Date());
    const byDay = new Map<string, CalendarEntry[]>();
    for (const entry of this.visibleEntries()) {
      const k = dayKey(entry.date);
      byDay.set(k, [...(byDay.get(k) ?? []), entry]);
    }
    const cells: DayCell[] = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = dayKey(d);
      const entries = byDay.get(key) ?? [];
      cells.push({
        date: new Date(d),
        key,
        inMonth: d.getMonth() === month,
        isToday: key === todayKey,
        isPast: key < todayKey,
        entries: entries.filter((e) => e.kind !== 'festivo'),
        festivo: entries.find((e) => e.kind === 'festivo'),
      });
    }
    return cells;
  });

  /** Vista agenda: solo los días del mes que tienen algo. */
  readonly agenda = computed(() =>
    this.days().filter((d) => d.inMonth && (d.entries.length > 0 || d.festivo)),
  );

  readonly summary = computed(() => {
    const c = this.cursor();
    const inMonth = this.visibleEntries().filter(
      (e) => e.date.getMonth() === c.getMonth() && e.date.getFullYear() === c.getFullYear(),
    );
    return {
      programados: inMonth.filter((e) => e.status === 'programado').length,
      publicados: inMonth.filter((e) => e.status === 'publicado').length,
      efemerides: inMonth.filter((e) => e.kind === 'efemeride').length,
    };
  });

  constructor() {
    effect(() => {
      this.refreshKey();
      untracked(() => this.load());
    });
  }

  // ------------------------------------------------------------------ Carga

  private async load(): Promise<void> {
    this.loading.set(true);
    const sources: [string, () => Promise<(CalendarEntry | null)[]>][] = [
      ['blogs', async () => (await this.api.getBlogs()).map((b) => this.fromBlog(b))],
      ['programas', async () => (await this.api.getVideos()).map((v) => this.fromPrograma(v))],
      ['eventos', async () => (await this.api.getAllEventos()).map((e) => this.fromPromo('evento', e))],
      ['banners', async () => (await this.api.getAllBanners()).map((b) => this.fromPromo('banner', b))],
      ['anuncios', async () => (await this.api.getAllAds()).map((a) => this.fromPromo('anuncio', a))],
      ['galerías', async () => (await this.api.getGalleries()).map((g) => this.fromGaleria(g))],
      ['campañas', async () => (await this.api.getAllCampanas()).map((c) => this.fromCampana(c))],
      ['programa en vivo', async () => (await this.api.getPrograms()).map((p) => this.fromEnVivo(p))],
    ];
    const results = await Promise.allSettled(sources.map(([, fn]) => fn()));
    const failed: string[] = [];
    const entries: CalendarEntry[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') entries.push(...r.value.filter((e): e is CalendarEntry => e !== null));
      else failed.push(sources[i][0]);
    });
    this.entries.set(entries);
    this.failed.set(failed);
    this.loading.set(false);
  }

  private status(date: Date, scheduled: boolean): CalendarEntry['status'] {
    return scheduled && date.getTime() > Date.now() ? 'programado' : 'publicado';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fromBlog(b: any): CalendarEntry {
    const raw = b.publishAt || b.date;
    const date = parseFlexibleDate(raw) ?? new Date(0);
    return {
      key: `blog-${b.id}`,
      kind: 'blog',
      title: b.title || 'Blog sin título',
      date,
      time: b.publishAt && hasTime(b.publishAt) ? this.hhmm(date) : '',
      status: this.status(date, !!b.publishAt),
      subtitle: [b.authorName, b.category].filter(Boolean).join(' · '),
      description: stripHtml(b.description),
      image: b.imageUrl,
      link: `/blog/${b.id}`,
      item: b,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fromPrograma(v: any): CalendarEntry {
    const date = parseFlexibleDate(v.publishAt || v.date) ?? new Date(0);
    return {
      key: `programa-${v.id}`,
      kind: 'programa',
      title: v.title || 'Programa',
      date,
      time: v.publishAt && hasTime(v.publishAt) ? this.hhmm(date) : '',
      status: this.status(date, !!v.publishAt),
      subtitle: v.participant ? `Con ${v.participant}` : '',
      description: stripHtml(v.description),
      image: v.thumbnail,
      link: '/programs',
      item: v,
    };
  }

  /** Eventos, banners y anuncios solo tienen fecha cuando se programan. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fromPromo(kind: 'evento' | 'banner' | 'anuncio', x: any): CalendarEntry | null {
    const date = parseFlexibleDate(x.publishAt);
    if (!date) return null;
    return {
      key: `${kind}-${x.id}`,
      kind,
      title: x.message || x.altText || KIND_META[kind].label,
      date,
      time: this.hhmm(date),
      status: x.active === 'false' ? 'inactivo' : this.status(date, true),
      subtitle: kind === 'evento' && x.buttonText ? `Botón: ${x.buttonText}` : '',
      description: kind === 'evento' ? '' : x.altText,
      image: x.imageSrc,
      link: '/',
      item: x,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fromGaleria(g: any): CalendarEntry {
    const date = parseFlexibleDate(g.publishAt || g.date) ?? new Date(0);
    const [person, ...rest] = String(g.name ?? '').split(' - ');
    const count = g.images?.length ?? 0;
    const photos = `${count} ${count === 1 ? 'foto' : 'fotos'}`;
    return {
      key: `galeria-${g.id}`,
      kind: 'galeria',
      title: rest.length ? rest.join(' - ') : g.name || 'Álbum',
      date,
      time: g.publishAt && hasTime(g.publishAt) ? this.hhmm(date) : '',
      status: this.status(date, !!g.publishAt),
      subtitle: rest.length ? `${person} · ${photos}` : photos,
      image: g.images?.[0]?.url,
      link: `/gallery?idAlbum=${g.id}`,
      item: g,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fromCampana(c: any): CalendarEntry | null {
    // La fecha de fin se captura como DD-MM-YYYY (así la lee el servidor), no MM-DD.
    const dmy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(String(c.finalDate ?? '').trim());
    const date = dmy ? new Date(+dmy[3], +dmy[2] - 1, +dmy[1]) : parseFlexibleDate(c.finalDate);
    if (!date) return null;
    return {
      key: `campana-${c.id}`,
      kind: 'campana',
      title: 'Termina la campaña',
      date,
      time: '',
      status: date.getTime() > Date.now() ? 'programado' : 'publicado',
      subtitle: c.show ? 'Visible en el sitio' : 'Oculta',
      image: c.img,
      item: c,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fromEnVivo(p: any): CalendarEntry | null {
    const date = parseFlexibleDate(p.evento?.fecha);
    if (!date) return null;
    const time = hora24(p.evento?.hora);
    return {
      key: `envivo-${p.id}`,
      kind: 'envivo',
      title: p.evento?.mensaje || 'Programa en vivo',
      date,
      time,
      status: date.getTime() >= new Date().setHours(0, 0, 0, 0) ? 'programado' : 'publicado',
      subtitle: (p.temas ?? []).slice(0, 3).join(' · '),
      link: '/programs',
      item: p,
    };
  }

  private hhmm(d: Date): string {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private kindRank(e: CalendarEntry): number {
    return this.legendKinds.indexOf(e.kind);
  }

  // ------------------------------------------------------------------ Navegación y filtros

  move(months: number): void {
    const c = this.cursor();
    this.cursor.set(new Date(c.getFullYear(), c.getMonth() + months, 1));
    this.popover.set(null);
  }

  goToday(): void {
    const now = new Date();
    this.cursor.set(new Date(now.getFullYear(), now.getMonth(), 1));
    this.popover.set(null);
  }

  toggleKind(kind: CalendarKind): void {
    this.hiddenKinds.update((set) => {
      const next = new Set(set);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      try {
        localStorage.setItem(FILTERS_KEY, JSON.stringify([...next]));
      } catch {
        /* sin almacenamiento: el filtro solo dura esta visita */
      }
      return next;
    });
  }

  private readHiddenKinds(): Set<CalendarKind> {
    try {
      return new Set(JSON.parse(localStorage.getItem(FILTERS_KEY) ?? '[]'));
    } catch {
      return new Set();
    }
  }

  // ------------------------------------------------------------------ Ventanas flotantes

  openEntry(entry: CalendarEntry, event: Event): void {
    event.stopPropagation();
    const anchor = event.currentTarget as HTMLElement;
    // Desde la lista de un día, la ventana se queda donde estaba.
    const pos = this.host.nativeElement.querySelector('.cal-pop')?.contains(anchor) ? this.popover()! : this.place(anchor);
    this.popover.set({ mode: 'entry', entry, top: pos.top, left: pos.left });
    this.fitPopover();
  }

  openDay(day: DayCell, event: Event): void {
    event.stopPropagation();
    this.popover.set({ mode: 'day', day, ...this.place(event.currentTarget as HTMLElement) });
    this.fitPopover();
  }

  /** Ya dibujada, se mide su alto real y se sube lo necesario para que quepa completa. */
  private fitPopover(): void {
    setTimeout(() => {
      const el = this.host.nativeElement.querySelector<HTMLElement>('.cal-pop');
      const pop = this.popover();
      if (!el || !pop || window.innerWidth < 768) return;
      const bottomLimit = window.innerHeight - 12;
      const top = Math.max(74, Math.min(pop.top, bottomLimit - el.offsetHeight));
      if (top !== pop.top) this.popover.set({ ...pop, top });
    });
  }

  /** Coloca la ventana junto al elemento sin salirse de la pantalla. */
  private place(anchor: HTMLElement): { top: number; left: number } {
    const rect = anchor.getBoundingClientRect();
    const width = 340;
    const height = 380;
    const margin = 12;
    // Renglones anchos (agenda): debajo del renglón en lugar de a un lado.
    if (rect.width > width + 60) {
      const below = Math.min(rect.left + 48, window.innerWidth - width - margin);
      return { top: rect.bottom + 6, left: Math.max(margin, below) };
    }
    let left = rect.right + 8;
    if (left + width > window.innerWidth - margin) left = rect.left - width - 8;
    if (left < margin) left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
    let top = rect.top;
    if (top + height > window.innerHeight - margin) top = Math.max(74, window.innerHeight - height - margin);
    return { top, left };
  }

  closePopover(): void {
    this.popover.set(null);
  }

  /** Clic fuera de la ventana flotante la cierra (los clics dentro no se propagan). */
  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closePopover();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.closePopover();
  }

  requestCreate(kind: CalendarCreateKind, day: DayCell | Date): void {
    const date = day instanceof Date ? day : day.date;
    this.closePopover();
    this.create.emit({ kind, date: dayKey(date) });
  }

  /** Botón "Programar" del encabezado: hoy si se ve el mes actual, si no el día 1 del mes visible. */
  createFromToolbar(kind: CalendarCreateKind): void {
    const now = new Date();
    const c = this.cursor();
    const sameMonth = c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth();
    this.requestCreate(kind, sameMonth ? now : c);
  }

  requestEdit(entry: CalendarEntry): void {
    this.closePopover();
    this.edit.emit(entry);
  }

  isEditable(entry: CalendarEntry): boolean {
    return entry.kind !== 'efemeride' && entry.kind !== 'festivo';
  }

  editLabel(entry: CalendarEntry): string {
    if (entry.kind === 'campana') return 'Ir a Campañas';
    if (entry.kind === 'envivo') return 'Ir a Temas';
    if (entry.kind === 'galeria') return 'Administrar álbum';
    return 'Editar';
  }

  statusLabel(entry: CalendarEntry): string {
    const when = entry.date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    const at = entry.time ? ` · ${entry.time}` : '';
    switch (entry.status) {
      case 'programado':
        return entry.kind === 'envivo' ? `Próximo: ${when}${at}` : `Se publica el ${when}${at}`;
      case 'inactivo':
        return `Inactivo · programado el ${when}${at}`;
      case 'referencia':
        return when.charAt(0).toUpperCase() + when.slice(1);
      default:
        return `Publicado el ${when}${at}`;
    }
  }

  dayTitle(day: DayCell): string {
    const label = day.date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
