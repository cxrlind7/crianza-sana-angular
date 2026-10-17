/**
 * Ficha técnica y tarjeta digital de cada especialista (perfil tipo Doctoralia).
 *
 * Todo se genera en el navegador: la tarjeta es un PNG dibujado en canvas y el
 * contacto un .vcf, así se pueden mandar por WhatsApp sin depender del backend.
 */

import { withShareUtm } from './tracking';

/** Datos opcionales de la ficha; cada renglón solo se muestra si tiene valor. */
export interface PersonFichaData {
  especialidad?: string;
  cedula?: string;
  formacion?: string[];
  experiencia?: string;
  atiende?: string;
  modalidad?: string;
  horario?: string;
  direccion?: string;
}

export interface CardPerson {
  id: number;
  name: string;
  title: string;
  image: string;
  color: string;
  socials?: { iconClass: string; link: string }[];
  direccion?: { link: string };
  ficha?: PersonFichaData;
}

/** Siempre el dominio público, para que el QR funcione aunque se genere en local. */
export const SITE_URL = 'https://crianzasanabydkids.mx';

/**
 * Carga la librería del QR solo cuando hace falta. Es CommonJS: en el build de producción sus
 * funciones llegan dentro de `default` (en desarrollo no), así que se aceptan las dos formas.
 */
export async function loadQRCode(): Promise<typeof import('qrcode')> {
  const mod = (await import('qrcode')) as typeof import('qrcode') & { default?: typeof import('qrcode') };
  return mod.default && typeof mod.default.toDataURL === 'function' ? mod.default : mod;
}

export function profileUrl(person: Pick<CardPerson, 'id'>): string {
  return `${SITE_URL}/person/${person.id}`;
}

/** URL del QR, etiquetada para que analytics cuente las visitas que llegan escaneando. */
export function qrUrl(person: Pick<CardPerson, 'id'>, source: 'qr' | 'tarjeta'): string {
  return withShareUtm(profileUrl(person), source);
}

/** Teléfono tomado del enlace de WhatsApp del perfil (wa.me/52XXXXXXXXXX). */
export function personPhone(person: CardPerson): { e164: string; display: string } | null {
  const link = person.socials?.find((s) => s.iconClass.includes('whatsapp'))?.link ?? '';
  const digits = link.match(/(?:wa\.me\/|phone=)(\d{10,15})/)?.[1];
  if (!digits) return null;
  const local = digits.slice(-10);
  return { e164: `+${digits}`, display: `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` };
}

export function specialty(person: CardPerson): string {
  return (person.ficha?.especialidad || person.title).trim();
}

