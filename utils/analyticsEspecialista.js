/* eslint-env node */
/**
 * Analytics por especialista y "¿qué buscan los padres?".
 *
 * Todo sale de GA4 (eventos que ya registra el sitio) más Firestore (especialistas, blogs y foro):
 *  - Visitas a su perfil (/person/:id), día a día, de dónde llegan, ciudades y horarios.
 *  - Clics a su WhatsApp desde cualquier lugar del sitio: el evento guarda el número (wa.me/52…),
 *    así que se atribuyen aunque le escriban desde el widget o la tarjeta de servicios.
 *  - Tarjeta digital (descargas, contacto, QR), videos de su perfil y sus blogs.
 */
import { safeReport, eventFilter, num, previousRange, classifySource, resolveDate } from './getAnalyticsData.js'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const exacto = (fieldName, value) => ({ filter: { fieldName, stringFilter: { matchType: 'EXACT', value } } })
const y = (...expressions) => ({ andGroup: { expressions } })
const filas = (r) => r.rows ?? []
const dims = (row) => row.dimensionValues.map((d) => d.value)

/** Tokens de un nombre sin acentos ni títulos (Lic., Dra., LTS.…) para comparar autores. */
function tokens(nombre) {
  return String(nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(lic|lcda|dra|dr|lts|mtra|mtro|psic|ing)\.?(?=\s)/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
}

export function mismoNombre(a, b) {
  const ta = tokens(a)
  const tb = new Set(tokens(b))
  const comunes = ta.filter((t) => tb.has(t)).length
  return comunes >= Math.min(2, ta.length, tb.size) && comunes > 0
}

/** De dónde salió el clic a WhatsApp, en palabras. */
function origenWhatsapp(linkText, pagePath) {
  const prefijo = String(linkText).split(':')[0].trim()
  const mapa = {
    Perfil: 'Botones de su perfil',
    Ficha: 'Su ficha técnica',
    Widget: 'Botón flotante de WhatsApp',
    Servicio: 'Tarjeta de servicios (inicio)',
    Quiz: 'Resultado del quiz',
    Evento: 'Anuncio de evento',
  }
  if (mapa[prefijo]) return mapa[prefijo]
  if (pagePath?.startsWith('/person/')) return 'Su perfil (otro botón)'
  if (pagePath === '/') return 'Inicio'
  return pagePath || 'Otro'
}

/** Todos los días del rango (GA solo devuelve los días con datos; los demás van en cero). */
function rellenarDias(filasDiario, startDate, endDate) {
  const porFecha = Object.fromEntries(filasDiario.map((r) => [dims(r)[0], num(r.metricValues[0])]))
  const dias = []
  for (let d = resolveDate(startDate); d <= resolveDate(endDate); d = new Date(d.getTime() + 86400000)) {
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, '')
    dias.push({ date: ymd, visitas: porFecha[ymd] ?? 0 })
  }
  return dias
}

function delta(actual, anterior) {
  return anterior ? Math.round(((actual - anterior) / anterior) * 100) : null
}

