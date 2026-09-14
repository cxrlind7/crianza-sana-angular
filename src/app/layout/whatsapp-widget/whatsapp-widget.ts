import { Component, signal } from '@angular/core';
import { people } from '../../core/data/people-data';

interface SpecialistPerson {
  id: string | number;
  name: string;
  title: string;
  image: string;
  color?: string;
  socials?: { iconClass: string; link: string }[];
}

@Component({
  selector: 'app-whatsapp-widget',
  templateUrl: './whatsapp-widget.html',
  styleUrl: './whatsapp-widget.scss',
})
export class WhatsappWidget {
  readonly isChatOpen = signal(false);

  readonly people: SpecialistPerson[] = (people as SpecialistPerson[]).filter(
    (person) => person.socials && person.socials.length > 0,
  );

  toggleChat(): void {
    this.isChatOpen.update((v) => !v);
  }

  private getPhoneFromWhatsAppLink(person: SpecialistPerson): string | null {
    const whatsappSocial = person.socials?.find((s) => s.iconClass.includes('whatsapp'));
    if (whatsappSocial?.link) {
      const match = whatsappSocial.link.match(/wa\.me\/(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  }

  private getPersonalizedMessage(person: SpecialistPerson): string {
    const specialty = person.title.toLowerCase();
    let message = `Hola ${person.name}, `;

    if (specialty.includes('psicólog')) {
      message += 'me gustaría solicitar información sobre una consulta psicológica para mi hijo/a.';
    } else if (specialty.includes('nutri')) {
      message += 'estoy interesado/a en una asesoría nutricional pediátrica.';
    } else if (specialty.includes('pediatra')) {
      message += 'quisiera agendar una cita pediátrica.';
    } else if (specialty.includes('terapeuta')) {
      message += 'busco información sobre terapia para mi hijo/a.';
    } else {
      message += 'te contacto desde el sitio web de Crianza Sana, me gustaría recibir más información.';
    }

    return message;
  }

  openWhatsApp(person: SpecialistPerson): void {
    const phone = this.getPhoneFromWhatsAppLink(person);
    if (!phone) {
      console.error('No se encontró número de teléfono para', person.name);
      return;
    }

    const message = this.getPersonalizedMessage(person);
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }
}
