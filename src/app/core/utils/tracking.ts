/**
 * Eventos de Google Analytics del sitio.
 *
 * Los parámetros usan nombres que GA4 ya trae como dimensiones (link_url, link_text,
 * video_title, video_url, video_provider, method, file_name), así el backend puede
 * desglosarlos con la Data API sin registrar dimensiones personalizadas en GA.
 */

type Gtag = (...args: unknown[]) => void;

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  const gtag = (window as { gtag?: Gtag }).gtag;
  if (typeof gtag === 'function') gtag('event', name, params);
}

const WHATSAPP_URL = /(?:wa\.me|api\.whatsapp\.com|whatsapp:\/\/)/i;
const SOCIAL_DOMAINS = ['instagram.com', 'facebook.com', 'fb.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'spotify.com'];

/** wa.me/<teléfono> sin el mensaje prellenado, para agrupar clics por número. */
function whatsappTarget(url: string): string {
  const phone = url.match(/(?:wa\.me\/|phone=)(\d+)/)?.[1];
  return phone ? `wa.me/${phone}` : 'whatsapp';
}

export function trackWhatsappClick(url: string, label: string): void {
  trackEvent('click_whatsapp', { link_url: whatsappTarget(url), link_text: label.slice(0, 100) });
}

function linkLabel(a: HTMLAnchorElement): string {
  return (
    a.dataset['trackLabel'] ||
    a.getAttribute('aria-label') ||
    a.title ||
    a.textContent?.replace(/\s+/g, ' ').trim() ||
    ''
  );
}

/**
 * Listeners globales: clics a WhatsApp y redes sociales en cualquier <a>, y reproducciones
 * de cualquier <video> propio. Se instala una sola vez desde App.
 */
export function initGlobalTracking(): void {
  document.addEventListener(
    'click',
    (event) => {
      const a = (event.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.href;
      if (WHATSAPP_URL.test(href)) {
        trackWhatsappClick(href, linkLabel(a));
        return;
      }
      let host = '';
      try {
        host = new URL(href).hostname.replace(/^www\.|^m\./, '');
      } catch {
        return;
      }
      const domain = SOCIAL_DOMAINS.find((d) => host === d || host.endsWith(`.${d}`));
      if (domain) {
        trackEvent('click_red_social', { link_url: href.slice(0, 100), link_domain: domain, link_text: linkLabel(a).slice(0, 100) });
      }
    },
    true,
  );

  // 'play' y 'ended' no burbujean; en fase de captura sí llegan al document.
  const started = new WeakMap<HTMLVideoElement, string>();
  const videoParams = (video: HTMLVideoElement) => {
    const url = video.currentSrc || video.src || video.querySelector('source')?.src || '';
    return {
      video_title: (video.dataset['videoTitle'] || url.split('/').pop() || 'video').slice(0, 100),
      video_url: url.slice(0, 100),
      video_provider: 'propio',
    };
  };
  document.addEventListener(
    'play',
    (event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      const params = videoParams(video);
      if (started.get(video) === params.video_url) return; // pausar y reanudar no cuenta doble
      started.set(video, params.video_url);
      trackEvent('ver_video', params);
    },
    true,
  );
  document.addEventListener(
    'ended',
    (event) => {
      if (event.target instanceof HTMLVideoElement) trackEvent('video_completo', videoParams(event.target));
    },
    true,
  );
}

/** Agrega UTM a los links que la gente copia, para no confundirlos con tráfico "directo". */
export function withShareUtm(url: string, source = 'compartido'): string {
  const u = new URL(url);
  u.searchParams.set('utm_source', source);
  u.searchParams.set('utm_medium', 'enlace');
  return u.toString();
}

const ultimaBusqueda: Record<string, string> = {};
const temporizadores: Record<string, ReturnType<typeof setTimeout>> = {};

/**
 * Lo que escriben en un buscador (evento recomendado de GA4 `search` con `search_term`).
 * Espera a que dejen de escribir y no repite el mismo término seguido, para registrar
 * búsquedas completas y no cada letra.
 */
export function trackSearch(term: string, method: 'blog' | 'foro'): void {
  clearTimeout(temporizadores[method]);
  const limpio = term.trim().toLowerCase();
  if (limpio.length < 3) return;
  temporizadores[method] = setTimeout(() => {
    if (ultimaBusqueda[method] === limpio) return;
    ultimaBusqueda[method] = limpio;
    trackEvent('search', { search_term: limpio.slice(0, 100), method });
  }, 1500);
}
