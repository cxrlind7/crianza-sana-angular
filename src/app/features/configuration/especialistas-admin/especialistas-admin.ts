import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PeopleStore } from '../../../core/services/people.store';
import { AwsService } from '../../../core/services/aws.service';
import { Especialista, EstadoVisibilidad, allPeople, estadoVisibilidad } from '../../../core/utils/people-visibility';

/** Redes que se editan como campos sueltos; se guardan en `socials` en este orden. */
const REDES = [
  { key: 'whatsapp', label: 'WhatsApp', icon: 'fab fa-whatsapp', bi: 'bi-whatsapp' },
  { key: 'instagram', label: 'Instagram', icon: 'fab fa-instagram', bi: 'bi-instagram' },
  { key: 'facebook', label: 'Facebook', icon: 'fab fa-facebook', bi: 'bi-facebook' },
  { key: 'tiktok', label: 'TikTok', icon: 'fab fa-tiktok', bi: 'bi-tiktok' },
  { key: 'youtube', label: 'YouTube', icon: 'fab fa-youtube', bi: 'bi-youtube' },
  { key: 'web', label: 'Sitio web', icon: 'fas fa-globe', bi: 'bi-globe' },
] as const;
type RedKey = (typeof REDES)[number]['key'];

const MENSAJE_WHATSAPP = 'Hola! Te encontré en crianza sana, quiero más información.';

interface Formulario {
  id: number | null;
  name: string;
  title: string;
  detalle: string;
  color: string;
  image: string;
  tipo: 'permanente' | 'temporal';
  vigenciaInicio: string;
  vigenciaFin: string;
  active: boolean;
  enNosotros: boolean;
  /** WhatsApp: solo los 10 dígitos; se arma el enlace wa.me al guardar. */
  redes: Record<RedKey, string>;
  mapa: string;
  inicio: { mostrar: boolean; nombreCorto: string; foto: string; especialidad: string };
  servicioInicio: { mostrar: boolean; titulo: string; descripcion: string; imagen: string; orden?: number };
  ficha: { especialidad: string; cedula: string; formacion: string; experiencia: string; atiende: string; modalidad: string; horario: string; direccion: string };
  description: string;
  mision: string;
  vision: string;
  servicios: { titulo: string; descripcion: string; image: string }[];
  preguntasFrecuentes: { pregunta: string; respuesta: string }[];
  files: { name: string; url: string }[];
}

