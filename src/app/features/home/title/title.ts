import { Component, OnDestroy, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface TeamMember {
  id: number;
  name: string;
  src: string;
  specialty: string;
  color: string;
}

const TEAM: TeamMember[] = [
  { id: 2, name: 'Carina', src: '/CarinaNoviembre1.jpeg', specialty: 'Terapéuta cognitivo conductual', color: '#FF4DA3' },
  { id: 4, name: 'Patricia', src: '/PatyNoviembre1.jpeg', specialty: 'Odontopediatra', color: '#E70885' },
  { id: 6, name: 'Luis', src: '/LuisNoviembre1.jpeg', specialty: 'Psicólogo Infanto-Juvenil', color: '#1A9FAD' },
  { id: 3, name: 'Andrea', src: '/AndreaNoviembre1.jpeg', specialty: 'Lic. en Nutrición', color: '#7ABB4B' },
  { id: 1, name: 'Karen', src: '/KarenNoviembre1.jpeg', specialty: 'Lic. en Fisioterapia', color: '#8F0072' },
  { id: 5, name: 'Miriam', src: '/MiriamNoviembre1.jpeg', specialty: 'Pediatra - Cardióloga pediatra', color: '#1e40af' },
  { id: 8, name: 'Roberto', src: '/RobertoNoviembre1.jpeg', specialty: 'Lic. en Derecho', color: '#112548' },
  { id: 9, name: 'Ana Laura', src: '/AnaLauNoviembre1.jpeg', specialty: 'Terapeuta de la Comunicación Humana', color: '#00a6c7' },
];

const ROTATIONS = [3, -2, 4, -3, 2, -4, 3, -2];

@Component({
  selector: 'app-title',
  imports: [RouterLink],
  templateUrl: './title.html',
  styleUrl: './title.scss',
})
export class Title implements OnDestroy {
  readonly team = TEAM;

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

    const rotation = isHovered ? 0 : ROTATIONS[index];
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
      this.activeIndex.set((this.activeIndex() + 1) % TEAM.length);
    }, 2000);
  }

  private stopInterval(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }
}
