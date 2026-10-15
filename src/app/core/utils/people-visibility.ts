import { people } from '../data/people-data';
import { areNamesEquivalent } from './string-utils';

/**
 * Especialistas ocultos: se marcan con `active: false` en people-data.ts.
 * Siguen existiendo (analytics, color/foto de autor en blogs viejos), pero no se muestran
 * en el sitio: home, about, servicios, WhatsApp, perfil y selector de participantes.
 */

/**
 * Si es true, los blogs cuyo autor está oculto también desaparecen del listado y del home.
 * Por ahora sus blogs se quedan publicados.
 */
export const HIDE_BLOGS_OF_INACTIVE_AUTHORS = false;

const inactivePeople = (people as { id: number; name: string; active?: boolean }[]).filter(
  (p) => p.active === false,
);

export function isPersonActive(id: number | string | null | undefined): boolean {
  return !inactivePeople.some((p) => p.id === Number(id));
}

export const activePeople = (people as { id: number }[]).filter((p) => isPersonActive(p.id));

export function isAuthorInactive(authorName: string | null | undefined): boolean {
  return inactivePeople.some((p) => areNamesEquivalent(p.name, authorName));
}

export function filterBlogsByActiveAuthors<T extends { authorName?: string }>(blogs: T[]): T[] {
  if (!HIDE_BLOGS_OF_INACTIVE_AUTHORS) return blogs;
  return blogs.filter((b) => !isAuthorInactive(b.authorName));
}
