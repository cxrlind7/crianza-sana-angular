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

  readonly actionIcon = computed(() =>
    this.currentEvent()?.type === 'whatsapp' ? 'fab fa-whatsapp' : 'fas fa-phone',
  );

  readonly helpText = computed(() =>
    this.currentEvent()?.type === 'call'
      ? 'Da clic para llamar o copiar número.'
      : 'Haz clic para abrir el chat directo.',
  );

  readonly actionLink = computed(() => {
    const event = this.currentEvent();
    if (!event) return '#';
    if (event.type === 'whatsapp') {
      const encodedMessage = encodeURIComponent(event.message ?? '');
      return `https://wa.me/${event.phone}?text=${encodedMessage}`;
    }
    return `tel:${event.phone}`;
  });

  async ngOnInit(): Promise<void> {
    try {
      const data = await this.api.getEvents();
      console.log('✅ Eventos cargados desde Firestore:', data);
      if (Array.isArray(data) && data.length > 0) {
        const activeEvents = data.filter((event) => (event as EventItem & { active?: string }).active === 'true');
        if (activeEvents.length > 0) {
          console.log('✅ Eventos activos filtrados:', activeEvents);
          this.events.set(activeEvents);
        } else {
          console.warn('⚠️ No hay eventos marcados como activos.');
        }
      }
    } catch (error) {
      console.error('❌ Error al cargar eventos desde Firestore:', error);
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
    if (!current || current.type === 'whatsapp') return;

    if (current.type === 'call') {
      if (window.innerWidth > 768) {
        event.preventDefault();
        const numberToCopy = current.phone ?? '';

        navigator.clipboard
          .writeText(numberToCopy)
          .then(() => {
            this.showToast.set(true);
            setTimeout(() => {
              this.showToast.set(false);
            }, 3000);
          })
          .catch((err) => {
            console.error('Error al copiar: ', err);
          });
      }
    }
  }
}
