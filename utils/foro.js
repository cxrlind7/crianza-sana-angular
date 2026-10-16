/* eslint-env node */
/**
 * Foro para padres.
 *
 * Todo pasa por este servidor (Admin SDK): el navegador nunca escribe directo en Firestore,
 * así nadie puede saltarse la moderación ni el anti-spam.
 *
 * Colecciones:
 *  - foroHilos/{id}        Preguntas. estado: 'pendiente' | 'aprobado' | 'rechazado'.
 *  - foroRespuestas/{id}   Respuestas (con hiloId). Mismos estados.
 *  - foroUsuarios/{uid}    Control por cuenta: bloqueo y límites de publicación.
 *
 * Las consultas solo usan filtros de igualdad y se ordenan en memoria, así no necesitan
 * índices compuestos.
 */

export const FORO_CATEGORIAS = ['sueno', 'alimentacion', 'emociones', 'desarrollo', 'salud', 'escuela', 'familia', 'otro']

const LIMITES = {
  titulo: [8, 140],
  cuerpo: [20, 4000],
  respuesta: [2, 2000],
  enlaces: 2,
  segundosEntrePublicaciones: 30,
  porDia: 10,
  pendientesPorCuenta: 5,
  porIpPorHora: 20,
  tiempoMinimoFormularioMs: 3000,
}

// Palabras que no bloquean, solo marcan el mensaje para que el admin lo revise con atención.
const PALABRAS_ALERTA = [
  'pendej', 'idiot', 'estupid', 'imbecil', 'puta', 'puto', 'chingad', 'verga', 'mierda', 'cabron',
  'casino', 'apuesta', 'bitcoin', 'cripto', 'prestamo', 'gana dinero', 'onlyfans', 'telegram',
]

const normalizar = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Texto plano: sin etiquetas, sin caracteres de control y sin saltos de línea de sobra. */
function limpiarTexto(value, multilinea = true) {
  let s = String(value ?? '')
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
  s = multilinea ? s.replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ')
  return s.trim()
}

const contarEnlaces = (s) => (s.match(/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|mx|info|xyz|ly|io)\b/gi) || []).length

/**
 * Revisión anti-spam del contenido. Devuelve un error (se rechaza) o las alertas para el admin.
 * Se exporta para poder probarla sin servidor.
 */
