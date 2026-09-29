import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService, EventItem } from '../../../core/services/api.service';

@Component({
  selector: 'app-workshop-card',
  templateUrl: './workshop-card.html',
  styleUrl: './workshop-card.scss',
})
export class WorkshopCard implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);

  readonly events = signal<EventItem[]>([]);
  readonly currentEventIndex = signal(0);
  readonly showToast = signal(false);

  private timer: ReturnType<typeof setInterval> | null = null;

  readonly currentEvent = computed(() => this.events()[this.currentEventIndex()] ?? null);

  readonly actionIcon = computed(() => {
    const type = this.currentEvent()?.type;
    if (type === 'whatsapp') return 'fab fa-whatsapp';
    if (type === 'link') return 'fas fa-arrow-up-right-from-square';
    return 'fas fa-phone';
  });

  readonly helpText = computed(() => {
    const type = this.currentEvent()?.type;
    if (type === 'call') return 'Da clic para llamar o copiar número.';
    if (type === 'link') return 'Haz clic para ver más información.';
    return 'Haz clic para abrir el chat directo.';
  });

  readonly showButton = computed(() => {
    const event = this.currentEvent();
    return !!event && event.showButton !== 'false' && !!event.buttonText;
  });

  readonly actionLink = computed(() => {
    const event = this.currentEvent();
    if (!event) return '#';
    const phone = (event.phone ?? '').replace(/\D/g, '');
    if (event.type === 'whatsapp') {
      return `https://wa.me/${phone}?text=${encodeURIComponent(event.message ?? '')}`;
    }
    if (event.type === 'link') {
      return event.link || '#';
    }
    return `tel:${phone}`;
  });

  async ngOnInit(): Promise<void> {
    try {
      const data = await this.api.getEvents();
      // Los eventos sin campo "active" (creados antes de existir el campo) se consideran activos.
      this.events.set(data.filter((event) => event.active !== 'false'));
    } catch (error) {
      console.error('❌ Error al cargar eventos:', error);
    }
    this.startRotation();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private startRotation(): void {
    this.timer = setInterval(() => {
      this.nextEvent();
    }, 10000);
  }

  private nextEvent(): void {
    const total = this.events().length;
    if (total === 0) return;
    this.currentEventIndex.set((this.currentEventIndex() + 1) % total);
  }

  manualChange(index: number): void {
    this.currentEventIndex.set(index);
    if (this.timer) clearInterval(this.timer);
    this.startRotation();
  }

  handleBtnClick(event: MouseEvent): void {
    const current = this.currentEvent();
    if (!current || current.type !== 'call') return;

    if (window.innerWidth > 768) {
      event.preventDefault();
      navigator.clipboard
        .writeText(current.phone ?? '')
        .then(() => {
          this.showToast.set(true);
          setTimeout(() => this.showToast.set(false), 3000);
        })
        .catch((err) => console.error('Error al copiar: ', err));
    }
  }
}
