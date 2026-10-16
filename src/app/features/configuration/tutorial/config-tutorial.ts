import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, computed, input, signal } from '@angular/core';
import { Accion, Formulario, Objetivo, Paso, RECORRIDOS, Recorrido, Seccion } from './tours';

/** Lo que el tutorial necesita de la página de Configuración para preparar cada paso. */
export interface TutorialHost {
  irA(seccion: Seccion): void;
  abrirFormulario(tipo: Formulario): void;
  cerrarFormulario(): void;
}

interface Caja {
  top: number;
  left: number;
  width: number;
  height: number;
}

const COMPLETADOS_KEY = 'cfg-tutorial-completados';
const VISTO_KEY = 'cfg-tutorial-bienvenida';
const MARGEN = 8;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tutorial interactivo de Configuración: lista de recorridos y, al iniciar uno, un resaltado
 * sobre el elemento de cada paso con su explicación. Solo muestra; nunca guarda nada.
 */
@Component({
  selector: 'app-config-tutorial',
  templateUrl: './config-tutorial.html',
  styleUrl: './config-tutorial.scss',
})
export class ConfigTutorial implements AfterViewInit, OnDestroy {
  readonly host = input.required<TutorialHost>();

  readonly recorridos = RECORRIDOS;
  readonly menuAbierto = signal(false);
  readonly recorrido = signal<Recorrido | null>(null);
  readonly indice = signal(0);
  readonly caja = signal<Caja | null>(null);
  readonly preparando = signal(false);
  readonly completados = signal<Set<string>>(this.leerCompletados());
  /** Invitación la primera vez que se entra a Configuración. */
  readonly invitacion = signal(this.primeraVez());

  readonly paso = computed<Paso | null>(() => this.recorrido()?.pasos[this.indice()] ?? null);
  readonly total = computed(() => this.recorrido()?.pasos.length ?? 0);
  readonly progreso = computed(() => `${this.completados().size} de ${RECORRIDOS.length} recorridos`);

  /** Dónde va la tarjeta: junto al elemento resaltado, o al centro si no hay. */
  readonly posicion = computed(() => {
    const c = this.caja();
    const ancho = Math.min(360, window.innerWidth - 2 * MARGEN);
    const alto = 230;
    if (!c || window.innerWidth < 640) return { centro: !c, top: null as number | null, left: null as number | null, ancho };
    let top = c.top + c.height + 14;
    if (top + alto > window.innerHeight - MARGEN) top = c.top - alto - 14;
    if (top < MARGEN) top = Math.min(window.innerHeight - alto - MARGEN, Math.max(MARGEN, c.top + c.height / 2 - alto / 2));
    let left = c.left + c.width / 2 - ancho / 2;
    // Si el elemento ocupa casi toda la altura, la tarjeta va a un lado.
    if (c.height > window.innerHeight * 0.6) {
      left = c.left + c.width + 14 + ancho < window.innerWidth ? c.left + c.width + 14 : Math.max(MARGEN, c.left - ancho - 14);
      top = Math.max(MARGEN + 60, Math.min(window.innerHeight - alto - MARGEN, c.top + 20));
    }
    left = Math.min(window.innerWidth - ancho - MARGEN, Math.max(MARGEN, left));
    return { centro: false, top, left, ancho };
  });

  private elemento: HTMLElement | null = null;
  private turno = 0;

