// Importación de lives de Facebook (Configuración → Programas → Importar live).
// El admin pega el enlace del live y sube el flyer; el servidor lo procesa por la noche
// (21:00 de Durango) o al momento con "Procesar ahora".
import admin from 'firebase-admin'
import { procesarLive, liveInfo, fechaDurango } from './live-pipeline.js'

const COLECCION = 'importacionesLive'
const REVISAR_CADA_MS = 10 * 60 * 1000
const BLOQUEO_MS = 2 * 60 * 60 * 1000
const HORA_NOCHE = 21 // hora de Durango a partir de la cual se procesa

/** Próximas 21:00 de Durango (UTC-6, sin horario de verano), o ahora si ya pasaron hoy. */
function proximaNoche(ahora = new Date()) {
  const durango = new Date(ahora.getTime() - 6 * 3600 * 1000)
  const noche = Date.UTC(durango.getUTCFullYear(), durango.getUTCMonth(), durango.getUTCDate(), HORA_NOCHE + 6)
  return new Date(Math.max(noche, ahora.getTime()))
}

const esUrlFacebook = (u) => /^https:\/\/(www\.|m\.|web\.)?facebook\.com\/.+/.test(u) || /^https:\/\/fb\.watch\/.+/.test(u)

export function registerImportarLiveRoutes(app, { getDb, getS3, bucket, publicBase, requireAdmin }) {
  const col = () => getDb().collection(COLECCION)
  const sinDb = (res) => {
    if (getDb()) return false
    res.status(503).json({ error: 'Base de datos no disponible' })
    return true
  }

  app.get('/api/importaciones-live', requireAdmin, async (req, res) => {
    if (sinDb(res)) return
    try {
      const snap = await col().orderBy('creadoEn', 'desc').limit(20).get()
      res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error('Error listando importaciones:', error)
      res.status(500).json({ error: 'No se pudieron leer las importaciones' })
    }
  })

  app.post('/api/importaciones-live', async (req, res) => {
    if (sinDb(res)) return
    const fbUrl = String(req.body?.fbUrl || '').trim()
    const flyerUrl = String(req.body?.flyerUrl || '').trim()
    if (!esUrlFacebook(fbUrl)) return res.status(400).json({ error: 'El enlace debe ser de un video de Facebook' })
    if (!/^https:\/\//.test(flyerUrl)) return res.status(400).json({ error: 'Falta el flyer' })
    const ahora = req.body?.procesarAhora === true
    try {
      const ref = await col().add({
        fbUrl,
        flyerUrl,
        estado: 'pendiente',
        paso: '',
        error: '',
        intentos: 0,
        programas: [],
        procesarDesde: admin.firestore.Timestamp.fromDate(ahora ? new Date() : proximaNoche()),
        creadoEn: admin.firestore.Timestamp.now(),
        creadoPor: req.user?.email || '',
      })
      if (ahora) setImmediate(revisar)
      res.json({ success: true, id: ref.id })
    } catch (error) {
      console.error('Error creando importación:', error)
      res.status(500).json({ error: 'No se pudo guardar' })
    }
  })

  app.post('/api/importaciones-live/:id/procesar', async (req, res) => {
    if (sinDb(res)) return
    try {
      const ref = col().doc(req.params.id)
      const doc = await ref.get()
      if (!doc.exists) return res.status(404).json({ error: 'No existe' })
      if (doc.data().estado === 'procesando') return res.status(409).json({ error: 'Ya se está procesando' })
      await ref.update({ estado: 'pendiente', error: '', procesarDesde: admin.firestore.Timestamp.now() })
      setImmediate(revisar)
      res.json({ success: true })
    } catch (error) {
      console.error('Error reprocesando importación:', error)
      res.status(500).json({ error: 'No se pudo reprocesar' })
    }
  })

  app.delete('/api/importaciones-live/:id', async (req, res) => {
    if (sinDb(res)) return
    try {
      const ref = col().doc(req.params.id)
      const doc = await ref.get()
      if (doc.exists && doc.data().estado === 'procesando') return res.status(409).json({ error: 'Se está procesando' })
      await ref.delete()
      res.json({ success: true })
    } catch (error) {
      console.error('Error borrando importación:', error)
      res.status(500).json({ error: 'No se pudo borrar' })
    }
  })

  // --- Proceso en segundo plano: una importación a la vez ---
  let ocupado = false

  async function tomarSiguiente() {
    const db = getDb()
    const ahora = admin.firestore.Timestamp.now()
    // Las que se quedaron "procesando" por un reinicio del servidor vuelven a la fila.
    const colgadas = await col().where('estado', '==', 'procesando').get()
    for (const d of colgadas.docs) {
      if (Date.now() - (d.data().iniciadoEn?.toMillis() ?? 0) > BLOQUEO_MS) await d.ref.update({ estado: 'pendiente' })
    }
    const pendientes = await col().where('estado', '==', 'pendiente').get()
    const lista = pendientes.docs
      .filter((d) => (d.data().procesarDesde?.toMillis() ?? 0) <= ahora.toMillis())
      .sort((a, b) => a.data().procesarDesde.toMillis() - b.data().procesarDesde.toMillis())
    for (const d of lista) {
      const tomado = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(d.ref)
        if (fresh.data()?.estado !== 'pendiente') return false
        tx.update(d.ref, { estado: 'procesando', iniciadoEn: admin.firestore.Timestamp.now(), intentos: (fresh.data().intentos || 0) + 1 })
        return true
      })
      if (tomado) return d.ref
    }
    return null
  }

  async function procesar(ref) {
    const data = (await ref.get()).data()
    const log = (paso) => {
      console.log(`🎙️ Importación ${ref.id}: ${paso}`)
      ref.update({ paso }).catch(() => {})
    }
    try {
      log('Revisando el live')
      const info = await liveInfo(data.fbUrl)
      if (info.liveStatus === 'is_live' || info.liveStatus === 'is_upcoming') {
        await ref.update({ estado: 'pendiente', paso: 'El live sigue al aire; se reintenta en 30 min', procesarDesde: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 60 * 1000) })
        return
      }
      const fecha = fechaDurango(info.timestamp)
      const resultado = await procesarLive({
        fbUrl: data.fbUrl,
        flyerUrl: data.flyerUrl,
        fecha,
        db: getDb(),
        s3: getS3(),
        bucket,
        publicBase,
        log,
      })
      await ref.update({ estado: 'publicado', paso: '', fecha, programas: resultado.ids, temas: resultado.temas, terminadoEn: admin.firestore.Timestamp.now() })
      console.log(`✅ Importación ${ref.id} publicada (${fecha})`)
    } catch (error) {
      console.error(`❌ Importación ${ref.id}:`, error)
      await ref.update({ estado: 'error', error: String(error?.stderr || error?.message || error).slice(-800) })
    }
  }

  async function revisar() {
    if (ocupado || !getDb()) return
    ocupado = true
    try {
      for (let ref = await tomarSiguiente(); ref; ref = await tomarSiguiente()) await procesar(ref)
    } catch (error) {
      console.error('Error revisando importaciones:', error)
    } finally {
      ocupado = false
    }
  }

  setInterval(revisar, REVISAR_CADA_MS).unref()
  setTimeout(revisar, 30 * 1000).unref()
}