const ESTADOS: Record<EstadoVisibilidad, { label: string; clase: string }> = {
  visible: { label: 'Visible', clase: 'ok' },
  oculto: { label: 'Oculto', clase: 'off' },
  proximo: { label: 'Próximamente', clase: 'soon' },
  vencido: { label: 'Vencido', clase: 'off' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const fechaCorta = (ymd: string) => {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

@Component({
  selector: 'app-especialistas-admin',
  imports: [FormsModule],
  templateUrl: './especialistas-admin.html',
  styleUrl: './especialistas-admin.scss',
})
export class EspecialistasAdmin {
  private readonly store = inject(PeopleStore);
  private readonly aws = inject(AwsService);

  readonly redes = REDES;
  readonly estados = ESTADOS;
  readonly lista = computed(() => allPeople());

  readonly form = signal<Formulario | null>(null);
  readonly guardando = signal(false);
  readonly subiendo = signal<string | null>(null);
  readonly mensaje = signal<{ tipo: 'success' | 'danger'; texto: string } | null>(null);
  readonly filtro = signal<'todos' | 'visible' | 'temporal' | 'oculto'>('todos');

  readonly filtrados = computed(() => {
    const f = this.filtro();
    return this.lista().filter((p) => {
      const e = estadoVisibilidad(p);
      if (f === 'visible') return e === 'visible';
      if (f === 'temporal') return p.tipo === 'temporal';
      if (f === 'oculto') return e !== 'visible';
      return true;
    });
  });

  readonly conteo = computed(() => ({
    visibles: this.lista().filter((p) => estadoVisibilidad(p) === 'visible').length,
    temporales: this.lista().filter((p) => p.tipo === 'temporal').length,
  }));

  estado(p: Especialista) {
    return ESTADOS[estadoVisibilidad(p)];
  }

  vigenciaTexto(p: Especialista): string {
    if (p.tipo !== 'temporal') return '';
    const { inicio, fin } = p.vigencia ?? { inicio: '', fin: '' };
    if (inicio && fin) return `Del ${fechaCorta(inicio)} al ${fechaCorta(fin)}`;
    if (fin) return `Hasta el ${fechaCorta(fin)}`;
    if (inicio) return `Desde el ${fechaCorta(inicio)}`;
    return 'Sin fechas';
  }

  dondeAparece(p: Especialista): string[] {
    const lugares: string[] = ['Perfil'];
    if (p.inicio?.mostrar && p.inicio.foto) lugares.push('Fotos del inicio');
    if (p.servicioInicio?.mostrar) lugares.push('Servicios del inicio');
    if (p.enNosotros !== false) lugares.push('¿Quiénes somos?');
    if (p.socials?.some((s) => s.iconClass.includes('whatsapp'))) lugares.push('WhatsApp');
    return lugares;
  }

  // ------------------------------------------------------------------ Lista

  async mover(p: Especialista, dir: -1 | 1): Promise<void> {
    const ids = this.lista().map((x) => x.id);
    const i = ids.indexOf(p.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await this.correr(() => this.store.reorder(ids), 'Orden actualizado.');
  }

  async alternarVisible(p: Especialista): Promise<void> {
    const ocultar = p.active !== false;
    if (ocultar && !confirm(`¿Ocultar a ${p.name} del sitio? Sus blogs y estadísticas se conservan.`)) return;
    await this.correr(() => this.store.update(p.id, { active: !ocultar }), ocultar ? 'Oculto del sitio.' : 'Visible en el sitio.');
  }

  async eliminar(p: Especialista): Promise<void> {
    if (!confirm(`¿Eliminar a ${p.name} por completo? Si solo quieres que no aparezca, usa "Ocultar". No se puede deshacer.`)) return;
    await this.correr(() => this.store.remove(p.id), 'Eliminado.');
    this.form.set(null);
  }

  eliminarActual(): void {
    const p = this.lista().find((x) => x.id === this.form()?.id);
    if (p) this.eliminar(p);
  }

  private async correr(fn: () => Promise<unknown>, exito: string): Promise<boolean> {
    this.guardando.set(true);
    this.mensaje.set(null);
    try {
      await fn();
      await this.store.load(true);
      this.mensaje.set({ tipo: 'success', texto: exito });
      return true;
    } catch {
      this.mensaje.set({ tipo: 'danger', texto: 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.' });
      return false;
    } finally {
      this.guardando.set(false);
    }
  }

  // ------------------------------------------------------------------ Formulario

  nuevo(): void {
    this.mensaje.set(null);
    this.form.set(this.aFormulario(null));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  editar(p: Especialista): void {
    this.mensaje.set(null);
    this.form.set(this.aFormulario(p));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelar(): void {
    this.form.set(null);
  }

  /** Actualiza un campo (también anidado con "inicio.foto") sin perder la reactividad. */
  set(path: string, value: unknown): void {
    this.form.update((f) => {
      if (!f) return f;
      const copia = structuredClone(f) as unknown as Record<string, unknown>;
      const partes = path.split('.');
      let obj = copia;
      for (const k of partes.slice(0, -1)) obj = obj[k] as Record<string, unknown>;
      obj[partes[partes.length - 1]] = value;
      return copia as unknown as Formulario;
    });
  }

  agregar(lista: 'servicios' | 'preguntasFrecuentes' | 'files'): void {
    const vacio = { servicios: { titulo: '', descripcion: '', image: '' }, preguntasFrecuentes: { pregunta: '', respuesta: '' }, files: { name: '', url: '' } }[lista];
    this.form.update((f) => (f ? { ...f, [lista]: [...f[lista], vacio] } : f));
  }

  quitar(lista: 'servicios' | 'preguntasFrecuentes' | 'files', i: number): void {
    this.form.update((f) => (f ? { ...f, [lista]: (f[lista] as unknown[]).filter((_, k) => k !== i) } : f));
  }

  async subir(event: Event, path: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.subiendo.set(path);
    try {
      const url = await this.aws.uploadFile(file, 'especialista');
      if (url) this.set(path, url);
      else this.mensaje.set({ tipo: 'danger', texto: 'No se pudo subir el archivo.' });
    } finally {
      this.subiendo.set(null);
      input.value = '';
    }
  }

  async guardar(): Promise<void> {
    const f = this.form();
    if (!f) return;
    if (!f.name.trim() || !f.title.trim()) {
      this.mensaje.set({ tipo: 'danger', texto: 'El nombre y la especialidad son obligatorios.' });
      return;
    }
    if (f.tipo === 'temporal' && f.vigenciaInicio && f.vigenciaFin && f.vigenciaFin < f.vigenciaInicio) {
      this.mensaje.set({ tipo: 'danger', texto: 'La fecha de fin es anterior a la de inicio.' });
      return;
    }
    const tel = f.redes.whatsapp.replace(/\D/g, '');
    if (tel && tel.length !== 10 && tel.length !== 12) {
      this.mensaje.set({ tipo: 'danger', texto: 'El WhatsApp debe tener 10 dígitos (ej. 6181234567).' });
      return;
    }
    const data = this.aDatos(f);
    const ok = await this.correr(
      async () => {
        if (f.id === null) {
          const res = await this.store.create(data);
          this.form.update((x) => (x ? { ...x, id: res.id } : x));
        } else {
          await this.store.update(f.id, data);
        }
      },
      f.id === null ? `${f.name} se dio de alta.` : 'Cambios guardados.',
    );
    if (ok) this.form.set(null);
  }

  // ------------------------------------------------------------------ Conversión

  private aFormulario(p: Especialista | null): Formulario {
    const red = (k: RedKey) => p?.socials?.find((s) => s.iconClass.includes(REDES.find((r) => r.key === k)!.icon.split(' ')[1]))?.link ?? '';
    const wa = red('whatsapp').match(/wa\.me\/(\d+)/)?.[1] ?? '';
    const ficha = (p?.ficha ?? {}) as Record<string, unknown>;
    return {
      id: p?.id ?? null,
      name: p?.name ?? '',
      title: (p?.title ?? '').trim(),
      detalle: p?.detalle ?? '',
      color: p?.color ?? '#7c3aed',
      image: p?.image ?? '',
      tipo: p?.tipo ?? 'permanente',
      vigenciaInicio: p?.vigencia?.inicio ?? '',
      vigenciaFin: p?.vigencia?.fin ?? '',
      active: p ? p.active !== false : true,
      enNosotros: p ? p.enNosotros !== false : true,
      redes: {
        whatsapp: wa.length === 12 ? wa.slice(2) : wa,
        instagram: red('instagram').trim(),
        facebook: red('facebook'),
        tiktok: red('tiktok'),
        youtube: red('youtube'),
        web: red('web'),
      },
      mapa: p?.direccion?.link ?? '',
      inicio: { mostrar: false, nombreCorto: '', foto: '', especialidad: '', ...(p?.inicio ?? {}) },
      servicioInicio: { mostrar: false, titulo: '', descripcion: '', imagen: '', ...(p?.servicioInicio ?? {}) },
      ficha: {
        especialidad: String(ficha['especialidad'] ?? ''),
        cedula: String(ficha['cedula'] ?? ''),
        formacion: ((ficha['formacion'] as string[]) ?? []).join('\n'),
        experiencia: String(ficha['experiencia'] ?? ''),
        atiende: String(ficha['atiende'] ?? ''),
        modalidad: String(ficha['modalidad'] ?? ''),
        horario: String(ficha['horario'] ?? ''),
        direccion: String(ficha['direccion'] ?? ''),
      },
      description: p?.description ?? '',
      mision: p?.mision ?? '',
      vision: p?.vision ?? '',
      servicios: structuredClone(p?.servicios ?? []),
      preguntasFrecuentes: structuredClone(p?.preguntasFrecuentes ?? []),
      files: structuredClone(p?.files ?? []),
    };
  }

  private aDatos(f: Formulario): Partial<Especialista> {
    const tel = f.redes.whatsapp.replace(/\D/g, '');
    const socials = REDES.flatMap((r): { iconClass: string; link: string }[] => {
      if (r.key === 'whatsapp') {
        if (!tel) return [];
        const numero = tel.length === 10 ? `52${tel}` : tel;
        return [{ iconClass: r.icon, link: `https://wa.me/${numero}?text=${encodeURIComponent(MENSAJE_WHATSAPP)}` }];
      }
      const link = f.redes[r.key].trim();
      return link ? [{ iconClass: r.icon, link }] : [];
    });
    // Solo los datos de ficha con valor (la ficha muestra únicamente los renglones llenos).
    const ficha = Object.fromEntries(
      Object.entries({
        ...f.ficha,
        formacion: f.ficha.formacion
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      }).filter(([, v]) => (Array.isArray(v) ? v.length : String(v).trim())),
    );
    return {
      name: f.name.trim(),
      title: f.title.trim(),
      detalle: f.detalle.trim(),
      color: f.color,
      image: f.image.trim(),
      tipo: f.tipo,
      vigencia: f.tipo === 'temporal' ? { inicio: f.vigenciaInicio, fin: f.vigenciaFin } : { inicio: '', fin: '' },
      active: f.active,
      enNosotros: f.enNosotros,
      socials,
      direccion: { iconClass: 'fab fa-maps', link: f.mapa.trim() },
      inicio: f.inicio,
      servicioInicio: f.servicioInicio,
      ficha,
      description: f.description.trim(),
      mision: f.mision.trim(),
      vision: f.vision.trim(),
      servicios: f.servicios.filter((s) => s.titulo.trim()),
      preguntasFrecuentes: f.preguntasFrecuentes.filter((q) => q.pregunta.trim()),
      files: f.files.filter((x) => x.name.trim() && x.url.trim()),
    };
  }

  hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