export async function getEspecialistaAnalytics(db, personId, startDate = '30daysAgo', endDate = 'today') {
  const id = String(Number(personId))
  const doc = db ? await db.collection('especialistas').doc(id).get() : null
  if (!doc?.exists) throw Object.assign(new Error('Especialista no encontrado'), { status: 404 })
  const persona = doc.data()
  const telefono = persona.socials?.find((s) => s.iconClass?.includes('whatsapp'))?.link?.match(/wa\.me\/(\d+)/)?.[1] ?? null
  const ruta = `/person/${id}`
  const range = [{ startDate, endDate }]
  const prev = [previousRange(startDate, endDate)]
  const enPerfil = exacto('pagePath', ruta)

  // Blogs de la persona (por nombre de autor).
  const blogsSnap = db ? await db.collection('blogs').select('title', 'authorName').get() : { docs: [] }
  const blogs = blogsSnap.docs
    .filter((d) => mismoNombre(d.get('authorName'), persona.name))
    .map((d) => ({ id: d.id, title: d.get('title'), path: `/blog/${d.id}` }))
  const rutasBlogs = blogs.map((b) => b.path)

  const vistas = (dateRanges) =>
    safeReport('perfil: vistas', { dateRanges, metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }], dimensionFilter: enPerfil })

  const [actual, anterior, diario, origen, ciudades, horario, whatsapp, whatsappPrev, tarjeta, videos, blogsVistas, blogsEventos] =
    await Promise.all([
      vistas(range),
      vistas(prev),
      safeReport('perfil: diario', { dateRanges: range, dimensions: [{ name: 'date' }], metrics: [{ name: 'screenPageViews' }], dimensionFilter: enPerfil, orderBys: [{ dimension: { dimensionName: 'date' } }] }),
      safeReport('perfil: origen', {
        dateRanges: range,
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: enPerfil,
        limit: 100,
      }),
      safeReport('perfil: ciudades', {
        dateRanges: range,
        dimensions: [{ name: 'city' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: enPerfil,
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 8,
      }),
      safeReport('perfil: horario', {
        dateRanges: range,
        dimensions: [{ name: 'dayOfWeek' }, { name: 'hour' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: enPerfil,
        limit: 200,
      }),
      telefono
        ? safeReport('perfil: whatsapp', {
            dateRanges: range,
            dimensions: [{ name: 'linkText' }, { name: 'pagePath' }],
            metrics: [{ name: 'eventCount' }],
            dimensionFilter: y(eventFilter(['click_whatsapp']), exacto('linkUrl', `wa.me/${telefono}`)),
            limit: 100,
          })
        : { rows: [] },
      telefono
        ? safeReport('perfil: whatsapp anterior', {
            dateRanges: prev,
            metrics: [{ name: 'eventCount' }],
            dimensionFilter: y(eventFilter(['click_whatsapp']), exacto('linkUrl', `wa.me/${telefono}`)),
          })
        : { rows: [] },
      safeReport('perfil: tarjeta', {
        dateRanges: range,
        dimensions: [{ name: 'eventName' }, { name: 'fileName' }, { name: 'linkText' }, { name: 'method' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: eventFilter(['descarga', 'ver_tarjeta_qr', 'compartir']),
        limit: 250,
      }),
      safeReport('perfil: videos', {
        dateRanges: range,
        dimensions: [{ name: 'eventName' }, { name: 'videoTitle' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: y(eventFilter(['ver_video', 'video_completo']), enPerfil),
        limit: 50,
      }),
      rutasBlogs.length
        ? safeReport('perfil: blogs', {
            dateRanges: range,
            dimensions: [{ name: 'pagePath' }],
            metrics: [{ name: 'screenPageViews' }, { name: 'userEngagementDuration' }],
            dimensionFilter: { filter: { fieldName: 'pagePath', inListFilter: { values: rutasBlogs } } },
            limit: 250,
          })
        : { rows: [] },
      rutasBlogs.length
        ? safeReport('perfil: blogs eventos', {
            dateRanges: range,
            dimensions: [{ name: 'pagePath' }, { name: 'eventName' }],
            metrics: [{ name: 'eventCount' }],
            dimensionFilter: y(
              { filter: { fieldName: 'pagePath', inListFilter: { values: rutasBlogs } } },
              eventFilter(['scroll_blog_completo', 'escuchar_blog', 'share_blog']),
            ),
            limit: 500,
          })
        : { rows: [] },
    ])

  // --- Perfil
  const visitas = num(filas(actual)[0]?.metricValues[0])
  const personas = num(filas(actual)[0]?.metricValues[1])
  const visitasPrev = num(filas(anterior)[0]?.metricValues[0])

  // --- WhatsApp por origen
  const porOrigen = {}
  let clics = 0
  for (const r of filas(whatsapp)) {
    const [texto, pagina] = dims(r)
    const n = num(r.metricValues[0])
    clics += n
    const o = origenWhatsapp(texto, pagina)
    porOrigen[o] = (porOrigen[o] ?? 0) + n
  }
  const clicsPrev = num(filas(whatsappPrev)[0]?.metricValues[0])

  // --- De dónde llegan a su perfil
  const fuentes = {}
  for (const r of filas(origen)) {
    const [source, medium, channel] = dims(r)
    const o = classifySource(source, medium, channel)
    fuentes[o] = (fuentes[o] ?? 0) + num(r.metricValues[0])
  }

  // --- Tarjeta digital
  const t = { tarjetas: 0, contactos: 0, qrAbierto: 0, compartido: 0 }
  for (const r of filas(tarjeta)) {
    const [evento, archivo, texto, metodo] = dims(r)
    const n = num(r.metricValues[0])
    if (evento === 'descarga' && archivo === `Tarjeta digital: ${persona.name}`.slice(0, 100)) t.tarjetas += n
    if (evento === 'descarga' && archivo === `Contacto: ${persona.name}`.slice(0, 100)) t.contactos += n
    if (evento === 'ver_tarjeta_qr' && texto === persona.name.slice(0, 100)) t.qrAbierto += n
    if (evento === 'compartir' && metodo === 'perfil' && texto === persona.name.slice(0, 100)) t.compartido += n
  }
  const visitasQr = fuentes['Código QR / tarjeta digital'] ?? 0

  // --- Videos de su perfil
  const vids = {}
  for (const r of filas(videos)) {
    const [evento, titulo] = dims(r)
    const v = (vids[titulo] ??= { titulo, reproducciones: 0, completos: 0 })
    if (evento === 'ver_video') v.reproducciones += num(r.metricValues[0])
    else v.completos += num(r.metricValues[0])
  }

  // --- Blogs
  const porBlog = Object.fromEntries(blogs.map((b) => [b.path, { ...b, visitas: 0, segundos: 0, completos: 0, escuchas: 0, compartidos: 0 }]))
  for (const r of filas(blogsVistas)) {
    const [path] = dims(r)
    if (!porBlog[path]) continue
    porBlog[path].visitas = num(r.metricValues[0])
    porBlog[path].segundos = num(r.metricValues[1])
  }
  for (const r of filas(blogsEventos)) {
    const [path, evento] = dims(r)
    const b = porBlog[path]
    if (!b) continue
    const n = num(r.metricValues[0])
    if (evento === 'scroll_blog_completo') b.completos += n
    if (evento === 'escuchar_blog') b.escuchas += n
    if (evento === 'share_blog') b.compartidos += n
  }
  const blogsLista = Object.values(porBlog)
    .map(({ segundos, ...b }) => ({
      ...b,
      tiempoPromedio: b.visitas ? Math.round(segundos / b.visitas) : 0,
      lecturaCompleta: b.visitas ? Math.min(100, Math.round((b.completos / b.visitas) * 100)) : 0,
    }))
    .sort((a, b) => b.visitas - a.visitas)

  // --- Horario
  const porDia = Array(7).fill(0)
  const porHora = Array(24).fill(0)
  for (const r of filas(horario)) {
    const [dia, hora] = dims(r)
    const n = num(r.metricValues[0])
    porDia[Number(dia)] += n
    porHora[Number(hora)] += n
  }

  const ordenar = (obj) =>
    Object.entries(obj)
      .map(([label, count]) => ({ label, count }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)

  return {
    persona: { id: Number(id), name: persona.name, color: persona.color, tieneWhatsapp: !!telefono },
    perfil: { visitas, personas, delta: delta(visitas, visitasPrev) },
    whatsapp: { clics, delta: delta(clics, clicsPrev), conversion: visitas ? Math.round((clics / visitas) * 1000) / 10 : null, porOrigen: ordenar(porOrigen) },
    diario: rellenarDias(filas(diario), startDate, endDate),
    origen: ordenar(fuentes),
    tarjeta: { ...t, visitasQr },
    videos: Object.values(vids).filter((v) => v.titulo && v.titulo !== '(not set)').sort((a, b) => b.reproducciones - a.reproducciones),
    blogs: blogsLista,
    ciudades: filas(ciudades)
      .map((r) => ({ label: dims(r)[0], count: num(r.metricValues[0]) }))
      .filter((c) => c.label && c.label !== '(not set)'),
    horario: { porDia: porDia.map((count, i) => ({ label: DIAS[i], count })), porHora },
  }
}

/** Lo que buscan los padres: búsquedas del blog y del foro, y preguntas del foro por tema. */
export async function getTemasPadres(db, startDate = '30daysAgo', endDate = 'today') {
  const range = [{ startDate, endDate }]
  const [busquedas, horario] = await Promise.all([
    safeReport('búsquedas', {
      dateRanges: range,
      dimensions: [{ name: 'searchTerm' }, { name: 'method' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: eventFilter(['search']),
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 100,
    }),
    safeReport('horario sitio', {
      dateRanges: range,
      dimensions: [{ name: 'dayOfWeek' }, { name: 'hour' }],
      metrics: [{ name: 'screenPageViews' }],
      limit: 200,
    }),
  ])

  // Búsquedas: el mismo término escrito distinto cuenta junto.
  const terminos = {}
  for (const r of filas(busquedas)) {
    const [termino, donde] = dims(r)
    if (!termino || termino === '(not set)') continue
    const clave = termino.trim().toLowerCase()
    const t = (terminos[clave] ??= { termino: clave, blog: 0, foro: 0, total: 0 })
    const n = num(r.metricValues[0])
    if (donde === 'foro') t.foro += n
    else t.blog += n
    t.total += n
  }

  // Foro: preguntas por tema y las que siguen sin respuesta.
  const foro = { porCategoria: {}, sinRespuesta: [], pendientes: 0 }
  if (db) {
    const [aprobados, pendientes] = await Promise.all([
      db.collection('foroHilos').where('estado', '==', 'aprobado').get(),
      db.collection('foroHilos').where('estado', '==', 'pendiente').count().get(),
    ])
    foro.pendientes = pendientes.data().count
    for (const d of aprobados.docs) {
      const cat = d.get('categoria') || 'otro'
      const c = (foro.porCategoria[cat] ??= { categoria: cat, preguntas: 0, sinRespuesta: 0 })
      c.preguntas++
      if (!d.get('respuestas')) {
        c.sinRespuesta++
        foro.sinRespuesta.push({ id: d.id, titulo: d.get('titulo'), categoria: cat, creadoEn: d.get('creadoEn')?.toDate?.().toISOString() ?? null })
      }
    }
    foro.sinRespuesta.sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)))
  }

  const porDia = Array(7).fill(0)
  const porHora = Array(24).fill(0)
  for (const r of filas(horario)) {
    const [dia, hora] = dims(r)
    porDia[Number(dia)] += num(r.metricValues[0])
    porHora[Number(hora)] += num(r.metricValues[0])
  }

  return {
    busquedas: Object.values(terminos).sort((a, b) => b.total - a.total).slice(0, 30),
    foro: {
      pendientes: foro.pendientes,
      porCategoria: Object.values(foro.porCategoria).sort((a, b) => b.preguntas - a.preguntas),
      sinRespuesta: foro.sinRespuesta.slice(0, 10),
    },
    horario: { porDia: porDia.map((count, i) => ({ label: DIAS[i], count })), porHora },
  }
}
