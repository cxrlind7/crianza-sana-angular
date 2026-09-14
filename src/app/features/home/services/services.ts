import { AfterViewInit, CUSTOM_ELEMENTS_SCHEMA, Component, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { SwiperOptions } from 'swiper/types';

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

  readonly clinicPhoneNumber = '5215512345678';

  readonly servicios: Servicio[] = [
    {
      personId: 9,
      title: 'Terapia de lenguaje',
      description: 'Terapia de lenguaje para retrasos, trastornos del habla y comunicación.',
      image: '/trlenguaje.jpg',
    },
    {
      personId: 3,
      title: 'Nutrición',
      description:
        'Facilitar cambios de hábitos con soluciones personalizadas para un peso saludable y control de enfermedades.',
      image: '/Nutricion1.png',
    },
    {
      personId: 2,
      title: 'Terapia cognitivo-conductual',
      description:
        'Brindar atención cognitiva, personal, social y emocional a los niños y niñas en la primera etapa de su infancia.',
      image: '/CarinaInfo.png',
    },
    {
      personId: 6,
      title: 'Psicología',
      description:
        'Psicoterapia para niños y adolescentes con el objetivo de potencializar su desarrollo. Asesoría en crianza para padres.',
      image: '/ServicioPsicologia.jpg',
    },
    {
      personId: 4,
      title: 'Odontopediatría',
      description:
        'Orientada a la prevención, curación y mantenimiento de la salud oral de bebés, niños y adolescentes.',
      image: '/Odontopediatria1.png',
    },
    {
      personId: 5,
      title: 'Pediatría y Cardiología',
      description: 'Control de niño sano y enfermo, lactancia, vacunas, cardiopatías.',
      image: '/CardiologiaPediatra.png',
    },
    {
      personId: 1,
      title: 'Fisioterapia',
      description:
        'Comprometidos con el bienestar de nuestros pacientes, brindando atención segura y de calidad para mejorar su salud.',
      image: '/Fisioterapia1.jpeg',
    },
    {
      personId: 8,
      title: 'Derecho',
      description:
        'Servicios jurídicos y asesoría especializada con compromiso ético, responsable y justo, garantizando confianza.',
      image: '/Derecho1.jpeg',
    },
  ];

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

  getWhatsAppLink(serviceTitle: string): string {
    const message = `Hola, me gustaría solicitar información sobre el servicio de ${serviceTitle}.`;
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${this.clinicPhoneNumber}?text=${encodedMessage}`;
  }
}