export function fileSafeName(person: CardPerson): string {
  return person.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------- vCard

function vcardEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

export function buildVCard(person: CardPerson): Blob {
  const phone = personPhone(person);
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N;CHARSET=UTF-8:;${vcardEscape(person.name)};;;`,
    `FN;CHARSET=UTF-8:${vcardEscape(person.name)}`,
    'ORG;CHARSET=UTF-8:Crianza Sana',
    `TITLE;CHARSET=UTF-8:${vcardEscape(specialty(person))}`,
    phone ? `TEL;TYPE=CELL:${phone.e164}` : '',
    person.ficha?.direccion ? `ADR;TYPE=WORK;CHARSET=UTF-8:;;${vcardEscape(person.ficha.direccion)};;;;` : '',
    `URL:${profileUrl(person)}`,
    'END:VCARD',
  ].filter(Boolean);
  return new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/vcard;charset=utf-8' });
}

// ---------------------------------------------------------------- Tarjeta PNG

const CARD_W = 1080;
const CARD_H = 1350;
const PAD = 90;
const BAND_H = 330;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Parte un texto en renglones que quepan en `maxWidth`, con tope de renglones. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number): void {
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  // Las fotos de perfil tienen la cara en la parte de arriba: se recorta desde arriba.
  ctx.drawImage(img, x + (size - w) / 2, y + Math.min(0, (size - h) * 0.2), w, h);
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '').match(/^([\da-f]{2})([\da-f]{2})([\da-f]{2})/i);
  if (!m) return `rgba(124, 58, 237, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

export async function drawBusinessCard(person: CardPerson): Promise<Blob> {
  const QRCode = await loadQRCode();
  const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const color = person.color || '#7c3aed';

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;

  const [photo, logo] = await Promise.all([loadImage(person.image), loadImage('/logo_sin_fondo.png')]);

  // Fondo y franja superior con el color de la persona.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const band = ctx.createLinearGradient(0, 0, CARD_W, BAND_H);
  band.addColorStop(0, color);
  band.addColorStop(1, hexToRgba(color, 0.55));
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, CARD_W, BAND_H);

  // Logo en una píldora blanca.
  if (logo) {
    const h = 70;
    const w = (logo.width / logo.height) * h;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(PAD - 24, 60, w + 48, h + 28, 49);
    ctx.fill();
    ctx.drawImage(logo, PAD, 74, w, h);
  }

  // Foto circular que se monta sobre la franja.
  const size = 280;
  const cx = CARD_W / 2;
  const cy = BAND_H;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 + 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (photo) {
    drawCover(ctx, photo, cx - size / 2, cy - size / 2, size);
  } else {
    ctx.fillStyle = hexToRgba(color, 0.15);
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    ctx.fillStyle = color;
    ctx.font = `700 120px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = person.name.replace(/^\S+\.\s*/, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
    ctx.fillText(initials, cx, cy);
  }
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Nombre y especialidad.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let y = cy + size / 2 + 90;
  ctx.fillStyle = '#1f2937';
  ctx.font = `700 64px ${font}`;
  for (const line of wrapLines(ctx, person.name, CARD_W - PAD * 2, 2)) {
    ctx.fillText(line, cx, y);
    y += 74;
  }
  ctx.fillStyle = color;
  ctx.font = `600 34px ${font}`;
  for (const line of wrapLines(ctx, specialty(person).toUpperCase(), CARD_W - PAD * 2, 2)) {
    ctx.fillText(line, cx, y);
    y += 44;
  }

  // Datos de contacto.
  y += 20;
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(CARD_W - PAD, y);
  ctx.stroke();
  y += 60;

  const phone = personPhone(person);
  const rows: [string, string][] = [];
  if (phone) rows.push(['WhatsApp', phone.display]);
  if (person.ficha?.direccion) rows.push(['Dirección', person.ficha.direccion]);
  if (person.ficha?.horario) rows.push(['Horario', person.ficha.horario]);
  if (person.ficha?.cedula) rows.push(['Cédula profesional', person.ficha.cedula]);

  const qrSize = 210;
  const qrTop = CARD_H - 80 - qrSize;
  ctx.textAlign = 'left';
  for (const [label, value] of rows) {
    ctx.font = `600 24px ${font}`;
    const valueLines = (() => {
      ctx.font = `400 34px ${font}`;
      return wrapLines(ctx, value, CARD_W - PAD * 2, 2);
    })();
    // Solo entra lo que no se encime con el QR; si un dato largo no cabe, se prueba con el siguiente.
    if (y + 40 + valueLines.length * 42 > qrTop - 24) continue;
    ctx.fillStyle = color;
    ctx.font = `600 24px ${font}`;
    ctx.fillText(label.toUpperCase(), PAD, y);
    y += 40;
    ctx.fillStyle = '#374151';
    ctx.font = `400 34px ${font}`;
    for (const line of valueLines) {
      ctx.fillText(line, PAD, y);
      y += 42;
    }
    y += 18;
  }

  // QR al perfil.
  const url = profileUrl(person);
  const qr = await loadImage(
    await QRCode.toDataURL(qrUrl(person, 'tarjeta'), { width: qrSize, margin: 0, color: { dark: '#1f2937', light: '#ffffff' } }),
  );
  if (qr) ctx.drawImage(qr, PAD, qrTop, qrSize, qrSize);
  const textX = PAD + qrSize + 40;
  ctx.fillStyle = '#1f2937';
  ctx.font = `700 36px ${font}`;
  ctx.fillText('Escanea y conoce', textX, qrTop + 70);
  ctx.fillText('mi perfil completo', textX, qrTop + 114);
  ctx.fillStyle = '#6b7280';
  ctx.font = `400 26px ${font}`;
  ctx.fillText(url.replace(/^https?:\/\//, ''), textX, qrTop + 166);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas'))), 'image/png'),
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
