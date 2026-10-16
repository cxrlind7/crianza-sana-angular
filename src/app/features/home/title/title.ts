import { Component, OnDestroy, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getActivePeople } from '../../../core/utils/people-visibility';

interface TeamMember {
  id: number;
  name: string;
  src: string;
  specialty: string;
  color: string;
}



const ROTATIONS = [3, -2, 4, -3, 2, -4, 3, -2];

/**
 * Cuántas tarjetas por fila para que las filas queden parejas: se usan las filas mínimas
 * con ese máximo y se reparten. 5 con máximo 5 → una fila; 6 → 3 + 3; 7 → 4 + 3; 9 → 5 + 4.
 */
export function columnasParejas(total: number, maximo: number): number {
  if (total <= 0) return 1;
  const filas = Math.ceil(total / maximo);
  return Math.ceil(total / filas);
}

@Component({
  selector: 'app-title',
  imports: [RouterLink],
  templateUrl: './title.html',
  styleUrl: './title.scss',
})
export class Title implements OnDestroy {
  /** Los que se muestran hoy y tienen foto para el inicio (se elige en Configuración → Especialistas). */
  readonly team = computed<TeamMember[]>(() =>
    getActivePeople()
      .filter((p) => p.inicio?.mostrar && p.inicio.foto)
      .map((p) => ({
        id: p.id,
        name: p.inicio!.nombreCorto || p.name.split(' ')[0],
        src: p.inicio!.foto,
        specialty: p.inicio!.especialidad || p.title,
        color: p.color,
      })),
  );
  readonly columnas = computed(() => {
    const n = this.team().length;
    return { lg: columnasParejas(n, 5), md: columnasParejas(n, 3), sm: columnasParejas(n, 3) };
  });

  readonly activeIndex = signal(0);
  readonly hoveredIndex = signal<number | null>(null);

  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startInterval();
  }

  ngOnDestroy(): void {
    this.stopInterval();
  }

  isHighlighted(index: number): boolean {
    return (
      this.hoveredIndex() === index ||
      (this.activeIndex() === index && this.hoveredIndex() === null)
    );
  }

  getCardStyle(index: number) {
    const isHovered = this.hoveredIndex() === index;
    const isActive = this.activeIndex() === index && this.hoveredIndex() === null;

    const rotation = isHovered ? 0 : ROTATIONS[index % ROTATIONS.length];
    const scale = isHovered ? 1.1 : isActive ? 1.05 : 1;
    const translateY = isHovered ? '-20px' : '0px';
    const z = isHovered ? 50 : isActive ? 20 : 10;

    return {
      transform: `rotate(${rotation}deg) scale(${scale}) translateY(${translateY})`,
      zIndex: z,
    };
  }

  onHover(index: number | null): void {
    this.hoveredIndex.set(index);
    if (index === null) {
      this.startInterval();
    } else {
      this.stopInterval();
    }
  }

  private startInterval(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.activeIndex.set((this.activeIndex() + 1) % Math.max(1, this.team().length));
    }, 2000);
  }

  private stopInterval(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }
}
