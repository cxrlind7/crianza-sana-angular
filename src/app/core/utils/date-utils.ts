/**
 * Convierte los distintos formatos de fecha que existen en Firestore a Date.
 *
 * - Timestamps de Firestore ({ seconds } / { _seconds } / toDate()).
 * - 'YYYY-MM-DD' → se interpreta como fecha LOCAL (new Date('2026-01-26') la toma
 *   como UTC y en México se muestra un día antes).
 * - 'MM-DD-YYYY' y 'DD-MM-YYYY' (con '-' o '/'); si el primer número es > 12 se asume día.
 * - Cualquier otro string que entienda Date (ISO con hora, etc.).
 */
export function parseFlexibleDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  if (typeof value === 'object') {
    const ts = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof ts.toDate === 'function') return ts.toDate();
    const seconds = ts.seconds ?? ts._seconds;
    return typeof seconds === 'number' ? new Date(seconds * 1000) : null;
  }

  if (typeof value === 'number') return new Date(value);
  if (typeof value !== 'string') return null;

  const str = value.trim();

  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(str);
  if (ymd) return buildLocalDate(+ymd[1], +ymd[2], +ymd[3]);

  const xyY = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(str);
  if (xyY) {
    const a = +xyY[1];
    const b = +xyY[2];
    // Por defecto MM-DD-YYYY (formato de la mayoría de los registros existentes).
    return a > 12 ? buildLocalDate(+xyY[3], b, a) : buildLocalDate(+xyY[3], a, b);
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Igual que parseFlexibleDate pero nunca devuelve null (fecha 0 para ordenar al final). */
export function toSortableTime(value: unknown): number {
  return parseFlexibleDate(value)?.getTime() ?? 0;
}

/** Formato 'YYYY-MM-DD' en hora local, el que usan los <input type="date">. */
export function toDateInputValue(value: unknown): string {
  const d = parseFlexibleDate(value);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildLocalDate(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}
