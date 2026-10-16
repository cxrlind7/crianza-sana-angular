/** "hace 5 min", "hace 3 días"… o la fecha si ya pasó más de un mes. */
export function haceCuanto(iso: string | null | undefined): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  const seg = Math.max(0, (Date.now() - fecha.getTime()) / 1000);
  if (seg < 60) return 'hace un momento';
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function iniciales(nombre: string | undefined): string {
  const partes = String(nombre ?? '')
    .replace(/^(mamá o papá)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return (partes[0]?.[0] ?? '?').toUpperCase() + (partes[1]?.[0] ?? '').toUpperCase();
}
