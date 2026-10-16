import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { categoriaMeta } from '../../../core/services/foro.service';
import { BarItem, BarList } from '../bar-list/bar-list';

interface TemasData {
  busquedas: { termino: string; blog: number; foro: number; total: number }[];
  foro: {
    pendientes: number;
    porCategoria: { categoria: string; preguntas: number; sinRespuesta: number }[];
    sinRespuesta: { id: string; titulo: string; categoria: string; creadoEn: string | null }[];
  };
  horario: { porDia: BarItem[]; porHora: number[] };
}

/** Qué buscan y preguntan los padres, y cuándo visitan el sitio: ideas para el próximo contenido. */
@Component({
  selector: 'app-temas-padres',
  imports: [BarList, RouterLink],
  templateUrl: './temas-padres.html',
  styleUrl: './temas-padres.scss',
})
export class TemasPadres {
  readonly startDate = input('30daysAgo');
  readonly endDate = input('today');

  readonly datos = signal<TemasData | null>(null);
  readonly error = signal(false);
  readonly categoriaMeta = categoriaMeta;

  readonly foroBarras = computed<BarItem[]>(() =>
    (this.datos()?.foro.porCategoria ?? []).map((c) => ({
      label: categoriaMeta(c.categoria).label,
      count: c.preguntas,
      color: categoriaMeta(c.categoria).color,
      extra: c.sinRespuesta ? `${c.sinRespuesta} sin respuesta` : '',
    })),
  );

  readonly franjas = computed<BarItem[]>(() => {
    const h = this.datos()?.horario.porHora ?? [];
    const suma = (a: number, b: number) => h.slice(a, b).reduce((n, x) => n + x, 0);
    return [
      { label: 'Madrugada (0–6 h)', count: suma(0, 6) },
      { label: 'Mañana (6–12 h)', count: suma(6, 12) },
      { label: 'Tarde (12–18 h)', count: suma(12, 18) },
      { label: 'Noche (18–24 h)', count: suma(18, 24) },
    ];
  });

  constructor() {
    effect(() => {
      const start = this.startDate();
      const end = this.endDate();
      untracked(() => this.cargar(start, end));
    });
  }

  private async cargar(startDate: string, endDate: string): Promise<void> {
    this.error.set(false);
    try {
      const res = await fetch(`${environment.backendUrl}/api/analytics/temas?${new URLSearchParams({ startDate, endDate })}`);
      if (!res.ok) throw new Error(String(res.status));
      this.datos.set(await res.json());
    } catch {
      this.error.set(true);
    }
  }
}
