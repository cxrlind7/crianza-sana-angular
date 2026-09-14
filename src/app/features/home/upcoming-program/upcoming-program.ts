import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService, Programa } from '../../../core/services/api.service';
import { people } from '../../../core/data/people-data';

interface PresenterItem {
  name: string;
  image: string;
  title?: string;
}

const FALLBACK_ITEM: PresenterItem = { name: 'Cargando...', image: '', title: '' };

@Component({
  selector: 'app-upcoming-program',
  templateUrl: './upcoming-program.html',
  styleUrl: './upcoming-program.scss',
})
export class UpcomingProgram implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);

  readonly programa = signal<Programa | null>(null);
  readonly currentIndex = signal(1);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  readonly temas = computed<string[]>(() => this.programa()?.temas ?? []);

  readonly eventInfo = computed(() => {
    const evento = this.programa()?.evento;
    if (!evento) return { message: '', time: '', day: '', month: '', year: '' };

    const fechaStr = evento.fecha;
    const dateStrFormatted = fechaStr.includes('T') ? fechaStr : `${fechaStr}T00:00:00`;
    const date = new Date(dateStrFormatted);

    if (isNaN(date.getTime())) {
      return { message: '', time: '', day: '--', month: '-', year: '----' };
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('es-ES', { month: 'short' }).replace('.', '').toUpperCase();
    const year = date.getFullYear();

    return {
      message: evento.mensaje || 'Sintonízanos',
      time: evento.hora ?? '',
      day,
      month,
      year: String(year),
    };
  });

  readonly colors = computed(() => this.programa()?.colores ?? {});

  readonly items = computed<PresenterItem[]>(() => {
    const participantes = this.programa()?.participantes;
    if (!participantes) return [];
    return participantes
      .map((id: number) => people.find((person) => person.id === id))
      .filter((p): p is PresenterItem => Boolean(p));
  });

  readonly fixedItem = computed<PresenterItem>(() => this.items()[0] || FALLBACK_ITEM);

  readonly currentItem = computed<PresenterItem>(
    () => this.items()[this.currentIndex()] || FALLBACK_ITEM,
  );

  readonly currentTema = computed<{ name: string }>(() => {
    const temas = this.temas();
    if (temas.length === 0) return { name: 'Próximamente' };
    const temaIndex = (this.currentIndex() - 1) % temas.length;
    return { name: temas[temaIndex] };
  });

  readonly isUpcoming = computed(() => {
    const fecha = this.programa()?.evento?.fecha;
    if (!fecha) return false;

    const programDateStr = fecha.split('T')[0];
    const [year, month, day] = programDateStr.split('-');

    const programDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    programDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return programDate.getTime() >= today.getTime();
  });

  readonly cssVars = computed(() => ({
    '--bg-primary': this.colors().primario || '#4a1a1a',
    '--accent-gold': this.colors().secundario || '#fcd34d',
    '--text-light': this.colors().titulo || '#ffffff',
  }));

  ngOnInit(): void {
    this.loadPrograma();
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async loadPrograma(): Promise<void> {
    try {
      const programas = await this.api.getPrograms();
      if (programas && programas.length > 0) {
        this.programa.set(programas[0]);
        console.log('✅ Programa cargado:', programas[0]);
        console.log('📅 Fecha del evento:', programas[0].evento?.fecha);

        if (this.items().length > 2) {
          this.startRotation();
        }
      }
    } catch (error) {
      console.error('❌ Error al cargar el programa:', error);
    }
  }

  private switchContent(): void {
    const rotatableItemsCount = this.items().length - 1;
    if (rotatableItemsCount <= 0) return;
    const nextRelativeIndex = (this.currentIndex() - 1 + 1) % rotatableItemsCount;
    this.currentIndex.set(nextRelativeIndex + 1);
  }

  private startRotation(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.switchContent(), 3000);
  }
}