export function revisarContenido({ titulo, cuerpo }, tipo = 'hilo') {
  const [minC, maxC] = tipo === 'hilo' ? LIMITES.cuerpo : LIMITES.respuesta
  if (tipo === 'hilo') {
    const [minT, maxT] = LIMITES.titulo
    if (titulo.length < minT) return { error: `El título debe tener al menos ${minT} caracteres.` }
    if (titulo.length > maxT) return { error: `El título puede tener máximo ${maxT} caracteres.` }
    if (contarEnlaces(titulo) > 0) return { error: 'El título no puede llevar enlaces.' }
  }
  if (cuerpo.length < minC) return { error: `Tu mensaje debe tener al menos ${minC} caracteres.` }
  if (cuerpo.length > maxC) return { error: `Tu mensaje puede tener máximo ${maxC} caracteres.` }
  if (contarEnlaces(cuerpo) > LIMITES.enlaces) return { error: `Puedes incluir máximo ${LIMITES.enlaces} enlaces.` }
  if (/(.)\1{14,}/.test(cuerpo + titulo)) return { error: 'Tu mensaje tiene demasiados caracteres repetidos.' }

  const alertas = []
  const texto = normalizar(`${titulo} ${cuerpo}`)
  if (PALABRAS_ALERTA.some((p) => texto.includes(p))) alertas.push('Palabras sensibles')
  const letras = (titulo + cuerpo).replace(/[^a-záéíóúñ]/gi, '')
  if (letras.length > 30 && letras.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').length / letras.length > 0.7) alertas.push('Casi todo en mayúsculas')
  if (contarEnlaces(cuerpo) > 0) alertas.push('Incluye enlaces')
  return { alertas }
}

/** Comentarios viejos (sin estado) siguen visibles; los nuevos solo cuando se aprueban. */
export const esComentarioVisible = (c) => !c.estado || c.estado === 'aprobado'

/** Ruta de un comentario en Firestore. Solo se aceptan estas tres formas. */
const RUTA_COMENTARIO = /^(blogs|programas)\/[\w-]+\/comments\/[\w-]+$|^galerias\/[\w-]+\/fotos\/[\w-]+\/comments\/[\w-]+$/

/** Límite en memoria por IP (complementa el límite por cuenta guardado en Firestore). */
const publicacionesPorIp = new Map()
function excedeLimiteIp(ip) {
  const ahora = Date.now()
  const recientes = (publicacionesPorIp.get(ip) || []).filter((t) => ahora - t < 3600_000)
  if (recientes.length >= LIMITES.porIpPorHora) return true
  recientes.push(ahora)
  publicacionesPorIp.set(ip, recientes)
  return false
}

export function registerForoRoutes(app, { getDb, admin, adminEmails }) {
  const ts = () => admin.firestore.Timestamp.now()
  const esAdmin = (user) => !!user?.email && adminEmails.includes(user.email.toLowerCase())

  const toIso = (v) => (v?.toDate ? v.toDate().toISOString() : v || null)

  function publicoHilo(doc) {
    const d = doc.data()
    return {
      id: doc.id,
      titulo: d.titulo,
      cuerpo: d.cuerpo,
      categoria: d.categoria,
      autor: { nombre: d.autor?.nombre, foto: d.autor?.foto || '', rol: d.autor?.rol || 'padre' },
      creadoEn: toIso(d.creadoEn),
      ultimaActividad: toIso(d.ultimaActividad || d.creadoEn),
      respuestas: d.respuestas || 0,
      respondidoPorEquipo: !!d.respondidoPorEquipo,
      fijado: !!d.fijado,
      cerrado: !!d.cerrado,
    }
  }

  function publicoRespuesta(doc) {
    const d = doc.data()
    return {
      id: doc.id,
      hiloId: d.hiloId,
      cuerpo: d.cuerpo,
      autor: { nombre: d.autor?.nombre, foto: d.autor?.foto || '', rol: d.autor?.rol || 'padre' },
      creadoEn: toIso(d.creadoEn),
    }
  }

  /** Datos completos para moderar (incluye correo, alertas y reportes). */
  function moderacion(doc, extra = {}) {
    const d = doc.data()
    return {
      id: doc.id,
      ...d,
      creadoEn: toIso(d.creadoEn),
      moderadoEn: toIso(d.moderadoEn),
      ultimaActividad: toIso(d.ultimaActividad),
      ...extra,
    }
  }

  const sinDb = (res) => {
    if (getDb()) return false
    res.status(503).json({ error: 'Base de datos no disponible' })
    return true
  }

  async function requireUser(req, res, next) {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Inicia sesión para participar.' })
    try {
      req.user = await admin.auth().verifyIdToken(token)
      next()
    } catch {
      res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' })
    }
  }

  /** Reglas de cuenta antes de publicar: correo verificado, bloqueo y límites. */
  async function puedePublicar(req) {
    const db = getDb()
    const user = req.user
    if (esAdmin(user)) return null
    if (!user.email_verified) return { status: 403, error: 'Verifica tu correo para poder publicar. Revisa tu bandeja de entrada.' }

    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'desconocida'
    if (excedeLimiteIp(ip)) return { status: 429, error: 'Demasiadas publicaciones desde esta conexión. Intenta más tarde.' }

    const ref = db.collection('foroUsuarios').doc(user.uid)
    const perfil = (await ref.get()).data() || {}
    if (perfil.bloqueado) return { status: 403, error: 'Tu cuenta no puede publicar en el foro.' }

    const ultima = perfil.ultimaPublicacion?.toMillis?.() || 0
    if (Date.now() - ultima < LIMITES.segundosEntrePublicaciones * 1000) {
      return { status: 429, error: 'Espera unos segundos antes de volver a publicar.' }
    }
    const hoy = new Date().toISOString().slice(0, 10)
    if (perfil.dia === hoy && (perfil.publicacionesDia || 0) >= LIMITES.porDia) {
      return { status: 429, error: 'Llegaste al límite de publicaciones de hoy. ¡Gracias por participar!' }
    }

    const [hilos, respuestas] = await Promise.all([
      db.collection('foroHilos').where('autor.uid', '==', user.uid).where('estado', '==', 'pendiente').get(),
      db.collection('foroRespuestas').where('autor.uid', '==', user.uid).where('estado', '==', 'pendiente').get(),
    ])
    if (hilos.size + respuestas.size >= LIMITES.pendientesPorCuenta) {
      return { status: 429, error: 'Tienes varias publicaciones en revisión. Espera a que las aprobemos.' }
    }
    return null
  }

  async function registrarPublicacion(user) {
    const ref = getDb().collection('foroUsuarios').doc(user.uid)
    const hoy = new Date().toISOString().slice(0, 10)
    await getDb().runTransaction(async (tx) => {
      const perfil = (await tx.get(ref)).data() || {}
      tx.set(
        ref,
        {
          nombre: user.name || user.email?.split('@')[0] || 'Usuario',
          email: user.email || '',
          ultimaPublicacion: ts(),
          dia: hoy,
          publicacionesDia: perfil.dia === hoy ? (perfil.publicacionesDia || 0) + 1 : 1,
          publicacionesTotal: (perfil.publicacionesTotal || 0) + 1,
        },
        { merge: true },
      )
    })
  }

  function autorDe(user, anonimo) {
    const equipo = esAdmin(user)
    return {
      uid: user.uid,
      email: user.email || '',
      nombre: equipo ? 'Equipo Crianza Sana' : anonimo ? 'Mamá o papá anónimo' : user.name || user.email?.split('@')[0] || 'Usuario',
      foto: equipo ? '/logo_sin_fondo.png' : anonimo ? '' : user.picture || '',
      rol: equipo ? 'equipo' : 'padre',
      anonimo: !!anonimo && !equipo,
    }
  }

  /** Honeypot y tiempo mínimo de llenado: los bots suelen fallar en alguno. */
  function pareceBot(body) {
    if (String(body.sitioWeb || '').trim()) return 'honeypot'
    if (Number(body.tiempoMs) < LIMITES.tiempoMinimoFormularioMs) return 'rapido'
    return null
  }

  // ------------------------------------------------------------------ Público

  app.get('/api/foro/hilos', async (req, res) => {
    if (sinDb(res)) return
    try {
      const snap = await getDb().collection('foroHilos').where('estado', '==', 'aprobado').get()
      const hilos = snap.docs
        .map(publicoHilo)
        .sort((a, b) => Number(b.fijado) - Number(a.fijado) || String(b.ultimaActividad).localeCompare(String(a.ultimaActividad)))
      res.json(hilos)
    } catch (error) {
      console.error('Error foro hilos:', error)
      res.status(500).json({ error: 'No se pudo cargar el foro' })
    }
  })

  app.get('/api/foro/hilos/:id', async (req, res) => {
    if (sinDb(res)) return
    try {
      const doc = await getDb().collection('foroHilos').doc(req.params.id).get()
      if (!doc.exists || doc.get('estado') !== 'aprobado') return res.status(404).json({ error: 'Esta conversación no existe o está en revisión.' })
      const snap = await getDb()
        .collection('foroRespuestas')
        .where('hiloId', '==', doc.id)
        .where('estado', '==', 'aprobado')
        .get()
      const respuestas = snap.docs.map(publicoRespuesta).sort((a, b) => String(a.creadoEn).localeCompare(String(b.creadoEn)))
      res.json({ hilo: publicoHilo(doc), respuestas })
    } catch (error) {
      console.error('Error foro hilo:', error)
      res.status(500).json({ error: 'No se pudo cargar la conversación' })
    }
  })

  // ------------------------------------------------------------------ Con cuenta

  app.post('/api/foro/hilos', requireUser, async (req, res) => {
    if (sinDb(res)) return
    const body = req.body || {}
    if (pareceBot(body) === 'honeypot') return res.json({ id: null, estado: 'pendiente' })
    if (pareceBot(body) === 'rapido') return res.status(400).json({ error: 'Tómate un momento para revisar tu mensaje antes de enviarlo.' })

    const titulo = limpiarTexto(body.titulo, false)
    const cuerpo = limpiarTexto(body.cuerpo)
    const categoria = FORO_CATEGORIAS.includes(body.categoria) ? body.categoria : 'otro'
    const revision = revisarContenido({ titulo, cuerpo }, 'hilo')
    if (revision.error) return res.status(400).json({ error: revision.error })

    try {
      const bloqueo = await puedePublicar(req)
      if (bloqueo) return res.status(bloqueo.status).json({ error: bloqueo.error })

      const equipo = esAdmin(req.user)
      const ref = await getDb()
        .collection('foroHilos')
        .add({
          titulo,
          cuerpo,
          categoria,
          autor: autorDe(req.user, body.anonimo),
          estado: equipo ? 'aprobado' : 'pendiente',
          alertas: revision.alertas,
          reportes: 0,
          respuestas: 0,
          fijado: false,
          cerrado: false,
          creadoEn: ts(),
          ultimaActividad: ts(),
        })
      await registrarPublicacion(req.user)
      res.json({ id: ref.id, estado: equipo ? 'aprobado' : 'pendiente' })
    } catch (error) {
      console.error('Error creando hilo:', error)
      res.status(500).json({ error: 'No se pudo enviar tu pregunta' })
    }
  })

  app.post('/api/foro/hilos/:id/respuestas', requireUser, async (req, res) => {
    if (sinDb(res)) return
    const body = req.body || {}
    if (pareceBot(body) === 'honeypot') return res.json({ id: null, estado: 'pendiente' })
    if (pareceBot(body) === 'rapido') return res.status(400).json({ error: 'Tómate un momento para revisar tu respuesta antes de enviarla.' })

    const cuerpo = limpiarTexto(body.cuerpo)
    const revision = revisarContenido({ titulo: '', cuerpo }, 'respuesta')
    if (revision.error) return res.status(400).json({ error: revision.error })

    try {
      const db = getDb()
      const hiloRef = db.collection('foroHilos').doc(req.params.id)
      const hilo = await hiloRef.get()
      if (!hilo.exists || hilo.get('estado') !== 'aprobado') return res.status(404).json({ error: 'Esta conversación no existe.' })
      if (hilo.get('cerrado')) return res.status(403).json({ error: 'Esta conversación está cerrada.' })

      const bloqueo = await puedePublicar(req)
      if (bloqueo) return res.status(bloqueo.status).json({ error: bloqueo.error })

      const equipo = esAdmin(req.user)
      const ref = await db.collection('foroRespuestas').add({
        hiloId: hilo.id,
        hiloTitulo: hilo.get('titulo'),
        cuerpo,
        autor: autorDe(req.user, body.anonimo),
        estado: equipo ? 'aprobado' : 'pendiente',
        alertas: revision.alertas,
        reportes: 0,
        creadoEn: ts(),
      })
      if (equipo) await actualizarConteo(hilo.id)
      await registrarPublicacion(req.user)
      res.json({ id: ref.id, estado: equipo ? 'aprobado' : 'pendiente' })
    } catch (error) {
      console.error('Error creando respuesta:', error)
      res.status(500).json({ error: 'No se pudo enviar tu respuesta' })
    }
  })

  /** Lo que la persona ha enviado, con su estado (para que vea lo que sigue en revisión). */
  app.get('/api/foro/mis-publicaciones', requireUser, async (req, res) => {
    if (sinDb(res)) return
    try {
      const db = getDb()
      const [hilos, respuestas] = await Promise.all([
        db.collection('foroHilos').where('autor.uid', '==', req.user.uid).get(),
        db.collection('foroRespuestas').where('autor.uid', '==', req.user.uid).get(),
      ])
      const items = [
        ...hilos.docs.map((d) => ({ tipo: 'hilo', id: d.id, hiloId: d.id, titulo: d.get('titulo'), estado: d.get('estado'), motivo: d.get('motivo') || '', creadoEn: toIso(d.get('creadoEn')) })),
        ...respuestas.docs.map((d) => ({ tipo: 'respuesta', id: d.id, hiloId: d.get('hiloId'), titulo: d.get('hiloTitulo'), estado: d.get('estado'), motivo: d.get('motivo') || '', creadoEn: toIso(d.get('creadoEn')) })),
      ].sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)))
      res.json(items.slice(0, 30))
    } catch (error) {
      console.error('Error mis publicaciones:', error)
      res.status(500).json({ error: 'No se pudieron cargar tus publicaciones' })
    }
  })

  app.post('/api/foro/reportar', requireUser, async (req, res) => {
    if (sinDb(res)) return
    const { tipo, id } = req.body || {}
    const coleccion = tipo === 'hilo' ? 'foroHilos' : tipo === 'respuesta' ? 'foroRespuestas' : null
    if (!coleccion || !id) return res.status(400).json({ error: 'Reporte inválido' })
    try {
      const ref = getDb().collection(coleccion).doc(String(id))
      await getDb().runTransaction(async (tx) => {
        const doc = await tx.get(ref)
        if (!doc.exists) return
        const por = doc.get('reportadoPor') || []
        if (por.includes(req.user.uid)) return
        tx.update(ref, { reportadoPor: [...por, req.user.uid], reportes: por.length + 1 })
      })
      res.json({ success: true })
    } catch (error) {
      console.error('Error reportando:', error)
      res.status(500).json({ error: 'No se pudo enviar el reporte' })
    }
  })

  // ------------------------------------------------------------------ Comentarios (blogs, programas y fotos)
  // Antes se escribían desde el navegador; con las reglas de Firestore vencidas dejaron de funcionar.
  // Ahora pasan por aquí: misma cuenta verificada, límites y moderación que el foro.

  /** Colección y título/enlace del contenido comentado (para mostrar contexto al moderar). */
  async function destinoComentario(body) {
    const db = getDb()
    const { tipo, id, imagenId } = body || {}
    const limpio = (v) => /^[\w-]{1,128}$/.test(String(v || '')) && String(v)
    if (tipo === 'blog' && limpio(id)) {
      const doc = await db.collection('blogs').doc(id).get()
      return doc.exists ? { ruta: `blogs/${id}/comments`, titulo: doc.get('title') || 'Blog', enlace: `/blog/${id}` } : null
    }
    if (tipo === 'programa' && limpio(id)) {
      const doc = await db.collection('programas').doc(id).get()
      return doc.exists ? { ruta: `programas/${id}/comments`, titulo: doc.get('title') || 'Programa', enlace: `/programs?idVideo=${id}` } : null
    }
    if (tipo === 'foto' && limpio(id) && limpio(imagenId)) {
      const [album, foto] = await Promise.all([
        db.collection('galerias').doc(id).get(),
        db.doc(`galerias/${id}/fotos/${imagenId}`).get(),
      ])
      return album.exists && foto.exists
        ? { ruta: `galerias/${id}/fotos/${imagenId}/comments`, titulo: `Foto de "${album.get('name')}"`, enlace: `/gallery?idAlbum=${id}&idFoto=${imagenId}` }
        : null
    }
    return null
  }

  app.post('/api/foro/comentarios', requireUser, async (req, res) => {
    if (sinDb(res)) return
    const body = req.body || {}
    if (pareceBot(body) === 'honeypot') return res.json({ id: null, estado: 'pendiente' })
    // Un comentario es corto: basta con 1.5 s para descartar envíos automáticos.
    if (Number(body.tiempoMs) < 1500) return res.status(400).json({ error: 'Tómate un momento para revisar tu comentario.' })

    const texto = limpiarTexto(body.texto)
    const revision = revisarContenido({ titulo: '', cuerpo: texto }, 'respuesta')
    if (revision.error) return res.status(400).json({ error: revision.error.replace('mensaje', 'comentario') })
    if (texto.length > 1000) return res.status(400).json({ error: 'Tu comentario puede tener máximo 1000 caracteres.' })

    try {
      const destino = await destinoComentario(body)
      if (!destino) return res.status(404).json({ error: 'No encontramos dónde publicar el comentario.' })
      const bloqueo = await puedePublicar(req)
      if (bloqueo) return res.status(bloqueo.status).json({ error: bloqueo.error })

      const equipo = esAdmin(req.user)
      const comentario = {
        userId: req.user.uid,
        userName: equipo ? 'Equipo Crianza Sana' : req.user.name || req.user.email?.split('@')[0] || 'Usuario',
        userEmail: req.user.email || '',
        commentText: texto,
        image: equipo ? '/logo_sin_fondo.png' : req.user.picture || null,
        createdAt: new Date().toISOString(),
        estado: equipo ? 'aprobado' : 'pendiente',
        alertas: revision.alertas,
        contexto: { tipo: body.tipo, titulo: destino.titulo, enlace: destino.enlace },
      }
      const ref = await getDb().collection(destino.ruta).add(comentario)
      await registrarPublicacion(req.user)
      const { userEmail, alertas, ...publico } = comentario // eslint-disable-line no-unused-vars
      res.json({ id: ref.id, estado: comentario.estado, comentario: { id: ref.id, ...publico } })
    } catch (error) {
      console.error('Error creando comentario:', error)
      res.status(500).json({ error: 'No se pudo enviar tu comentario' })
    }
  })

  /** Borrar el propio comentario (o cualquiera, si es admin). */
  app.post('/api/foro/comentarios/borrar', requireUser, async (req, res) => {
    if (sinDb(res)) return
    const ruta = String(req.body?.ruta || '')
    if (!RUTA_COMENTARIO.test(ruta)) return res.status(400).json({ error: 'Comentario inválido' })
    try {
      const doc = await getDb().doc(ruta).get()
      if (!doc.exists) return res.json({ success: true })
      if (doc.get('userId') !== req.user.uid && !esAdmin(req.user)) return res.status(403).json({ error: 'Solo puedes borrar tus comentarios.' })
      await doc.ref.delete()
      res.json({ success: true })
    } catch (error) {
      console.error('Error borrando comentario:', error)
      res.status(500).json({ error: 'No se pudo borrar el comentario' })
    }
  })

  /**
   * Comentarios en un estado. collectionGroup sin filtros no necesita índice; con pocos
   * comentarios se filtra en memoria. Si crecen mucho, conviene un índice de grupo sobre `estado`.
   */
  async function comentariosEn(estado) {
    const snap = await getDb().collectionGroup('comments').get()
    return snap.docs
      .filter((d) => (d.get('estado') || 'aprobado') === estado && d.get('estado'))
      .map((d) => {
        const c = d.data()
        return {
          tipo: 'comentario',
          id: d.id,
          ruta: d.ref.path,
          cuerpo: c.commentText,
          hiloTitulo: c.contexto?.titulo || '',
          enlace: c.contexto?.enlace || '',
          origen: c.contexto?.tipo || d.ref.path.split('/')[0],
          autor: { uid: c.userId, email: c.userEmail || '', nombre: c.userName, foto: c.image || '', rol: c.userName === 'Equipo Crianza Sana' ? 'equipo' : 'padre' },
          estado: c.estado,
          motivo: c.motivo || '',
          alertas: c.alertas || [],
          creadoEn: c.createdAt,
        }
      })
  }

  // ------------------------------------------------------------------ Admin (protegido por requireAdmin en server.js)

  /** Recalcula el número de respuestas aprobadas y la última actividad del hilo. */
  async function actualizarConteo(hiloId) {
    const db = getDb()
    const snap = await db.collection('foroRespuestas').where('hiloId', '==', hiloId).where('estado', '==', 'aprobado').get()
    const fechas = snap.docs.map((d) => d.get('creadoEn')).filter(Boolean).sort((a, b) => b.toMillis() - a.toMillis())
    const hilo = await db.collection('foroHilos').doc(hiloId).get()
    if (!hilo.exists) return
    await hilo.ref.update({
      respuestas: snap.size,
      respondidoPorEquipo: snap.docs.some((d) => d.get('autor.rol') === 'equipo'),
      ultimaActividad: fechas[0] || hilo.get('creadoEn'),
    })
  }

  app.get('/api/foro/admin/moderacion', async (req, res) => {
    if (sinDb(res)) return
    const estado = ['pendiente', 'aprobado', 'rechazado'].includes(req.query.estado) ? req.query.estado : 'pendiente'
    try {
      const db = getDb()
      const [hilos, respuestas, reportadosH, reportadosR, bloqueados] = await Promise.all([
        db.collection('foroHilos').where('estado', '==', estado).get(),
        db.collection('foroRespuestas').where('estado', '==', estado).get(),
        db.collection('foroHilos').where('reportes', '>', 0).get(),
        db.collection('foroRespuestas').where('reportes', '>', 0).get(),
        db.collection('foroUsuarios').where('bloqueado', '==', true).get(),
      ])
      const porFecha = (a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn))
      const [pendH, pendR, comentarios, comentariosPendientes] = await Promise.all([
        db.collection('foroHilos').where('estado', '==', 'pendiente').count().get(),
        db.collection('foroRespuestas').where('estado', '==', 'pendiente').count().get(),
        comentariosEn(estado),
        estado === 'pendiente' ? null : comentariosEn('pendiente'),
      ])
      const totalComentariosPendientes = (comentariosPendientes ?? comentarios).length
      res.json({
        hilos: hilos.docs.map((d) => moderacion(d, { tipo: 'hilo' })).sort(porFecha),
        respuestas: respuestas.docs.map((d) => moderacion(d, { tipo: 'respuesta' })).sort(porFecha),
        comentarios: comentarios.sort(porFecha),
        reportados: [
          ...reportadosH.docs.map((d) => moderacion(d, { tipo: 'hilo' })),
          ...reportadosR.docs.map((d) => moderacion(d, { tipo: 'respuesta' })),
        ].filter((x) => x.estado === 'aprobado'),
        bloqueados: bloqueados.docs.map((d) => ({ uid: d.id, nombre: d.get('nombre'), email: d.get('email') })),
        totalPendientes: pendH.data().count + pendR.data().count + totalComentariosPendientes,
      })
    } catch (error) {
      console.error('Error moderación foro:', error)
      res.status(500).json({ error: 'No se pudo cargar la moderación' })
    }
  })

  app.get('/api/foro/admin/pendientes-total', async (req, res) => {
    if (sinDb(res)) return
    try {
      const db = getDb()
      const [h, r, c] = await Promise.all([
        db.collection('foroHilos').where('estado', '==', 'pendiente').count().get(),
        db.collection('foroRespuestas').where('estado', '==', 'pendiente').count().get(),
        comentariosEn('pendiente'),
      ])
      res.json({ total: h.data().count + r.data().count + c.length })
    } catch (error) {
      console.error('Error conteo foro:', error)
      res.status(500).json({ error: 'No se pudo contar' })
    }
  })

  app.post('/api/foro/admin/moderar', async (req, res) => {
    if (sinDb(res)) return
    const { tipo, id, accion, motivo, ruta } = req.body || {}
    const coleccion = tipo === 'hilo' ? 'foroHilos' : tipo === 'respuesta' ? 'foroRespuestas' : null
    if (tipo === 'comentario') {
      if (!RUTA_COMENTARIO.test(String(ruta || ''))) return res.status(400).json({ error: 'Comentario inválido' })
      if (!['aprobar', 'rechazar', 'eliminar'].includes(accion)) return res.status(400).json({ error: 'Acción no disponible para comentarios' })
    } else if (!coleccion || !id) {
      return res.status(400).json({ error: 'Datos inválidos' })
    }
    try {
      const db = getDb()
      const ref = tipo === 'comentario' ? db.doc(String(ruta)) : db.collection(coleccion).doc(String(id))
      const doc = await ref.get()
      if (!doc.exists) return res.status(404).json({ error: 'No existe' })
      const moderado = { moderadoEn: ts(), moderadoPor: req.user?.email || '' }

      switch (accion) {
        case 'aprobar':
          await ref.update({ estado: 'aprobado', motivo: '', ...moderado, ...(tipo === 'hilo' ? { ultimaActividad: doc.get('ultimaActividad') || ts() } : {}) })
          break
        case 'rechazar':
          await ref.update({ estado: 'rechazado', motivo: String(motivo || '').slice(0, 300), ...moderado })
          break
        case 'descartar-reportes':
          await ref.update({ reportes: 0, reportadoPor: [] })
          break
        case 'eliminar':
          if (tipo === 'hilo') {
            const resp = await db.collection('foroRespuestas').where('hiloId', '==', doc.id).get()
            const batch = db.batch()
            resp.docs.forEach((r) => batch.delete(r.ref))
            batch.delete(ref)
            await batch.commit()
          } else {
            await ref.delete()
          }
          break
        case 'fijar':
        case 'desfijar':
          if (tipo !== 'hilo') return res.status(400).json({ error: 'Solo se fijan preguntas' })
          await ref.update({ fijado: accion === 'fijar' })
          break
        case 'cerrar':
        case 'abrir':
          if (tipo !== 'hilo') return res.status(400).json({ error: 'Solo se cierran preguntas' })
          await ref.update({ cerrado: accion === 'cerrar' })
          break
        default:
          return res.status(400).json({ error: 'Acción desconocida' })
      }
      if (tipo === 'respuesta') await actualizarConteo(doc.get('hiloId'))
      res.json({ success: true })
    } catch (error) {
      console.error('Error moderando:', error)
      res.status(500).json({ error: 'No se pudo aplicar la acción' })
    }
  })

  app.post('/api/foro/admin/bloquear', async (req, res) => {
    if (sinDb(res)) return
    const { uid, bloqueado } = req.body || {}
    if (!uid) return res.status(400).json({ error: 'Falta la cuenta' })
    try {
      const db = getDb()
      const datos = { bloqueado: !!bloqueado }
      // Nombre y correo para la lista de bloqueados: de su cuenta, o de lo que haya publicado.
      if (bloqueado) {
        const cuenta = await admin.auth().getUser(String(uid)).catch(() => null)
        const post =
          (await db.collection('foroRespuestas').where('autor.uid', '==', String(uid)).limit(1).get()).docs[0] ||
          (await db.collection('foroHilos').where('autor.uid', '==', String(uid)).limit(1).get()).docs[0]
        datos.nombre = cuenta?.displayName || post?.get('autor.nombre') || 'Usuario'
        datos.email = cuenta?.email || post?.get('autor.email') || ''
      }
      await db.collection('foroUsuarios').doc(String(uid)).set(datos, { merge: true })
      res.json({ success: true })
    } catch (error) {
      console.error('Error bloqueando:', error)
      res.status(500).json({ error: 'No se pudo actualizar la cuenta' })
    }
  })
}
