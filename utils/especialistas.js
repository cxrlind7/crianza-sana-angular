/* eslint-env node */
/**
 * Especialistas y colaboradores (permanentes o temporales).
 *
 * Colección `especialistas/{id}` con id numérico (el mismo de /person/:id y de analytics).
 * Lectura pública (el sitio decide qué mostrar según `active`, `tipo` y `vigencia`);
 * escrituras protegidas por requireAdmin en server.js.
 */

const TEXTO = ['name', 'title', 'description', 'detalle', 'mision', 'vision', 'image', 'color', 'youtubeChannelUrl']
const LISTAS = ['socials', 'servicios', 'preguntasFrecuentes', 'files', 'youtubeVideos']
const OBJETOS = ['direccion', 'instagramProfileData', 'ficha', 'vigencia', 'inicio', 'servicioInicio']

const str = (v, max = 5000) => String(v ?? '').slice(0, max)

/** Solo campos conocidos y con el tipo correcto; lo demás se descarta. */
function limpiar(body = {}) {
  const data = {}
  for (const k of TEXTO) if (body[k] !== undefined) data[k] = str(body[k], k === 'description' || k === 'mision' || k === 'vision' ? 8000 : 2000)
  for (const k of LISTAS) if (Array.isArray(body[k])) data[k] = JSON.parse(JSON.stringify(body[k].slice(0, 60)))
  for (const k of OBJETOS) if (body[k] && typeof body[k] === 'object' && !Array.isArray(body[k])) data[k] = JSON.parse(JSON.stringify(body[k]))
  if (body.active !== undefined) data.active = body.active !== false
  if (body.enNosotros !== undefined) data.enNosotros = !!body.enNosotros
  if (body.tipo !== undefined) data.tipo = body.tipo === 'temporal' ? 'temporal' : 'permanente'
  if (body.orden !== undefined) data.orden = Number(body.orden) || 0
  return data
}

export function registerEspecialistasRoutes(app, { getDb, admin }) {
  const col = () => getDb().collection('especialistas')
  const sinDb = (res) => {
    if (getDb()) return false
    res.status(503).json({ error: 'Base de datos no disponible' })
    return true
  }

  app.get('/api/especialistas', async (req, res) => {
    if (sinDb(res)) return
    try {
      const snap = await col().get()
      const lista = snap.docs
        .map((d) => {
          const { actualizadoEn, ...rest } = d.data() // eslint-disable-line no-unused-vars
          return { ...rest, id: Number(d.id) }
        })
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      // Sin caché: al editar en Configuración, el cambio debe verse al recargar.
      res.set('Cache-Control', 'no-cache')
      res.json(lista)
    } catch (error) {
      console.error('Error especialistas:', error)
      res.status(500).json({ error: 'No se pudieron cargar los especialistas' })
    }
  })

  app.post('/api/especialistas', async (req, res) => {
    if (sinDb(res)) return
    const data = limpiar(req.body)
    if (!data.name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' })
    try {
      // Id numérico (las rutas /person/:id y analytics usan números): el siguiente libre.
      const docs = (await col().get()).docs
      const ids = new Set(docs.map((d) => Number(d.id)))
      let libre = 1
      while (ids.has(libre)) libre++
      const maxOrden = Math.max(0, ...docs.map((d) => d.get('orden') || 0))
      await col()
        .doc(String(libre))
        .set({ active: true, tipo: 'permanente', enNosotros: true, orden: maxOrden + 1, ...data, actualizadoEn: admin.firestore.Timestamp.now() })
      res.json({ success: true, id: libre })
    } catch (error) {
      console.error('Error creando especialista:', error)
      res.status(500).json({ error: 'No se pudo crear' })
    }
  })

  app.put('/api/especialistas/:id', async (req, res) => {
    if (sinDb(res)) return
    const id = String(Number(req.params.id))
    if (id === 'NaN') return res.status(400).json({ error: 'Id inválido' })
    try {
      const ref = col().doc(id)
      if (!(await ref.get()).exists) return res.status(404).json({ error: 'No existe' })
      // set completo (no merge) para que se puedan quitar elementos de las listas; los campos que
      // no manda el formulario (p. ej. instagramProfileData) se conservan.
      const actual = (await ref.get()).data()
      await ref.set({ ...actual, ...limpiar(req.body), actualizadoEn: admin.firestore.Timestamp.now() })
      res.json({ success: true })
    } catch (error) {
      console.error('Error actualizando especialista:', error)
      res.status(500).json({ error: 'No se pudo guardar' })
    }
  })

  app.post('/api/especialistas/orden', async (req, res) => {
    if (sinDb(res)) return
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((n) => String(Number(n))) : []
    try {
      const batch = getDb().batch()
      ids.forEach((id, i) => batch.update(col().doc(id), { orden: i + 1 }))
      await batch.commit()
      res.json({ success: true })
    } catch (error) {
      console.error('Error ordenando especialistas:', error)
      res.status(500).json({ error: 'No se pudo guardar el orden' })
    }
  })

  app.delete('/api/especialistas/:id', async (req, res) => {
    if (sinDb(res)) return
    try {
      await col().doc(String(Number(req.params.id))).delete()
      res.json({ success: true })
    } catch (error) {
      console.error('Error borrando especialista:', error)
      res.status(500).json({ error: 'No se pudo borrar' })
    }
  })
}
