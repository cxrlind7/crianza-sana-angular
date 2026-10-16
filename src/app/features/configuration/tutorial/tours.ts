/**
 * Recorridos del tutorial de Configuración.
 *
 * Cada paso resalta un elemento (por selector CSS, y opcionalmente por el texto que contiene
 * o por la etiqueta de un campo) y explica qué hace. Las acciones `antes` preparan la pantalla:
 * cambiar de sección, abrir el formulario de alta o hacer clic en un botón. El tutorial nunca
 * guarda nada: los formularios que abre se cierran al terminar.
 */

export type Seccion =
  | 'calendario'
  | 'especialistas'
  | 'ad'
  | 'banner'
  | 'blogs'
  | 'campana'
  | 'eventos'
  | 'programas'
  | 'galerias'
  | 'temas'
  | 'foro'
  | 'videos'
  | 'suscriptores';

export type Formulario = 'blog' | 'ad' | 'banner' | 'evento' | 'video';

/** Qué elemento resaltar. */
export interface Objetivo {
  sel: string;
  /** El primero que contenga este texto. */
  texto?: string;
  /** Resalta el campo cuya etiqueta contiene este texto (busca dentro de `sel`). */
  etiqueta?: string;
}

export type Accion =
  | { ir: Seccion }
  | { crear: Formulario }
  | { cerrarFormulario: true }
  | { click: Objetivo };

export interface Paso {
  titulo: string;
  texto: string;
  objetivo?: Objetivo;
  antes?: Accion[];
}

export interface Recorrido {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
  minutos: number;
  pasos: Paso[];
  /** Para dejar la pantalla como estaba al salir (p. ej. cerrar un formulario abierto por un clic). */
  alSalir?: Accion[];
}

const campo = (etiqueta: string): Objetivo => ({ sel: '.modal', etiqueta });

