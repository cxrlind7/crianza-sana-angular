import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Chart from 'chart.js/auto';
import { environment } from '../../../environments/environment';
import { activePeople, isPersonActive } from '../../core/utils/people-visibility';
import { areNamesEquivalent } from '../../core/utils/string-utils';

interface BlogStat {
  visits: number;
  users?: number;
  readTime?: number;
  completeReads?: number;
  listens?: number;
  shares?: number;
  interactions?: number;
  engagementRate: number;
  completeReadRate?: number;
  daily?: Record<string, number>;
}

interface ViewStatEntry {
  views: number;
  users: number;
  avgEngagementPerView?: number;
  engagementRate: number | string;
}

interface PersonViewRow {
  id: number;
  name: string;
  views: number;
  avgEngagementPerView: number;
}

interface LocationRow {
  country: string;
  city: string;
  views: number;
}

interface SiteTotals {
  users: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  avgEngagementPerUser: number;
  engagedSessionsRate: number;
}

interface SiteOverview {
  current: SiteTotals;
  previous: SiteTotals;
  daily: { date: string; users: number; pageViews: number }[];
  devices: { device: string; users: number }[];
}

interface OriginRow {
  origin: string;
  sessions: number;
  users: number;
  engagedRate: number;
  avgTimePerSession: number;
}

interface CountRow {
  label: string;
  count: number;
}

interface SiteEvents {
  totals: Record<string, number>;
  previousTotals: Record<string, number>;
  whatsappByLabel: CountRow[];
  whatsappByPage: CountRow[];
  videos: { title: string; provider: string; plays: number; completed: number }[];
  social: CountRow[];
  quiz: { category: string; started: number; finished: number }[];
  shares: CountRow[];
  downloads: CountRow[];
}

interface Kpi {
  label: string;
  value: string;
  delta: number | null;
  icon: string;
  hint: string;
}

interface TopicRow {
  topic: string;
  blogs: number;
  visits: number;
  avgReadTime: number;
  interactionRate: number;
}

type BlogSortColumn = 'visits' | 'readTime' | 'completeReadRate' | 'listens' | 'shares' | 'engagementRate';

const API_BASE = `${environment.backendUrl}/api`;

const DEVICE_LABELS: Record<string, string> = { mobile: 'Celular', desktop: 'Computadora', tablet: 'Tablet', 'smart tv': 'Smart TV' };

const SECTION_LABELS: Record<string, string> = {
  blog: 'Blog',
  programs: 'Programas',
  gallery: 'Galería',
  about: 'Quiénes somos',
  live: 'En vivo',
  quiz: 'Quiz',
  store: 'Tienda',
};

const SHARE_LABELS: Record<string, string> = {
  clipboard: 'Blog: copiar enlace',
  facebook: 'Blog: Facebook',
  instagram_story_share_api: 'Blog: historia de Instagram',
  instagram_story_download: 'Blog: imagen para historia',
  video_corto: 'Video corto: copiar enlace',
};

