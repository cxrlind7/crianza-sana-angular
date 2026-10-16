import { signal } from '@angular/core';
import { areNamesEquivalent } from './string-utils';

/**
 * Especialistas y colaboradores. Vienen de Firestore (`especialistas`) vía /api/especialistas;
 * PeopleStore los carga al arrancar la app (antes de mostrar páginas) y los pone aquí.
 *
 * Quién se muestra en el sitio:
 *  - `active: false` → oculto a mano (sigue existiendo para analytics y autores de blogs viejos).
 *  - `tipo: 'temporal'` con `vigencia` → solo se muestra entre `inicio` y `fin` (inclusive).
 */

export interface Especialista {
  id: number;
  name: string;
  title: string;
  image: string;
  color: string;
  detalle?: string;
  description?: string;
  mision?: string;
  vision?: string;
  socials?: { iconClass: string; link: string }[];
  direccion?: { iconClass?: string; link: string };
  servicios?: { titulo: string; descripcion: string; image: string }[];
  preguntasFrecuentes?: { pregunta: string; respuesta: string }[];
  files?: { name: string; url: string }[];
  ficha?: Record<string, unknown>;
  instagramProfileData?: Record<string, unknown> | null;
  youtubeVideos?: { id: string; title: string }[];
  youtubeChannelUrl?: string;
  active?: boolean;
  tipo?: 'permanente' | 'temporal';
  vigencia?: { inicio: string; fin: string };
  orden?: number;
  /** Aparece en la página "¿Quiénes somos?". */
  enNosotros?: boolean;
  /** Foto tipo polaroid del inicio. */
  inicio?: { mostrar: boolean; nombreCorto: string; foto: string; especialidad: string };
  /** Tarjeta en el carrusel de servicios del inicio. */
  servicioInicio?: { mostrar: boolean; titulo: string; descripcion: string; imagen: string; orden?: number };
  [key: string]: unknown;
}

export type EstadoVisibilidad = 'visible' | 'oculto' | 'proximo' | 'vencido';

/**
 * Si es true, los blogs cuyo autor está oculto también desaparecen del listado y del home.
 * Por ahora sus blogs se quedan publicados.
 */
export const HIDE_BLOGS_OF_INACTIVE_AUTHORS = false;

const people = signal<Especialista[]>([]);

export function setPeople(list: Especialista[]): void {
  people.set([...list].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)));
}

/** Todos, incluidos los ocultos (para analytics, autores de blogs, admin). Es reactivo. */
export function allPeople(): Especialista[] {
  return people();
}

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function estadoVisibilidad(p: Especialista, fecha = hoy()): EstadoVisibilidad {
  if (p.active === false) return 'oculto';
  if (p.tipo === 'temporal') {
    if (p.vigencia?.inicio && fecha < p.vigencia.inicio) return 'proximo';
    if (p.vigencia?.fin && fecha > p.vigencia.fin) return 'vencido';
  }
  return 'visible';
}

export function isPersonActive(id: number | string | null | undefined): boolean {
  const p = people().find((x) => x.id === Number(id));
  return !!p && estadoVisibilidad(p) === 'visible';
}

/** Los que se muestran hoy en el sitio, en su orden. */
export function getActivePeople(): Especialista[] {
  return people().filter((p) => estadoVisibilidad(p) === 'visible');
}

export function findPerson(id: number | string | null | undefined): Especialista | undefined {
  return people().find((x) => x.id === Number(id));
}

/** El autor existe como especialista pero hoy no se muestra. */
export function isAuthorInactive(authorName: string | null | undefined): boolean {
  return people().some((p) => estadoVisibilidad(p) !== 'visible' && areNamesEquivalent(p.name, authorName));
}

export function filterBlogsByActiveAuthors<T extends { authorName?: string }>(blogs: T[]): T[] {
  if (!HIDE_BLOGS_OF_INACTIVE_AUTHORS) return blogs;
  return blogs.filter((b) => !isAuthorInactive(b.authorName));
}
