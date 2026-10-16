import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { getActivePeople } from '../../../core/utils/people-visibility';
import { BarItem, BarList } from '../bar-list/bar-list';

interface PanelData {
  persona: { id: number; name: string; color: string; tieneWhatsapp: boolean };
  perfil: { visitas: number; personas: number; delta: number | null };
  whatsapp: { clics: number; delta: number | null; conversion: number | null; porOrigen: BarItem[] };
  diario: { date: string; visitas: number }[];
  origen: BarItem[];
  tarjeta: { tarjetas: number; contactos: number; qrAbierto: number; compartido: number; visitasQr: number };
  videos: { titulo: string; reproducciones: number; completos: number }[];
  blogs: { id: string; title: string; visitas: number; lecturaCompleta: number; tiempoPromedio: number; escuchas: number; compartidos: number }[];
  ciudades: BarItem[];
  horario: { porDia: BarItem[]; porHora: number[] };
}

/**
 * Panel de un especialista: solo sus números (no se compara con nadie). Responde
 * "¿me sirve estar en Crianza Sana?": visitas, quién le escribe, de dónde llegan y qué contenido funciona.
 */
@Component({
  selector: 'app-especialista-panel',
  imports: [BarList, DecimalPipe],
  templateUrl: './especialista-panel.html',
  styleUrl: './especialista-panel.scss',
})
export class EspecialistaPanel {
  /** Rango de fechas del panel de analytics (mismo formato que GA: '30daysAgo', 'today', 'YYYY-MM-DD'). */
  readonly startDate = input('30daysAgo');
  readonly endDate = input('today');

  readonly personas = computed(() => getActivePeople());
  readonly seleccion = signal<number | null>(null);
  readonly datos = signal<PanelData | null>(null);
  readonly cargando = signal(false);
  readonly error = signal(false);

  readonly persona = computed(() => this.personas().find((p) => p.id === this.seleccion()) ?? null);

  readonly tarjetaTotal = computed(() => {
    const t = this.datos()?.tarjeta;
    return t ? t.tarjetas + t.contactos + t.visitasQr : 0;
  });

  /** Barras de las 24 horas agrupadas en franjas, más fáciles de leer que 24 barras. */
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

  protected readonly Math = Math;

  readonly videosBarras = computed<BarItem[]>(() =>
    (this.datos()?.videos ?? []).map((v) => ({ label: v.titulo, count: v.reproducciones, extra: `${v.completos} completos` })),
  );

  readonly diarioMax = computed(() => Math.max(1, ...(this.datos()?.diario ?? []).map((d) => d.visitas)));

  /** Frases que resumen lo más útil para la persona. */
  readonly resumen = computed<string[]>(() => {
    const d = this.datos();
    if (!d) return [];
    const r: string[] = [];
    if (!d.perfil.visitas) return ['Aún no hay visitas a tu perfil en este periodo. Comparte tu enlace o tu tarjeta digital para empezar.'];
    if (d.whatsapp.conversion !== null && d.whatsapp.clics) {
      r.push(`De cada 100 personas que ven tu perfil, ${Math.round(d.whatsapp.conversion)} te escriben por WhatsApp.`);
    }
    if (d.whatsapp.porOrigen[0]) r.push(`La mayoría te escribe desde: ${d.whatsapp.porOrigen[0].label.toLowerCase()}.`);
    if (d.origen[0]) r.push(`Tu mejor canal para atraer visitas es ${d.origen[0].label}.`);
    const dia = [...d.horario.porDia].sort((a, b) => b.count - a.count)[0];
    const franja = [...this.franjas()].sort((a, b) => b.count - a.count)[0];
    if (dia?.count) r.push(`Te visitan más los ${dia.label.toLowerCase()} por la ${franja.label.split(' (')[0].toLowerCase()}: buen momento para publicar.`);
    if (d.ciudades[0]) r.push(`La mayoría de tus visitas vienen de ${d.ciudades[0].label}.`);
    const blog = d.blogs.find((b) => b.visitas);
    if (blog) r.push(`Tu blog más leído: "${blog.title.split('\n')[0]}".`);
    if (d.persona.tieneWhatsapp === false) r.push('No tienes WhatsApp registrado: agrégalo en Configuración → Especialistas para que te puedan escribir.');
    return r;
  });

  constructor() {
    effect(() => {
      const lista = this.personas();
      if (this.seleccion() === null && lista.length) this.seleccion.set(lista[0].id);
    });
    effect(() => {
      const id = this.seleccion();
      const start = this.startDate();
      const end = this.endDate();
      if (id !== null) untracked(() => this.cargar(id, start, end));
    });
  }

  private async cargar(id: number, startDate: string, endDate: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      const params = new URLSearchParams({ personId: String(id), startDate, endDate });
      const res = await fetch(`${environment.backendUrl}/api/analytics/especialista?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as PanelData;
      if (this.seleccion() === id) this.datos.set(data);
    } catch {
      this.error.set(true);
      this.datos.set(null);
    } finally {
      this.cargando.set(false);
    }
  }

  fechaCorta(ymd: string): string {
    return `${ymd.slice(6, 8)}/${ymd.slice(4, 6)}`;
  }

  segundos(s: number): string {
    if (!s) return '—';
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
  }
}
