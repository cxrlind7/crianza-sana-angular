import { Component, computed, input, signal } from '@angular/core';
import {
  CardPerson,
  buildVCard,
  downloadBlob,
  drawBusinessCard,
  fileSafeName,
  personPhone,
  profileUrl,
  specialty,
} from '../../../core/utils/person-card';
import { trackEvent, withShareUtm } from '../../../core/utils/tracking';
import { CardQrModal } from './card-qr-modal/card-qr-modal';

interface FichaRow {
  icon: string;
  label: string;
  value: string | string[];
  link?: string;
}

@Component({
  selector: 'app-person-ficha',
  imports: [CardQrModal],
  templateUrl: './person-ficha.html',
  styleUrl: './person-ficha.scss',
})
export class PersonFicha {
  readonly person = input.required<CardPerson>();

  readonly generating = signal(false);
  readonly feedback = signal('');
  readonly qrOpen = signal(false);

  readonly rows = computed<FichaRow[]>(() => {
    const p = this.person();
    const f = p.ficha ?? {};
    const phone = personPhone(p);
    const rows: (FichaRow | null)[] = [
      { icon: 'fas fa-stethoscope', label: 'Especialidad', value: specialty(p) },
      f.cedula ? { icon: 'fas fa-id-card', label: 'Cédula profesional', value: f.cedula } : null,
      f.formacion?.length ? { icon: 'fas fa-graduation-cap', label: 'Formación', value: f.formacion } : null,
      f.experiencia ? { icon: 'fas fa-award', label: 'Experiencia', value: f.experiencia } : null,
      f.atiende ? { icon: 'fas fa-child', label: 'Atiende a', value: f.atiende } : null,
      f.modalidad ? { icon: 'fas fa-laptop-medical', label: 'Modalidad', value: f.modalidad } : null,
      f.horario ? { icon: 'fas fa-clock', label: 'Horario', value: f.horario } : null,
      phone
        ? { icon: 'fab fa-whatsapp', label: 'WhatsApp', value: phone.display, link: p.socials?.find((s) => s.iconClass.includes('whatsapp'))?.link }
        : null,
      f.direccion || p.direccion?.link
        ? { icon: 'fas fa-map-marker-alt', label: 'Dirección', value: f.direccion || 'Ver ubicación en el mapa', link: p.direccion?.link }
        : null,
    ];
    return rows.filter((r): r is FichaRow => r !== null);
  });

  isList(value: string | string[]): value is string[] {
    return Array.isArray(value);
  }

  openQr(): void {
    this.qrOpen.set(true);
    trackEvent('ver_tarjeta_qr', { link_text: this.person().name.slice(0, 100) });
  }

  async downloadCard(): Promise<void> {
    if (this.generating()) return;
    const p = this.person();
    this.generating.set(true);
    try {
      const blob = await drawBusinessCard(p);
      downloadBlob(blob, `Tarjeta-${fileSafeName(p)}.png`);
      trackEvent('descarga', { file_name: `Tarjeta digital: ${p.name}`.slice(0, 100) });
    } catch {
      this.flash('No se pudo generar la tarjeta, intenta de nuevo.');
    } finally {
      this.generating.set(false);
    }
  }

  saveContact(): void {
    const p = this.person();
    downloadBlob(buildVCard(p), `${fileSafeName(p)}.vcf`);
    trackEvent('descarga', { file_name: `Contacto: ${p.name}`.slice(0, 100) });
  }

  async share(): Promise<void> {
    const p = this.person();
    const url = withShareUtm(profileUrl(p));
    trackEvent('compartir', { method: 'perfil', link_text: p.name.slice(0, 100) });
    if (navigator.share) {
      try {
        await navigator.share({ title: p.name, text: `${p.name} · ${specialty(p)}`, url });
        return;
      } catch (err) {
        // El usuario cerró el menú de compartir: no hace falta copiar.
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      this.flash('¡Enlace copiado!');
    } catch {
      this.flash(url);
    }
  }

  private flash(text: string): void {
    this.feedback.set(text);
    setTimeout(() => this.feedback.set(''), 3000);
  }
}
