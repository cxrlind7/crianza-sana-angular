import { AfterViewInit, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Chart from 'chart.js/auto';
import { people as peopleData } from '../../core/data/people-data';
import { areNamesEquivalent } from '../../core/utils/string-utils';

interface StatEntry {
  visits: number;
  engagementRate: number | string;
  avgSessionDuration: number;
  shares?: number;
  daily?: Record<string, number>;
}

interface ViewStatEntry {
  views: number;
  engagementRate: number | string;
  avgSessionDuration: number;
}

interface PersonViewRow {
  name: string;
  views: number;
  engagementRate: number | string;
  avgSessionDuration: number;
  color: string;
}

interface LocationRow {
  country: string;
  city: string;
  views: number;
}

type SortColumn = 'visits' | 'engagementRate' | 'shares';

const API_BASE = 'https://crianzasanabydkids.mx/api';

@Component({
  selector: 'app-analytics',
  imports: [FormsModule],
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss',
})
export class Analytics implements AfterViewInit {
  private readonly router = inject(Router);
  protected readonly Math = Math;

  @ViewChild('totalChart') totalChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topBlogsChart') topBlogsChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('sectionsChart') sectionsChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('personPieChart') personPieChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('locationsChart') locationsChartRef?: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  readonly isLoading = signal(true);
  readonly showFilters = signal(false);
  readonly showStatsTable = signal(true);
  readonly selectedTimeRange = signal('30daysAgo');
  readonly customStartDate = signal('');
  readonly customEndDate = signal('');
  readonly selectedPersonId = signal('');

  readonly sortColumn = signal<SortColumn>('visits');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');

  readonly stats = signal<Record<string, StatEntry>>({});
  readonly titles = signal<Record<string, string>>({});
  readonly colors = signal<Record<string, string>>({});
  private blogAuthors: Record<string, string> = {};

  readonly homepageLabels = signal<string[]>([]);
  readonly homepageData = signal<number[]>([]);
  readonly sectionLabels = signal<string[]>([]);
  readonly sectionData = signal<number[]>([]);
  readonly sectionStats = signal<[string, ViewStatEntry][]>([]);
  readonly personViews = signal<PersonViewRow[]>([]);
  readonly locationsData = signal<LocationRow[]>([]);

  readonly filteredPeopleList = (peopleData as { id: number; name: string; color?: string }[]).filter(
    (p) => !p.name.toLowerCase().includes('martha elena'),
  );

  readonly totalVisits = computed(() =>
    Object.values(this.stats()).reduce((acc, curr) => acc + (curr.visits || 0), 0),
  );

  readonly avgEngagementRate = computed(() => {
    const blogs = Object.values(this.stats()).filter((b) => b.visits > 0);
    if (blogs.length === 0) return '0';
    const totalRate = blogs.reduce((acc, curr) => acc + parseFloat(String(curr.engagementRate || 0)), 0);
    return (totalRate / blogs.length).toFixed(0);
  });

  readonly personViewsTotal = computed(() => this.personViews().reduce((acc, p) => acc + p.views, 0));

  readonly topBlogEntry = computed(() => {
    const entries = Object.entries(this.stats());
    if (entries.length === 0) return null;
    return entries.sort(([, a], [, b]) => b.visits - a.visits)[0];
  });

  readonly topBlogData = computed(() => this.topBlogEntry()?.[1] ?? null);
  readonly topBlogName = computed(() => {
    const entry = this.topBlogEntry();
    if (!entry) return '';
    return this.titles()[entry[0]] || 'Blog';
  });

  readonly sortedStatsList = computed<[string, StatEntry][]>(() => {
    const col = this.sortColumn();
    const dir = this.sortDirection();
    return Object.entries(this.stats()).sort(([, a], [, b]) => {
      const valA = Number(a[col]) || 0;
      const valB = Number(b[col]) || 0;
      return dir === 'desc' ? valB - valA : valA - valB;
    });
  });

  async ngAfterViewInit(): Promise<void> {
    await this.fetchFirestoreMetadata();
    await this.fetchAllData();
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
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m ${Math.round(seconds % 60)}s`;
  }

  getEngagementClass(rate: number | string | undefined): string {
    const r = parseFloat(String(rate));
    if (r >= 60) return 'bg-success-soft text-success';
    if (r >= 40) return 'bg-warning-soft text-warning';
    return 'bg-danger-soft text-danger';
  }

  toggleSort(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'desc' ? 'asc' : 'desc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('desc');
    }
  }

  private async fetchFirestoreMetadata(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/firestore/blogs`);
      const blogs = await res.json();
      const pathToTitle: Record<string, string> = {};
      const pathToColor: Record<string, string> = {};
      const pathToAuthor: Record<string, string> = {};

      (blogs as { id: string; title: string; categoryColor?: string; authorName?: string }[]).forEach((b) => {
        const path = `/blog/${b.id}`;
        pathToTitle[path] = b.title;
        pathToColor[path] = b.categoryColor || '#6c757d';
        pathToAuthor[path] = b.authorName || '';
      });
      this.titles.set(pathToTitle);
      this.colors.set(pathToColor);
      this.blogAuthors = pathToAuthor;
    } catch (e) {
      console.error('Error cargando metadatos de Firestore:', e);
    }
  }

  async fetchAllData(): Promise<void> {
    this.isLoading.set(true);

    let dateQueryParams: string;
    if (this.selectedTimeRange() === 'custom') {
      if (!this.customStartDate() || !this.customEndDate()) {
        this.isLoading.set(false);
        return;
      }
      dateQueryParams = `?startDate=${this.customStartDate()}&endDate=${this.customEndDate()}`;
    } else {
      dateQueryParams = `?startDate=${this.selectedTimeRange()}&endDate=today`;
    }

    let personQueryParams = dateQueryParams;
    if (this.selectedPersonId()) {
      personQueryParams += `&personId=${this.selectedPersonId()}`;
    }

    try {
      const [blogStatsRes, homepageRes, routesRes, personRes, locationsRes] = await Promise.all([
        fetch(`${API_BASE}/blog-views${dateQueryParams}`),
        fetch(`${API_BASE}/homepage-views${dateQueryParams}`),
        fetch(`${API_BASE}/routes-views${dateQueryParams}`),
        fetch(`${API_BASE}/person-views${personQueryParams}`),
        fetch(`${API_BASE}/location-views${dateQueryParams}`),
      ]);

      const rawBlogStats: Record<string, StatEntry> = await blogStatsRes.json();
      const homepageDataRaw: Record<string, number> = await homepageRes.json();
      const routesDataRaw: Record<string, ViewStatEntry> = await routesRes.json();
      const personDataRaw: Record<string, ViewStatEntry> = await personRes.json();
      const locationsDataRaw: LocationRow[] = await locationsRes.json();

      this.locationsData.set(locationsDataRaw || []);

      let finalBlogStats = rawBlogStats;
      if (this.selectedPersonId()) {
        finalBlogStats = {};
        const selectedPerson = this.filteredPeopleList.find((p) => p.id === Number(this.selectedPersonId()));
        const selectedName = selectedPerson ? selectedPerson.name : '';

        Object.entries(rawBlogStats).forEach(([path, stat]) => {
          const authorName = this.blogAuthors[path];
          if (areNamesEquivalent(authorName, selectedName)) {
            finalBlogStats[path] = stat;
          }
        });
      }
      this.stats.set(finalBlogStats);

      if (this.selectedPersonId()) {
        const dailyTotals: Record<string, number> = {};
        Object.values(this.stats()).forEach((blog) => {
          if (blog.daily) {
            Object.entries(blog.daily).forEach(([date, count]) => {
              dailyTotals[date] = (dailyTotals[date] || 0) + count;
            });
          }
        });
        const sortedDates = Object.keys(dailyTotals).sort();
        this.homepageLabels.set(sortedDates.map((d) => `${d.slice(6, 8)}/${d.slice(4, 6)}`));
        this.homepageData.set(sortedDates.map((d) => dailyTotals[d]));
      } else {
        const sortedDates = Object.keys(homepageDataRaw).sort();
        this.homepageLabels.set(sortedDates.map((d) => `${d.slice(6, 8)}/${d.slice(4, 6)}`));
        this.homepageData.set(sortedDates.map((d) => homepageDataRaw[d]));
      }

      const sortedSections = Object.entries(routesDataRaw)
        .filter(([path]) => path !== '/' && !path.startsWith('/blog/'))
        .sort(([, a], [, b]) => b.views - a.views)
        .slice(0, 8);

      this.sectionLabels.set(sortedSections.map(([path]) => path.replace('/', '') || 'Inicio'));
      this.sectionData.set(sortedSections.map(([, stat]) => stat.views));
      this.sectionStats.set(sortedSections);

      this.personViews.set(
        Object.entries(personDataRaw)
          .map(([path, stat]) => {
            const id = Number(path.split('/person/')[1]);
            const person = this.filteredPeopleList.find((p) => p.id === id);
            return {
              name: person?.name || `Especialista ${id}`,
              views: stat.views,
              engagementRate: stat.engagementRate,
              avgSessionDuration: stat.avgSessionDuration,
              color: person?.color || '#999',
            };
          })
          .filter((p) => p.views > 0),
      );
    } catch (error) {
      console.error('Error crítico obteniendo analíticas:', error);
    } finally {
      this.isLoading.set(false);
      setTimeout(() => this.renderCharts());
    }
  }

  private renderCharts(): void {
    this.charts.forEach((chart) => chart.destroy());
    this.charts = [];

    this.renderTotalChart();
    this.renderTopBlogsChart();
    this.renderSectionChart();
    this.renderPersonPieChart();
    this.renderLocationsChart();
  }

  private renderTotalChart(): void {
    const ctx = this.totalChartRef?.nativeElement.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(13, 110, 253, 0.25)');
    gradient.addColorStop(1, 'rgba(13, 110, 253, 0.0)');

    this.charts.push(
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.homepageLabels(),
          datasets: [
            {
              label: this.selectedPersonId() ? 'Visitas Blogs' : 'Visitas Inicio',
              data: this.homepageData(),
              borderColor: '#0d6efd',
              backgroundColor: gradient,
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 6,
              borderWidth: 2.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#f0f2f5' }, ticks: { font: { size: 11 } } },
            x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
          },
        },
      }),
    );
  }

  private renderTopBlogsChart(): void {
    const ctx = this.topBlogsChartRef?.nativeElement.getContext('2d');
    if (!ctx) return;

    const topEntries = this.sortedStatsList().slice(0, 5);
    if (topEntries.length === 0) return;

    const truncate = (text: string) => (text.length > 20 ? text.slice(0, 18) + '...' : text);
    const titles = this.titles();
    const colors = this.colors();

    this.charts.push(
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: topEntries.map(([path]) => truncate(titles[path] || path)),
          datasets: [
            {
              label: 'Visitas',
              data: topEntries.map(([, stat]) => stat.visits),
              backgroundColor: topEntries.map(([path]) => colors[path] || '#6c757d'),
              borderRadius: 4,
              barPercentage: 0.7,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: '#f0f2f5' }, ticks: { font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { font: { size: 11, weight: 500 } } },
          },
        },
      }),
    );
  }

  private renderSectionChart(): void {
    const ctx = this.sectionsChartRef?.nativeElement.getContext('2d');
    if (!ctx || this.sectionData().length === 0) return;

    this.charts.push(
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: this.sectionLabels(),
          datasets: [
            {
              label: 'Visitas',
              data: this.sectionData(),
              backgroundColor: 'rgba(111, 66, 193, 0.7)',
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#f0f2f5' } },
            x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 35, minRotation: 35, font: { size: 10 } } },
          },
        },
      }),
    );
  }

  private renderPersonPieChart(): void {
    const ctx = this.personPieChartRef?.nativeElement.getContext('2d');
    if (!ctx || this.personViews().length === 0) return;

    this.charts.push(
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: this.personViews().map((p) => p.name),
          datasets: [
            {
              data: this.personViews().map((p) => p.views),
              backgroundColor: this.personViews().map((p) => p.color),
              borderWidth: 2,
              borderColor: '#ffffff',
              hoverOffset: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 }, padding: 15 } } },
        },
      }),
    );
  }

  private renderLocationsChart(): void {
    const ctx = this.locationsChartRef?.nativeElement.getContext('2d');
    if (!ctx || this.locationsData().length === 0) return;

    const top8 = this.locationsData().slice(0, 8);
    const labels = top8.map((l) => (l.city !== 'Desconocida' ? l.city : l.country));
    const data = top8.map((l) => l.views);

    const palette = [
      'rgba(13, 110, 253, 0.75)',
      'rgba(111, 66, 193, 0.75)',
      'rgba(32, 201, 151, 0.75)',
      'rgba(253, 126, 20, 0.75)',
      'rgba(13, 202, 240, 0.75)',
      'rgba(25, 135, 84, 0.75)',
      'rgba(220, 53, 69, 0.75)',
      'rgba(255, 193, 7, 0.75)',
    ];

    this.charts.push(
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Visitas',
              data,
              backgroundColor: palette.slice(0, data.length),
              borderRadius: 6,
              barPercentage: 0.65,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: '#f0f2f5' }, ticks: { font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { font: { size: 10 } } },
          },
        },
      }),
    );
  }
}