  /** Las capas van en <body>: dentro del encabezado, un contenedor las dejaba debajo del formulario abierto. */
  @ViewChild('capa') capa?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    const el = this.capa?.nativeElement;
    if (el && el.parentElement !== document.body) document.body.appendChild(el);
  }

  ngOnDestroy(): void {
    this.capa?.nativeElement.remove();
    document.body.classList.remove('tut-activo');
  }

  // ------------------------------------------------------------------ Menú

  abrirMenu(): void {
    this.invitacion.set(false);
    this.marcarVisto();
    this.menuAbierto.set(true);
  }

  cerrarInvitacion(): void {
    this.invitacion.set(false);
    this.marcarVisto();
  }

  // ------------------------------------------------------------------ Recorrido

  async iniciar(r: Recorrido): Promise<void> {
    this.menuAbierto.set(false);
    this.invitacion.set(false);
    this.marcarVisto();
    this.recorrido.set(r);
    document.body.classList.add('tut-activo');
    await this.mostrar(0);
  }

  async siguiente(): Promise<void> {
    const r = this.recorrido();
    if (!r) return;
    if (this.indice() < r.pasos.length - 1) {
      await this.mostrar(this.indice() + 1);
    } else {
      this.completados.update((s) => new Set(s).add(r.id));
      this.guardarCompletados();
      await this.salir(true);
    }
  }

  async anterior(): Promise<void> {
    if (this.indice() > 0) await this.mostrar(this.indice() - 1);
  }

  async salir(volverAlMenu = false): Promise<void> {
    const r = this.recorrido();
    this.turno++;
    this.recorrido.set(null);
    this.caja.set(null);
    this.elemento = null;
    document.body.classList.remove('tut-activo');
    if (r?.alSalir) await this.ejecutar(r.alSalir);
    if (volverAlMenu) this.menuAbierto.set(true);
  }

  private async mostrar(i: number): Promise<void> {
    const r = this.recorrido();
    if (!r) return;
    const turno = ++this.turno;
    const paso = r.pasos[i];
    this.indice.set(i);
    this.preparando.set(true);
    this.caja.set(null);
    if (paso.antes) await this.ejecutar(paso.antes);
    const el = paso.objetivo ? await this.buscar(paso.objetivo) : null;
    if (turno !== this.turno) return; // se avanzó o se salió mientras se preparaba
    this.elemento = el;
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await esperar(380);
    }
    this.medir();
    this.preparando.set(false);
  }

  private async ejecutar(acciones: Accion[]): Promise<void> {
    const host = this.host();
    for (const a of acciones) {
      if ('ir' in a) host.irA(a.ir);
      else if ('crear' in a) host.abrirFormulario(a.crear);
      else if ('cerrarFormulario' in a) host.cerrarFormulario();
      else if ('click' in a) (await this.buscar(a.click, 4000))?.click();
      await esperar(250);
    }
  }

  /** Espera a que el elemento exista (las secciones cargan sus datos) hasta un tope. */
  private async buscar(o: Objetivo, tope = 5000): Promise<HTMLElement | null> {
    const inicio = Date.now();
    while (Date.now() - inicio < tope) {
      const el = this.encontrar(o);
      if (el) return el;
      await esperar(150);
    }
    return null;
  }

  private encontrar(o: Objetivo): HTMLElement | null {
    const candidatos = Array.from(document.querySelectorAll<HTMLElement>(o.sel)).filter(
      (el) => el.offsetParent !== null || el.getClientRects().length > 0,
    );
    if (o.etiqueta) {
      for (const raiz of candidatos) {
        const label = Array.from(raiz.querySelectorAll<HTMLElement>('label')).find((l) => l.textContent?.includes(o.etiqueta!));
        if (label) return label.closest<HTMLElement>('.mb-3, [class*="col-"]') ?? label.parentElement;
      }
      return null;
    }
    const el = o.texto ? candidatos.find((c) => c.textContent?.includes(o.texto!)) : candidatos[0];
    if (!el) return null;
    // Un título solo resalta mejor con su bloque.
    return /^H[1-6]$/.test(el.tagName) ? (el.parentElement ?? el) : el;
  }

  private medir(): void {
    const el = this.elemento;
    if (!el || !document.body.contains(el)) {
      this.caja.set(null);
      return;
    }
    const r = el.getBoundingClientRect();
    this.caja.set({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onMover(): void {
    if (this.recorrido() && !this.preparando()) this.medir();
  }

  @HostListener('document:keydown', ['$event'])
  onTecla(e: KeyboardEvent): void {
    if (!this.recorrido()) return;
    if (e.key === 'Escape') this.salir();
    else if (e.key === 'ArrowRight') this.siguiente();
    else if (e.key === 'ArrowLeft') this.anterior();
  }

  // ------------------------------------------------------------------ Almacenamiento (solo comodidad del navegador)

  private leerCompletados(): Set<string> {
    try {
      return new Set(JSON.parse(localStorage.getItem(COMPLETADOS_KEY) ?? '[]'));
    } catch {
      return new Set();
    }
  }

  private guardarCompletados(): void {
    try {
      localStorage.setItem(COMPLETADOS_KEY, JSON.stringify([...this.completados()]));
    } catch {
      /* sin almacenamiento: el avance solo dura esta visita */
    }
  }

  private primeraVez(): boolean {
    try {
      return !localStorage.getItem(VISTO_KEY);
    } catch {
      return false;
    }
  }

  private marcarVisto(): void {
    try {
      localStorage.setItem(VISTO_KEY, '1');
    } catch {
      /* nada */
    }
  }
}