@Component({
  selector: 'app-analytics',
  imports: [FormsModule],
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss',
})
export class Analytics implements AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  protected readonly Math = Math;

  @ViewChild('trendChart') trendChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('originsChart') originsChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topicsChart') topicsChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('sectionsChart') sectionsChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('personsChart') personsChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('locationsChart') locationsChartRef?: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  readonly yearStart = `${new Date().getFullYear()}-01-01`;

  readonly isLoading = signal(true);
  readonly failedSections = signal<string[]>([]);
  readonly showFilters = signal(false);
  readonly showBlogTable = signal(true);
  readonly selectedTimeRange = signal('30daysAgo');
  readonly customStartDate = signal('');
  readonly customEndDate = signal('');
  readonly selectedPersonId = signal('');

  readonly sortColumn = signal<BlogSortColumn>('visits');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');

  readonly overview = signal<SiteOverview | null>(null);
  readonly origins = signal<OriginRow[]>([]);
  readonly events = signal<SiteEvents | null>(null);
  readonly stats = signal<Record<string, BlogStat>>({});
  readonly titles = signal<Record<string, string>>({});
  readonly categories = signal<Record<string, string>>({});
  private blogAuthors: Record<string, string> = {};

  readonly blogTrend = signal<{ date: string; views: number }[]>([]);
  readonly sectionStats = signal<[string, ViewStatEntry][]>([]);
  readonly personViews = signal<PersonViewRow[]>([]);
  readonly locationsData = signal<LocationRow[]>([]);

  readonly filteredPeopleList = (activePeople as { id: number; name: string; color?: string }[]).filter(
    (p) => !p.name.toLowerCase().includes('martha elena'),
  );

  // ---------- Resumen ----------

  readonly kpis = computed<Kpi[]>(() => {
    const o = this.overview();
    const e = this.events();
    const list: Kpi[] = [];
    if (o) {
      list.push(
        {
          label: 'Visitantes',
          value: this.formatNumber(o.current.users),
          delta: this.delta(o.current.users, o.previous.users),
          icon: 'fas fa-users',
          hint: `${this.formatNumber(o.current.newUsers)} nuevos`,
        },
        {
          label: 'Páginas vistas',
          value: this.formatNumber(o.current.pageViews),
          delta: this.delta(o.current.pageViews, o.previous.pageViews),
          icon: 'fas fa-eye',
          hint: o.current.users ? `${(o.current.pageViews / o.current.users).toFixed(1)} por visitante` : '',
        },
        {
          label: 'Tiempo por visitante',
          value: this.formatTime(o.current.avgEngagementPerUser),
          delta: this.delta(o.current.avgEngagementPerUser, o.previous.avgEngagementPerUser),
          icon: 'fas fa-clock',
          hint: 'con la página en pantalla',
        },
      );
    }
    if (e) {
      list.push({
        label: 'Clics a WhatsApp',
        value: this.formatNumber(e.totals['click_whatsapp'] ?? 0),
        delta: this.delta(e.totals['click_whatsapp'] ?? 0, e.previousTotals['click_whatsapp'] ?? 0),
        icon: 'fab fa-whatsapp',
        hint: 'personas que buscaron contacto',
      });
    }
    return list;
  });

  readonly devices = computed(() => {
    const list = this.overview()?.devices ?? [];
    const total = list.reduce((acc, d) => acc + d.users, 0);
    return list
      .map((d) => ({ label: DEVICE_LABELS[d.device] ?? d.device, pct: total ? Math.round((d.users / total) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct);
  });

  /** Lectura rápida en palabras de "cómo va la página". */
  readonly insights = computed<string[]>(() => {
    const out: string[] = [];
    const o = this.overview();
    if (o) {
      const d = this.delta(o.current.users, o.previous.users);
      if (d !== null) {
        out.push(
          d >= 0
            ? `Llegaron ${d}% más visitantes que en el periodo anterior.`
            : `Llegaron ${Math.abs(d)}% menos visitantes que en el periodo anterior.`,
        );
      }
    }
    const top = this.originsWithShare()[0];
    if (top) out.push(`La mayoría llega por ${top.origin} (${top.share}% de las visitas).`);
    const topic = this.topics()[0];
    if (topic) out.push(`El tema más leído es "${topic.topic}" con ${this.formatNumber(topic.visits)} visitas.`);
    const engaging = this.topics()
      .filter((t) => t.visits >= 5)
      .sort((a, b) => b.interactionRate - a.interactionRate)[0];
    if (engaging && engaging.topic !== topic?.topic) {
      out.push(`"${engaging.topic}" es el tema con más interacción (${engaging.interactionRate}% de sus visitas).`);
    }
    const mobile = this.devices().find((x) => x.label === 'Celular');
    if (mobile) out.push(`${mobile.pct}% de los visitantes entra desde el celular.`);
    return out;
  });

  // ---------- Origen ----------

  readonly originsWithShare = computed(() => {
    const list = this.origins();
    const total = list.reduce((acc, o) => acc + o.sessions, 0);
    return list.map((o) => ({ ...o, share: total ? Math.round((o.sessions / total) * 100) : 0 }));
  });

  // ---------- Acciones ----------

  readonly actionTiles = computed(() => {
    const t = this.events()?.totals ?? {};
    const quizStarted = t['quiz_inicio'] ?? 0;
    const quizDone = t['quiz_resultado'] ?? 0;
    return [
      { label: 'Clics a WhatsApp', value: t['click_whatsapp'] ?? 0, icon: 'fab fa-whatsapp' },
      { label: 'Clics a redes sociales', value: t['click_red_social'] ?? 0, icon: 'fas fa-share-alt' },
      { label: 'Videos reproducidos', value: t['ver_video'] ?? 0, icon: 'fas fa-play-circle' },
      {
        label: 'Quiz iniciados',
        value: quizStarted,
        icon: 'fas fa-clipboard-question',
        sub: quizStarted ? `${Math.round((quizDone / quizStarted) * 100)}% lo terminan` : '',
      },
      { label: 'Suscripciones', value: t['suscripcion_newsletter'] ?? 0, icon: 'fas fa-envelope-open-text' },
      { label: 'Descargas', value: t['descarga'] ?? 0, icon: 'fas fa-file-arrow-down' },
      { label: 'Veces compartido', value: (t['share_blog'] ?? 0) + (t['compartir'] ?? 0), icon: 'fas fa-retweet' },
      { label: 'Blogs escuchados', value: t['escuchar_blog'] ?? 0, icon: 'fas fa-headphones' },
    ];
  });

  readonly whatsappByPage = computed(() =>
    (this.events()?.whatsappByPage ?? []).map((r) => ({ ...r, label: this.pageName(r.label) })),
  );

  readonly shareRows = computed(() =>
    (this.events()?.shares ?? []).map((r) => ({ ...r, label: SHARE_LABELS[r.label] ?? r.label })),
  );

  // ---------- Blogs y temas ----------

  readonly blogTotals = computed(() => {
    const list = Object.values(this.stats());
    const visits = list.reduce((acc, b) => acc + (b.visits || 0), 0);
    const interactions = list.reduce((acc, b) => acc + (b.interactions || 0), 0);
    const completeReads = list.reduce((acc, b) => acc + (b.completeReads || 0), 0);
    return {
      visits,
      // Ponderada por visitas: un blog con 1 visita no pesa lo mismo que uno con 100.
      interactionRate: visits ? Math.min(100, Math.round((interactions / visits) * 100)) : 0,
      completeReadRate: visits ? Math.min(100, Math.round((completeReads / visits) * 100)) : 0,
    };
  });

  readonly topics = computed<TopicRow[]>(() => {
    const byTopic: Record<string, { blogs: number; visits: number; readSum: number; interactions: number }> = {};
    Object.entries(this.stats()).forEach(([path, s]) => {
      const topic = this.categories()[path] || 'Sin categoría';
      const t = (byTopic[topic] ??= { blogs: 0, visits: 0, readSum: 0, interactions: 0 });
      t.blogs++;
      t.visits += s.visits || 0;
      t.readSum += (s.readTime || 0) * (s.visits || 0);
      t.interactions += s.interactions || 0;
    });
    return Object.entries(byTopic)
      .map(([topic, t]) => ({
        topic,
        blogs: t.blogs,
        visits: t.visits,
        avgReadTime: t.visits ? Math.round(t.readSum / t.visits) : 0,
        interactionRate: t.visits ? Math.min(100, Math.round((t.interactions / t.visits) * 100)) : 0,
      }))
      .filter((t) => t.visits > 0)
      .sort((a, b) => b.visits - a.visits);
  });

  readonly sortedBlogs = computed<[string, BlogStat][]>(() => {
    const col = this.sortColumn();
    const dir = this.sortDirection();
    return Object.entries(this.stats())
      .filter(([, s]) => s.visits > 0)
      .sort(([, a], [, b]) => {
        const valA = Number(a[col]) || 0;
        const valB = Number(b[col]) || 0;
        return dir === 'desc' ? valB - valA : valA - valB;
      });
  });

  readonly personViewsTotal = computed(() => this.personViews().reduce((acc, p) => acc + p.views, 0));

  async ngAfterViewInit(): Promise<void> {
    await this.fetchFirestoreMetadata();
    await this.fetchAllData();
  }

  ngOnDestroy(): void {
    this.charts.forEach((chart) => chart.destroy());
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  formatNumber(num: number | undefined): string {
    return new Intl.NumberFormat('es-MX', { notation: 'compact', compactDisplay: 'short' }).format(num || 0);
  }

  formatTime(seconds: number | undefined): string {
    if (!seconds) return '0s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m ${Math.round(seconds % 60)}s`;
  }

  rateClass(rate: number | undefined): string {
    const r = rate ?? 0;
    if (r >= 50) return 'bg-success-soft text-success';
    if (r >= 25) return 'bg-warning-soft text-warning';
    return 'bg-danger-soft text-danger';
  }

  toggleSort(column: BlogSortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'desc' ? 'asc' : 'desc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('desc');
    }
  }

  sortIcon(column: BlogSortColumn): string {
    if (this.sortColumn() !== column) return 'fa-sort text-muted';
    return this.sortDirection() === 'desc' ? 'fa-sort-down' : 'fa-sort-up';
  }

  /** /blog/ID → título, /person/ID → nombre, / → Inicio. */
  pageName(path: string): string {
    if (path === '/') return 'Inicio';
    if (path.startsWith('/blog/')) return `Blog: ${this.titles()[path] ?? path}`;
    if (path.startsWith('/person/')) {
      const id = Number(path.split('/person/')[1]);
      const person = this.filteredPeopleList.find((p) => p.id === id);
      return `Perfil: ${person?.name ?? id}`;
    }
    const name = path.replace('/', '');
    return SECTION_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
  }

  private delta(current: number, previous: number): number | null {
    if (!previous) return null;
    return Math.round(((current - previous) / previous) * 100);
  }

  private async fetchFirestoreMetadata(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/firestore/blogs`);
      const blogs = (await res.json()) as { id: string; title: string; category?: string; authorName?: string }[];
      const pathToTitle: Record<string, string> = {};
      const pathToCategory: Record<string, string> = {};
      const pathToAuthor: Record<string, string> = {};
      blogs.forEach((b) => {
        const path = `/blog/${b.id}`;
        pathToTitle[path] = b.title;
        pathToCategory[path] = b.category?.trim() || 'Sin categoría';
        pathToAuthor[path] = b.authorName || '';
      });
      this.titles.set(pathToTitle);
      this.categories.set(pathToCategory);
      this.blogAuthors = pathToAuthor;
    } catch (e) {
      console.error('Error cargando metadatos de Firestore:', e);
    }
  }

  async fetchAllData(): Promise<void> {
    let query: string;
    if (this.selectedTimeRange() === 'custom') {
      if (!this.customStartDate() || !this.customEndDate()) return;
      query = `?startDate=${this.customStartDate()}&endDate=${this.customEndDate()}`;
    } else {
      query = `?startDate=${this.selectedTimeRange()}&endDate=today`;
    }

    this.isLoading.set(true);
    const get = async <T>(path: string): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}${query}`);
      if (!res.ok) throw new Error(`${path}: ${res.status}`);
      return res.json() as Promise<T>;
    };

    // Cada bloque carga por separado: si uno falla, el resto del panel sigue funcionando.
    const results = await Promise.allSettled([
      get<SiteOverview>('/analytics/overview').then((d) => this.overview.set(d)),
      get<{ origins: OriginRow[] }>('/analytics/sources').then((d) => this.origins.set(d.origins)),
      get<SiteEvents>('/analytics/events').then((d) => this.events.set(d)),
      get<Record<string, BlogStat>>('/blog-views').then((d) => this.applyBlogStats(d)),
      get<Record<string, ViewStatEntry>>('/routes-views').then((d) => this.applySections(d)),
      get<Record<string, ViewStatEntry>>('/person-views').then((d) => this.applyPersons(d)),
      get<LocationRow[]>('/location-views').then((d) => this.locationsData.set(d || [])),
    ]);
    const names = ['resumen', 'origen', 'acciones', 'blogs', 'secciones', 'especialistas', 'ubicaciones'];
    this.failedSections.set(names.filter((_, i) => results[i].status === 'rejected'));
    results.forEach((r) => r.status === 'rejected' && console.error('Analytics:', r.reason));

    this.isLoading.set(false);
    setTimeout(() => this.renderCharts());
  }

  private applyBlogStats(raw: Record<string, BlogStat>): void {
    const personId = Number(this.selectedPersonId());
    let result = raw;
    if (personId) {
      const name = this.filteredPeopleList.find((p) => p.id === personId)?.name ?? '';
      result = Object.fromEntries(
        Object.entries(raw).filter(([path]) => areNamesEquivalent(this.blogAuthors[path], name)),
      );
    }
    this.stats.set(result);

    const daily: Record<string, number> = {};
    Object.values(result).forEach((b) =>
      Object.entries(b.daily ?? {}).forEach(([date, n]) => (daily[date] = (daily[date] || 0) + n)),
    );
    this.blogTrend.set(
      Object.keys(daily)
        .sort()
        .map((date) => ({ date, views: daily[date] })),
    );
  }

  private applySections(raw: Record<string, ViewStatEntry>): void {
    this.sectionStats.set(
      Object.entries(raw)
        .filter(([path]) => path !== '/' && !path.startsWith('/blog/'))
        .sort(([, a], [, b]) => b.views - a.views),
    );
  }

  private applyPersons(raw: Record<string, ViewStatEntry>): void {
    this.personViews.set(
      Object.entries(raw)
        .map(([path, stat]) => [Number(path.split('/person/')[1]), stat] as const)
        .filter(([id]) => isPersonActive(id))
        .map(([id, stat]) => ({
          id,
          name: this.filteredPeopleList.find((p) => p.id === id)?.name ?? `Especialista ${id}`,
          views: stat.views,
          avgEngagementPerView: stat.avgEngagementPerView ?? 0,
        }))
        .filter((p) => p.views > 0 && !p.name.startsWith('Especialista '))
        .sort((a, b) => b.views - a.views),
    );
  }

  // ---------- Gráficas ----------

  private renderCharts(): void {
    this.charts.forEach((chart) => chart.destroy());
    this.charts = [];

    const styles = getComputedStyle(document.documentElement);
    Chart.defaults.color = styles.getPropertyValue('--dm-text-secondary').trim() || '#5a5a5a';
    Chart.defaults.font.family = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

    this.renderTrendChart();
    const origins = this.originsWithShare().slice(0, 10);
    this.renderBarChart(this.originsChartRef, origins.map((o) => o.origin), origins.map((o) => o.sessions), 'Visitas');
    const topics = this.topics().slice(0, 10);
    this.renderBarChart(this.topicsChartRef, topics.map((t) => t.topic), topics.map((t) => t.visits), 'Visitas');
    const sections = this.sectionStats();
    this.renderBarChart(this.sectionsChartRef, sections.map(([p]) => this.pageName(p)), sections.map(([, s]) => s.views), 'Visitas');
    const persons = this.personViews();
    this.renderBarChart(this.personsChartRef, persons.map((p) => p.name), persons.map((p) => p.views), 'Visitas');
    const locations = this.locationsData().slice(0, 8);
    this.renderBarChart(
      this.locationsChartRef,
      locations.map((l) => (l.city !== 'Desconocida' ? `${l.city}, ${l.country}` : l.country)),
      locations.map((l) => l.views),
      'Visitas',
    );
  }

  private gridColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue('--dm-border').trim() || '#e9ecef';
  }

  private renderTrendChart(): void {
    const ctx = this.trendChartRef?.nativeElement.getContext('2d');
    if (!ctx) return;
    const byPerson = !!this.selectedPersonId();
    const raw = byPerson
      ? this.blogTrend().map((d) => ({ date: d.date, value: d.views }))
      : (this.overview()?.daily ?? []).map((d) => ({ date: d.date, value: d.users }));
    if (raw.length === 0) return;
    const points = this.fillMissingDays(raw);

    this.charts.push(
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: points.map((p) => `${p.date.slice(6, 8)}/${p.date.slice(4, 6)}`),
          datasets: [
            {
              label: byPerson ? 'Visitas a sus blogs' : 'Visitantes',
              data: points.map((p) => p.value),
              borderColor: '#2a78d6',
              backgroundColor: 'rgba(42, 120, 214, 0.12)',
              fill: true,
              tension: 0.2,
              pointRadius: 0,
              pointHoverRadius: 5,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: this.gridColor() }, ticks: { precision: 0 } },
            x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
          },
        },
      }),
    );
  }

  /** GA no regresa los días sin visitas; sin rellenarlos, la línea une puntos como si no hubiera huecos. */
  private fillMissingDays(points: { date: string; value: number }[]): { date: string; value: number }[] {
    const byDate = new Map(points.map((p) => [p.date, p.value]));
    const toDate = (d: string) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)));
    const toKey = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
    const range = this.selectedTimeRange();
    const today = new Date();
    let start = toDate(points[0].date);
    let end = toDate(points[points.length - 1].date);
    if (range === 'custom') {
      start = new Date(`${this.customStartDate()}T00:00:00Z`);
      end = new Date(`${this.customEndDate()}T00:00:00Z`);
    } else {
      end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      const ago = /^(\d+)daysAgo$/.exec(range);
      if (ago) start = new Date(end.getTime() - Number(ago[1]) * 86400000);
      else if (/^\d{4}-\d{2}-\d{2}$/.test(range)) start = new Date(`${range}T00:00:00Z`);
      // En el histórico completo se arranca en el primer día con datos.
      if (range === '2020-08-15') start = toDate(points[0].date);
    }
    const out: { date: string; value: number }[] = [];
    for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
      const key = toKey(d);
      out.push({ date: key, value: byDate.get(key) ?? 0 });
    }
    return out;
  }

  /** Alto de una gráfica de barras horizontales según cuántas barras tiene. */
  barHeight(count: number): number {
    return Math.max(140, Math.min(count, 10) * 38 + 50);
  }

  /** Barras horizontales de una sola serie: el largo es lo que importa, el color no codifica nada. */
  private renderBarChart(ref: ElementRef<HTMLCanvasElement> | undefined, labels: string[], data: number[], label: string): void {
    const ctx = ref?.nativeElement.getContext('2d');
    if (!ctx || data.length === 0) return;
    const truncate = (text: string) => (text.length > 28 ? text.slice(0, 26) + '…' : text);

    this.charts.push(
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels.map(truncate),
          datasets: [{ label, data, backgroundColor: '#2a78d6', borderRadius: 4, maxBarThickness: 22 }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { title: (items) => labels[items[0].dataIndex] } },
          },
          scales: {
            x: { beginAtZero: true, grid: { color: this.gridColor() }, ticks: { precision: 0 } },
            y: { grid: { display: false } },
          },
        },
      }),
    );
  }
}
