import { AfterViewInit, CUSTOM_ELEMENTS_SCHEMA, Component, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { SwiperOptions } from 'swiper/types';
import { findPerson, getActivePeople } from '../../../core/utils/people-visibility';

interface Servicio {
  personId: number;
  title: string;
  description: string;
  image: string;
}

@Component({
  selector: 'app-services',
  imports: [RouterLink],
  templateUrl: './services.html',
  styleUrl: './services.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Services implements AfterViewInit {
  @ViewChild('swiperContainer') swiperContainer?: ElementRef<HTMLElement>;

  // WhatsApp general (Carina / D-Kids) si un especialista no tiene número registrado.
  private readonly fallbackPhoneNumber = '526181448790';

  /** Una tarjeta por especialista visible con "servicio en el inicio" (Configuración → Especialistas). */
  readonly servicios: Servicio[] = getActivePeople()
    .filter((p) => p.servicioInicio?.mostrar && p.servicioInicio.titulo)
    .sort((a, b) => (a.servicioInicio!.orden ?? 99) - (b.servicioInicio!.orden ?? 99))
    .map((p) => ({
      personId: p.id,
      title: p.servicioInicio!.titulo,
      description: p.servicioInicio!.descripcion,
      image: p.servicioInicio!.imagen || p.image,
    }));

  ngAfterViewInit(): void {
    const swiperEl = this.swiperContainer?.nativeElement as (HTMLElement & { initialize: () => void }) | undefined;
    if (!swiperEl) return;

    const params: SwiperOptions = {
      slidesPerView: 1.15,
      spaceBetween: 20,
      centeredSlides: true,
      pagination: {
        clickable: true,
        dynamicBullets: true,
      },
      navigation: {
        nextEl: '.custom-next-arrow',
        prevEl: '.custom-prev-arrow',
      },
      breakpoints: {
        640: { slidesPerView: 2, spaceBetween: 20, centeredSlides: false },
        968: { slidesPerView: 3, spaceBetween: 30, centeredSlides: false },
        1200: { slidesPerView: 4, spaceBetween: 30, centeredSlides: false },
      },
      injectStyles: [],
    };

    Object.assign(swiperEl, params);
    swiperEl.initialize();
  }

  getWhatsAppLink(servicio: Servicio): string {
    const message = `Hola, me gustaría solicitar información sobre el servicio de ${servicio.title}.`;
    const phone = this.getSpecialistPhone(servicio.personId) ?? this.fallbackPhoneNumber;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  private getSpecialistPhone(personId: number): string | null {
    const person = findPerson(personId);
    const whatsapp = person?.socials?.find((s) => s.iconClass.includes('whatsapp'));
    return whatsapp?.link.match(/wa\.me\/(\d+)/)?.[1] ?? null;
  }
}