export const RECORRIDOS: Recorrido[] = [
  {
    id: 'inicio',
    titulo: 'Conoce el panel',
    descripcion: 'Dónde está cada cosa y cómo moverte.',
    icono: 'bi-compass',
    minutos: 1,
    pasos: [
      {
        titulo: '¡Bienvenida al panel de Crianza Sana! 👋',
        texto: 'Desde aquí se administra todo el sitio: blogs, programas, galerías, especialistas, el foro y más. Este recorrido corto te muestra dónde está cada cosa.',
      },
      {
        titulo: 'El menú de secciones',
        texto: 'Cada opción abre una sección. En celular este menú aparece arriba como una barra que se desliza de lado.',
        objetivo: { sel: '.cfg-sidebar' },
      },
      {
        titulo: 'Calendario: tu punto de partida',
        texto: 'Aquí ves todo lo publicado y lo programado, mes por mes, junto con las efemérides. Desde un día puedes programar cualquier contenido.',
        objetivo: { sel: '.cfg-nav-item', texto: 'Calendario' },
      },
      {
        titulo: 'Avisos pendientes',
        texto: 'Cuando hay preguntas del foro o comentarios esperando aprobación, aparece un número naranja en "Foro y comentarios".',
        objetivo: { sel: '.cfg-nav-item', texto: 'Foro y comentarios' },
      },
      {
        titulo: 'La sección abierta',
        texto: 'El encabezado siempre te dice en qué sección estás. Debajo está su contenido.',
        objetivo: { sel: '.cfg-page-header' },
      },
      {
        titulo: 'Vuelve cuando quieras',
        texto: 'El botón "Tutorial" está siempre disponible con recorridos de cada tarea: publicar un blog, subir un programa, moderar el foro… Cada paso solo te muestra cómo; nada se guarda.',
        objetivo: { sel: '.tut-launcher' },
      },
    ],
  },
  {
    id: 'calendario',
    titulo: 'Programar con el calendario',
    descripcion: 'Ver todo el contenido y programar desde un día.',
    icono: 'bi-calendar3',
    minutos: 2,
    pasos: [
      {
        titulo: 'El calendario de contenido',
        texto: 'Muestra blogs, programas, eventos, banners, anuncios, galerías, el programa en vivo y el fin de las campañas. Lo programado aparece con rayas y un reloj.',
        // En celular el calendario abre en "Agenda": el recorrido muestra la vista de mes.
        antes: [{ ir: 'calendario' }, { click: { sel: '.cal-segment button', texto: 'Mes' } }],
        objetivo: { sel: '.cal-grid' },
      },
      {
        titulo: 'Mes y agenda',
        texto: 'Cambia de mes con las flechas. "Agenda" muestra lo mismo en lista, más cómodo en celular.',
        objetivo: { sel: '.cal-toolbar' },
      },
      {
        titulo: 'Resumen y filtros',
        texto: 'Arriba ves cuánto hay programado y publicado este mes. Toca un tipo (Blog, Programa…) para ocultarlo o mostrarlo.',
        objetivo: { sel: '.cal-legend' },
      },
      {
        titulo: 'Efemérides',
        texto: 'Las fechas con contorno punteado son efemérides relacionadas con los temas de los especialistas (Día del Niño, TDAH, salud mental…). Solo son referencia: tócalas para ver ideas y especialistas afines.',
        objetivo: { sel: '.cal-chip.ref' },
      },
      {
        titulo: 'Programar en un día',
        texto: 'Toca cualquier día (o su "+") y elige qué crear. Se abre el formulario de siempre con la fecha puesta: un día futuro queda programado a las 9:00; hoy o un día pasado se publica de inmediato.',
        objetivo: { sel: '.cal-day.today' },
      },
      {
        titulo: 'Ver detalles',
        texto: 'Al tocar cualquier elemento del calendario se abre una ficha con su imagen, fecha, estado y los botones "Editar" y "Ver en el sitio".',
        objetivo: { sel: '.cal-chip:not(.ref)' },
      },
      {
        titulo: 'Botón "Programar"',
        texto: 'Atajo para crear algo para hoy (o para el mes que estás viendo) sin buscar el día.',
        objetivo: { sel: '.cal-toolbar .btn-primary' },
      },
    ],
  },
  {
    id: 'blog',
    titulo: 'Publicar un blog',
    descripcion: 'Escribir, programar, editar y eliminar artículos.',
    icono: 'bi-journal-richtext',
    minutos: 2,
    pasos: [
      {
        titulo: 'La sección de Blogs',
        texto: 'Aquí están todos los artículos. Puedes buscar por título y abrir cada uno para editarlo.',
        antes: [{ ir: 'blogs' }],
        objetivo: { sel: 'input[placeholder="Buscar por título..."]' },
      },
      {
        titulo: 'Nuevo blog',
        texto: 'Este botón abre el formulario para escribir un artículo. Te lo abro para mostrarte cada campo.',
        objetivo: { sel: 'button', texto: 'Nuevo Blog' },
      },
      {
        titulo: 'Título y descripción',
        texto: 'El título es lo primero que ven. La descripción breve aparece en las tarjetas del blog y al compartir por WhatsApp.',
        antes: [{ crear: 'blog' }],
        objetivo: campo('Título del artículo'),
      },
      {
        titulo: 'Autor y fecha',
        texto: 'Escribe el nombre del especialista tal como aparece en su perfil: así el blog sale en su página y en sus estadísticas.',
        objetivo: campo('Autor'),
      },
      {
        titulo: 'Programar la publicación',
        texto: 'Opcional. Si eliges fecha y hora, el blog no se verá en el sitio hasta ese momento. Si lo dejas vacío, se publica al crearlo.',
        objetivo: campo('Programar publicación'),
      },
      {
        titulo: 'Categoría, color e imagen',
        texto: 'La categoría agrupa los blogs por tema (Psicología, Lenguaje…) y alimenta las estadísticas de temas. Sube una imagen o pega su enlace.',
        objetivo: campo('Categoría'),
      },
      {
        titulo: 'Contenido',
        texto: 'Escribe el artículo con la barra de formato (títulos, negritas, listas, citas, enlaces). En "Vista previa" ves cómo quedará.',
        objetivo: { sel: '.modal .blog-toolbar' },
      },
      {
        titulo: 'Crear',
        texto: 'Al terminar, "Crear". Aquí lo cerramos sin guardar. Después, en la lista, cada blog tiene "Editar" y "Eliminar" (eliminar también borra sus comentarios).',
        objetivo: { sel: '.modal-footer .btn-primary' },
      },
    ],
    alSalir: [{ cerrarFormulario: true }],
  },
  {
    id: 'programa',
    titulo: 'Subir un programa',
    descripcion: 'Agregar un programa grabado o de YouTube.',
    icono: 'bi-camera-reels',
    minutos: 1,
    pasos: [
      {
        titulo: 'Programas',
        texto: 'Son los episodios que aparecen en la sección Programas del sitio.',
        antes: [{ ir: 'programas' }],
        objetivo: { sel: 'button', texto: 'Nuevo Programa' },
      },
      {
        titulo: 'Título, fecha y participante',
        texto: 'La fecha de transmisión ordena los programas. En participante va el especialista invitado.',
        antes: [{ crear: 'video' }],
        objetivo: campo('Fecha de transmisión'),
      },
      {
        titulo: 'El video',
        texto: 'Pega el enlace de YouTube (formato embed) o sube el archivo .mp4 directamente; se guarda en el almacenamiento del sitio. No cierres la ventana mientras sube.',
        objetivo: campo('Video'),
      },
      {
        titulo: 'Miniatura',
        texto: 'Imagen que se ve antes de reproducir. Si no pones una, se usa la del video.',
        objetivo: campo('Thumbnail URL'),
      },
      {
        titulo: 'Programar',
        texto: 'Igual que los blogs: con fecha y hora, el programa aparece en el sitio hasta ese momento.',
        objetivo: campo('Programar publicación'),
      },
    ],
    alSalir: [{ cerrarFormulario: true }],
  },
  {
    id: 'promos',
    titulo: 'Eventos, anuncios y banners',
    descripcion: 'Avisos del inicio con botón de contacto.',
    icono: 'bi-megaphone',
    minutos: 2,
    pasos: [
      {
        titulo: 'Eventos',
        texto: 'Los eventos aparecen en el inicio con su imagen, mensaje y un botón para llamar, escribir por WhatsApp o abrir un enlace.',
        antes: [{ ir: 'eventos' }],
        objetivo: { sel: 'button', texto: 'Nuevo Evento' },
      },
      {
        titulo: 'Imagen y mensaje',
        texto: 'Sube la imagen del evento y escribe el texto principal.',
        antes: [{ crear: 'evento' }],
        objetivo: campo('Mensaje'),
      },
      {
        titulo: 'El botón de contacto',
        texto: 'Elige si el botón llama, abre WhatsApp o un enlace. Si eliges "No" en "Mostrar botón", el evento sale sin botón.',
        objetivo: campo('Tipo'),
      },
      {
        titulo: 'Activo y programado',
        texto: '"Inactivo" lo oculta sin borrarlo. Con fecha programada, aparece solo a partir de ese momento.',
        objetivo: campo('Estado'),
      },
      {
        titulo: 'Anuncios y banners',
        texto: 'Funcionan igual: imagen, texto alternativo, activo/inactivo y programación opcional. El banner es la imagen grande del inicio.',
        antes: [{ cerrarFormulario: true }, { ir: 'banner' }],
        objetivo: { sel: 'button', texto: 'Nuevo Banner' },
      },
    ],
    alSalir: [{ cerrarFormulario: true }],
  },
  {
    id: 'galeria',
    titulo: 'Crear una galería',
    descripcion: 'Álbumes de fotos por especialista.',
    icono: 'bi-images',
    minutos: 1,
    pasos: [
      {
        titulo: 'Galerías',
        texto: 'Cada álbum aparece en la página Galería. Ábrelos para agregar o quitar fotos y editar pies de foto.',
        antes: [{ ir: 'galerias' }],
        objetivo: { sel: '.album-card' },
      },
      {
        titulo: 'Nuevo álbum',
        texto: 'Te abro el formulario para mostrarte los campos.',
        objetivo: { sel: 'button', texto: 'Nuevo álbum' },
      },
      {
        titulo: 'Especialista y título',
        texto: 'Elige de quién es el álbum (o "Crianza Sana" si es general) y ponle título.',
        antes: [{ click: { sel: 'button', texto: 'Nuevo álbum' } }],
        objetivo: { sel: '#album-person' },
      },
      {
        titulo: 'Fecha y programación',
        texto: 'La fecha ordena los álbumes. Con "Programar publicación" el álbum aparece hasta ese día.',
        objetivo: { sel: '#album-publish' },
      },
      {
        titulo: 'Fotos',
        texto: 'Puedes elegir muchas fotos a la vez; se suben con barra de avance. Después puedes agregar más o quitar alguna.',
        objetivo: { sel: '#album-files' },
      },
    ],
    alSalir: [{ click: { sel: 'button', texto: 'Cancelar' } }],
  },
  {
    id: 'especialistas',
    titulo: 'Especialistas y colaboradores',
    descripcion: 'Dar de alta, colaboraciones temporales y su ficha.',
    icono: 'bi-person-vcard',
    minutos: 2,
    pasos: [
      {
        titulo: 'Especialistas',
        texto: 'Todos los especialistas del sitio. El orden de esta lista es el orden en el inicio y en "¿Quiénes somos?".',
        antes: [{ ir: 'especialistas' }],
        objetivo: { sel: '.esp-card' },
      },
      {
        titulo: 'Estado y lugares',
        texto: 'Cada tarjeta dice si está visible, oculto, próximo o vencido, y dónde aparece. Con las flechas cambias el orden; "Ocultar" lo quita del sitio sin borrar sus blogs ni estadísticas.',
        objetivo: { sel: '.esp-actions' },
      },
      {
        titulo: 'Nuevo colaborador',
        texto: 'Para dar de alta a alguien nuevo. Te abro el formulario.',
        objetivo: { sel: 'button', texto: 'Nuevo colaborador' },
      },
      {
        titulo: 'Permanente o temporal',
        texto: 'Temporal es para colaboraciones o patrocinios por un periodo: eliges desde y hasta qué día se muestra, y aparece y desaparece solo.',
        antes: [{ click: { sel: 'button', texto: 'Nuevo colaborador' } }],
        objetivo: { sel: '.tipo-option', texto: 'Temporal' },
      },
      {
        titulo: 'Contacto',
        texto: 'Para WhatsApp solo escribe los 10 dígitos; el enlace se arma solo. Las redes van como enlace completo.',
        objetivo: { sel: '#red-whatsapp' },
      },
      {
        titulo: 'En el inicio',
        texto: 'Activa su foto en "#ReeducarParaFormar" y su tarjeta en "Servicios". Las fotos del inicio se acomodan solas en filas parejas.',
        objetivo: { sel: '#sw-inicio' },
      },
      {
        titulo: 'Ficha técnica',
        texto: 'Cédula, formación, experiencia, modalidad y horario aparecen en su perfil y en su tarjeta digital. Solo se muestran los datos que llenes.',
        objetivo: { sel: '#fi-ced' },
      },
    ],
    alSalir: [{ click: { sel: 'button', texto: 'Volver a la lista' } }],
  },
  {
    id: 'videos',
    titulo: 'Videos de especialistas',
    descripcion: '"Conociendo a…", su espacio y clips educativos.',
    icono: 'bi-person-video2',
    minutos: 1,
    pasos: [
      {
        titulo: 'Elige al especialista',
        texto: 'Primero toca a la persona; abajo aparecen sus videos.',
        antes: [{ ir: 'videos' }],
        objetivo: { sel: '.person-picker' },
      },
      {
        titulo: 'Tipo de video',
        texto: '"Conociendo a…" se abre con un botón junto a su foto; "Su espacio" sale destacado en su perfil; los clips educativos van en un carrusel. Los dos primeros son únicos: subir otro reemplaza al anterior.',
        antes: [{ click: { sel: '.person-chip' } }],
        objetivo: { sel: '.type-option', texto: 'Clips educativos' },
      },
      {
        titulo: 'Archivo y subida',
        texto: 'Elige el video (de preferencia MP4); la miniatura se saca sola del video. La barra muestra el avance.',
        objetivo: { sel: '#video-file' },
      },
    ],
  },
  {
    id: 'foro',
    titulo: 'Moderar el foro y comentarios',
    descripcion: 'Aprobar, rechazar, reportes y bloqueos.',
    icono: 'bi-chat-heart',
    minutos: 2,
    pasos: [
      {
        titulo: 'Foro y comentarios',
        texto: 'Todo lo que publican los padres (preguntas, respuestas del foro y comentarios de blogs, programas y fotos) espera aquí tu revisión antes de verse en el sitio.',
        antes: [{ ir: 'foro' }],
        objetivo: { sel: '.foro-tabs' },
      },
      {
        titulo: 'Cada mensaje',
        texto: 'Ves quién lo envió (con su correo, aunque haya publicado como anónimo), dónde y las alertas automáticas (palabras sensibles, enlaces, mayúsculas).',
        objetivo: { sel: '.mod-card' },
      },
      {
        titulo: 'Aprobar o rechazar',
        texto: '"Aprobar" lo publica. "Rechazar" pide un motivo que la persona verá en "Mis publicaciones". También puedes bloquear al autor si hace spam.',
        objetivo: { sel: '.mod-actions' },
      },
      {
        titulo: 'Reportados y publicados',
        texto: 'En "Reportados" ves lo que la comunidad marcó. En "Publicados" puedes fijar una pregunta arriba del foro o cerrarla.',
        objetivo: { sel: '.foro-tabs button', texto: 'Reportados' },
      },
    ],
  },
  {
    id: 'envivo',
    titulo: 'Programa en vivo (Temas)',
    descripcion: 'Próximo en vivo, temas, colores e invitados.',
    icono: 'bi-broadcast',
    minutos: 1,
    pasos: [
      {
        titulo: 'Temas del programa',
        texto: 'Lo que se anuncia en el inicio sobre el próximo programa en vivo.',
        antes: [{ ir: 'temas' }],
        objetivo: { sel: 'h5', texto: 'Lista de Temas' },
      },
      {
        titulo: 'Próximo evento',
        texto: 'Fecha, hora y mensaje del próximo en vivo. También aparece en el calendario.',
        objetivo: { sel: 'h5', texto: 'Próximo Evento' },
      },
      {
        titulo: 'Participantes',
        texto: 'Marca a los especialistas que participan; sus fotos aparecen en el anuncio del inicio.',
        objetivo: { sel: 'h5', texto: 'Participantes' },
      },
    ],
  },
  {
    id: 'boletin',
    titulo: 'Campañas y boletín',
    descripcion: 'Campaña con fecha de fin y correo a suscriptores.',
    icono: 'bi-envelope-paper',
    minutos: 1,
    pasos: [
      {
        titulo: 'Campañas',
        texto: 'Imagen de campaña y su fecha de fin (día-mes-año). Al pasar esa fecha deja de mostrarse.',
        antes: [{ ir: 'campana' }],
        objetivo: { sel: '.card' },
      },
      {
        titulo: 'Suscriptores',
        texto: 'Los correos de quienes se suscribieron en el sitio.',
        antes: [{ ir: 'suscriptores' }],
        objetivo: { sel: 'h5', texto: 'Lista de Suscriptores' },
      },
      {
        titulo: 'Enviar boletín',
        texto: 'Escribe título, descripción y enlace. ⚠️ "Enviar a todos" le llega de inmediato a todos los suscriptores: revisa bien antes de enviarlo.',
        objetivo: { sel: 'h5', texto: 'Enviar Newsletter' },
      },
    ],
  },
];
