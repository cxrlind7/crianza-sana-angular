/* eslint-env node */
import 'dotenv/config' // Usamos import para dotenv
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import axios from 'axios'
import cors from 'cors'
import AWS from 'aws-sdk'
import admin from 'firebase-admin'
import { Resend } from 'resend'
import {
  getBlogPageViews,
  getHomepageDailyViews,
  getRoutePageViews,
  getPersonPageViews,
  getBlogEventBreakdown,
  getLocationViews,
} from './utils/getAnalyticsData.js'
import compression from 'compression'
// --- CONFIGURACIÓN DE RUTAS Y DIRECTORIOS ---
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🚀 INICIO DEL SERVIDOR UNIFICADO')

// --- MANEJO DE ERRORES GLOBALES ---
process.on('uncaughtException', (err) => {
  console.error('🔥 Excepción no capturada:', err)
})
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Rechazo de promesa no manejado:', reason)
})

const app = express()
const PORT = process.env.PORT || 3000
console.log(`Puerto configurado: ${PORT}`)

// ==========================================
// 1. RUTA DE SALUD (Health Check)
// ==========================================
app.get('/health', (req, res) => {
  console.log('💓 Health Check recibido.')
  res.set('Connection', 'close')
  res.status(200).send('OK')
})

// Middlewares
app.use(cors())
app.use(express.json())
app.use(compression())

// --- SERVIR ARCHIVOS ESTÁTICOS (CRÍTICO PARA PRODUCCIÓN) ---
// Sirve el contenido de la carpeta 'dist' (JS, CSS, Imágenes compiladas)
// --- SERVIR ARCHIVOS ESTÁTICOS (CRÍTICO PARA PRODUCCIÓN) ---
// Sirve el contenido de la carpeta 'dist' (JS, CSS, Imágenes compiladas)
// app.use(express.static(path.join(__dirname, 'dist'))) // SE MOVIÓ AL FINAL PARA ORDEN CORRECTO

// ==========================================
// 2. VARIABLES GLOBALES (Servicios)
// ==========================================
let db = null
let s3 = null
let indexTemplate = null

// Valores por defecto para metadatos del blog
const defaultMeta = {
  title: 'Crianza Sana by Kids',
  description: 'Especialistas en el desarrollo integral de niños y niñas.',
  image: 'https://csdkids-images.s3.us-east-2.amazonaws.com/portadota.png',
}
const FRONTEND_BASE_URL = 'https://crianzasanabydkids.mx' // Ajusta según tu dominio real

// ==========================================
// 3. INICIALIZACIÓN DE SERVICIOS
// ==========================================
// Variable separada para la plantilla SEO (con placeholders)
let seoTemplate = null

async function initializeServices() {
  console.log('🔵 Iniciando servicios en segundo plano...')

  try {
    // --- FIREBASE ---
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      // Verificar si ya existe una app para no reinicializar
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        })
      }
      db = admin.firestore()
      console.log('✅ Firebase Admin inicializado.')
    } else {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT no definida. Firebase no funcionará.')
    }

    // --- AWS ---
    if (process.env.AWS_ACCESS_KEY_ID) {
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
      })
      s3 = new AWS.S3()
      console.log('✅ AWS S3 inicializado.')
    } else {
      console.warn('⚠️ Credenciales AWS no definidas. S3 no funcionará.')
    }

    // --- LEER PLANTILLAS HTML ---
    const distIndexPath = path.join(__dirname, 'dist', 'index.html')
    const templatePath = path.join(__dirname, 'templates', 'index.html')

    // 1. Cargar plantilla principal (Prod)
    try {
      await fs.access(distIndexPath)
      indexTemplate = await fs.readFile(distIndexPath, 'utf8')
      console.log('✅ Plantilla PROD cargada desde dist/index.html')
    } catch (e) {
      console.log('ℹ️ dist/index.html no encontrado (dev mode?), usando templates...')
      // Fallback
    }

    // 2. Cargar plantilla SEO (Solo como referencia, NO como fallback de app principal)
    try {
      seoTemplate = await fs.readFile(templatePath, 'utf8')
      console.log('✅ Plantilla SEO cargada correctamente desde templates/index.html')
    } catch (err) {
      console.warn('⚠️ No se pudo cargar templates/index.html.')
      // Fallback robusto en caso de que todo falle
      seoTemplate = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <link rel="icon" href="/logo_original.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>__OG_TITLE__</title>
    <meta name="description" content="__OG_DESCRIPTION__">
    <meta property="og:type" content="website">
    <meta property="og:title" content="__OG_TITLE__">
    <meta property="og:description" content="__OG_DESCRIPTION__">
    <meta property="og:image" content="__OG_IMAGE__">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="__OG_TITLE__">
    <meta name="twitter:description" content="__OG_DESCRIPTION__">
    <meta name="twitter:image" content="__OG_IMAGE__">
    <script>
      var destinationUrl = '__FRONTEND_REDIRECT_URL__';
      if (destinationUrl && destinationUrl !== '__FRONTEND_REDIRECT_URL__' && destinationUrl.startsWith('http')) {
        window.location.replace(destinationUrl);
      }
    </script>
</head>
<body>
    <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>Cargando...</h2>
        <p>Si no eres redirigido, <a href="__FRONTEND_REDIRECT_URL__">haz clic aquí</a>.</p>
    </div>
</body>
</html>`
    }

    console.log('🟢 Servicios inicializados.')
  } catch (error) {
    console.error('🔴 ERROR CRÍTICO inicializando servicios:', error)
  }
}

// Middleware para asegurar servicios listos (opcional, para rutas críticas)
const ensureServicesReady = (req, res, next) => {
  if (!db && req.path.includes('firestore')) {
    // Solo bloqueamos si realmente necesitamos DB y no está
    // Podríamos ser más permisivos o estrictos según necesidad
  }
  next()
}

// ==========================================
// 4. API ENDPOINTS
// ==========================================

// --- SPOTIFY ---
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const SHOW_ID = '4A7KWpa53WZnevgOBDYEHj'
let spotifyAccessToken = null
let spotifyTokenExpiration = null

async function getSpotifyToken() {
  if (spotifyAccessToken && spotifyTokenExpiration > Date.now()) return spotifyAccessToken
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )
    spotifyAccessToken = response.data.access_token
    spotifyTokenExpiration = Date.now() + (response.data.expires_in - 60) * 1000
    return spotifyAccessToken
  } catch (error) {
    console.error('Error Spotify Token:', error.message)
    throw error
  }
}

app.get('/api/episodios', async (req, res) => {
  try {
    const token = await getSpotifyToken()
    const response = await axios.get(
      `https://api.spotify.com/v1/shows/${SHOW_ID}/episodes?limit=10&market=MX`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    res.json(response.data.items)
  } catch (error) {
    console.error('Error /api/episodios:', error.message)
    res.status(500).json({ error: 'Error al obtener episodios' })
  }
})

// --- ANALYTICS (Google Analytics 4) ---
app.get('/api/routes-views', async (req, res) => {
  try {
    const paths = ['/about', '/blog', '/programs', '/login', '/live', '/gallery']
    const { startDate, endDate } = req.query
    const data = await getRoutePageViews(paths, startDate, endDate)
    res.json(data)
  } catch (error) {
    console.error('Error analytics routes-views:', error)
    res.status(500).json({ error: 'Error interno' })
  }
})

app.get('/api/blog-views', async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const data = await getBlogPageViews(startDate, endDate)
    res.json(data)
  } catch (error) {
    console.error('Error analytics blog-views:', error)
    res.status(500).json({ error: 'Error interno' })
  }
})

app.get('/api/person-views', async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const data = await getPersonPageViews(startDate, endDate)
    res.json(data)
  } catch (error) {
    console.error('Error analytics person-views:', error)
    res.status(500).json({ error: 'Error interno' })
  }
})

app.get('/api/homepage-views', async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const data = await getHomepageDailyViews(startDate, endDate)
    res.json(data)
  } catch (error) {
    console.error('Error analytics homepage-views:', error)
    res.status(500).json({ error: 'Error interno' })
  }
})

app.get('/api/blog-events-breakdown', async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const data = await getBlogEventBreakdown(startDate, endDate)
    res.json(data)
  } catch (error) {
    console.error('Error analytics blog-events:', error)
    res.status(500).json({ error: 'Error interno' })
  }
})

app.get('/api/location-views', async (req, res) => {
  try {
    const { startDate, endDate, personId } = req.query
    const data = await getLocationViews(startDate, endDate, personId)
    res.json(data)
  } catch (error) {
    console.error('Error analytics location-views:', error)
    res.status(500).json({ error: 'Error interno' })
  }
})

// --- AWS S3 ---
app.get('/api/aws/read-url', async (req, res) => {
  if (!s3) return res.status(503).json({ error: 'Servicio AWS no disponible' })
  const { key } = req.query
  if (!key) return res.status(400).json({ error: 'Key is required' })
  const params = { Bucket: process.env.AWS_BUCKET_NAME, Key: key, Expires: 3600 }
  try {
    const url = await s3.getSignedUrlPromise('getObject', params)
    res.json({ url })
  } catch (error) {
    console.error('Error AWS Read URL:', error)
    res.status(500).json({ error: 'Error generating read URL' })
  }
})

app.post('/api/aws/upload-url', async (req, res) => {
  if (!s3) return res.status(503).json({ error: 'Servicio AWS no disponible' })
  const { key, contentType } = req.body
  // Soporte para fileName/fileType (legacy) o key/contentType
  const finalKey = key || req.body.fileName
  const finalType = contentType || req.body.fileType

  if (!finalKey) return res.status(400).json({ error: 'Key/FileName is required' })

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: finalKey,
    Expires: 300,
    ContentType: finalType || 'application/octet-stream',
    ACL: 'public-read',
  }
  try {
    const url = await s3.getSignedUrlPromise('putObject', params)
    res.json({ url }) // Devolvemos { url } o { uploadUrl: url } según necesite el front
  } catch (error) {
    console.error('Error AWS Upload URL:', error)
    res.status(500).json({ error: 'Error generating upload URL' })
  }
})

// --- FIREBASE FIRESTORE ---
// Helper para verificar DB
const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ error: 'Base de datos no disponible' })
    return false
  }
  return true
}

app.get('/api/firestore/people', async (req, res) => {
  if (!checkDb(res)) return
  try {
    const querySnapshot = await db.collection('people').where('isSpecialist', '==', 1).get()
    const people = await Promise.all(
      querySnapshot.docs.map(async (doc) => {
        const personData = { id: doc.id, ...doc.data() }
        const socialsSnapshot = await db.collection(`people/${doc.id}/socials`).get()
        personData.socials = socialsSnapshot.docs.map((s) => ({ id: s.id, ...s.data() }))
        return personData
      }),
    )
    res.json(people)
  } catch (error) {
    console.error('Error Firestore People:', error)
    res.status(500).json({ error: 'Error fetching people' })
  }
})

app.get('/api/firestore/reels', async (req, res) => {
  if (!checkDb(res)) return
  const { personId } = req.query
  if (!personId) return res.status(400).json({ error: 'personId required' })
  try {
    const querySnapshot = await db
      .collection('reels')
      .where('idPersona', '==', String(personId))
      .get()
    const reels = querySnapshot.docs
      .map((doc) => {
        const data = doc.data()
        try {
          const url = data.url
          if (!url) return null
          const match = url.match(/\/reel\/([^/?#]+)/)
          return match ? match[1] : null
        } catch (e) {
          return null
        }
      })
      .filter((id) => id !== null)
    res.json(reels)
  } catch (error) {
    console.error('Error Firestore Reels:', error)
    res.status(500).json({ error: 'Error fetching reels' })
  }
})

app.get('/api/firestore/campaign', async (req, res) => {
  if (!checkDb(res)) return
  try {
    const docRef = db.collection('campana').doc('tVNJj7bqmEXeUYjb60r2')
    const snap = await docRef.get()
    if (snap.exists) {
      const data = snap.data()
      const { finalDate, img } = data
      if (!finalDate || !img) return res.json(null)
      const [day, month, year] = finalDate.split('-').map(Number)
      const expiryDate = new Date(year, month - 1, day)
      expiryDate.setHours(23, 59, 59, 999)
      const now = new Date()
      res.json({ img, show: now <= expiryDate })
    } else {
      res.json(null)
    }
  } catch (error) {
    console.error('Error Firestore Campaign:', error)
    res.status(500).json({ error: 'Error fetching campaign' })
  }
})

app.get('/api/firestore/videos', async (req, res) => {
  if (!checkDb(res)) return
  try {
    const snapshot = await db.collection('programas').get()
    const videos = snapshot.docs.map((doc) => {
      const data = doc.data()
      return { id: doc.id, ...data, parsedDate: new Date(data.date.split('-').reverse().join('-')) }
    })
    videos.sort((a, b) => b.parsedDate - a.parsedDate)
    res.json(videos)
  } catch (error) {
    console.error('Error Firestore Videos:', error)
    res.status(500).json({ error: 'Error fetching videos' })
  }
})

app.get('/api/firestore/collection/:name', async (req, res) => {
  if (!checkDb(res)) return
  const { name } = req.params
  const { orderField = 'orden', orderDirection = 'asc' } = req.query
  try {
    const snapshot = await db.collection(name).orderBy(orderField, orderDirection).get()
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    res.json(items)
  } catch (error) {
    console.error(`Error Firestore Collection ${name}:`, error)
    res.status(500).json({ error: `Error fetching collection ${name}` })
  }
})

app.get('/api/firestore/blogs/:id/comments', async (req, res) => {
  if (!checkDb(res)) return
  const { id } = req.params
  try {
    const snapshot = await db.collection(`blogs/${id}/comments`).get()
    const comments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    res.json(comments)
  } catch (error) {
    console.error(`Error Firestore Blog Comments ${id}:`, error)
    res.status(500).json({ error: 'Error fetching blog comments' })
  }
})

app.get('/api/firestore/galleries', async (req, res) => {
  if (!checkDb(res)) return
  try {
    const snapshot = await db.collection('galerias').get()
    const galleries = await Promise.all(
      snapshot.docs.map(async (docGaleria) => {
        const galeriaData = docGaleria.data()
        const fotosSnapshot = await db.collection(`galerias/${docGaleria.id}/fotos`).get()
        const fotos = fotosSnapshot.docs.map((f) => ({ id: f.id, ...f.data(), comments: [] }))
        return { id: docGaleria.id, ...galeriaData, images: fotos }
      }),
    )
    res.json(galleries)
  } catch (error) {
    console.error('Error Firestore Galleries:', error)
    res.status(500).json({ error: 'Error fetching galleries' })
  }
})

app.get('/api/firestore/galleries/:galeriaId/images/:imageId/comments', async (req, res) => {
  if (!checkDb(res)) return
  const { galeriaId, imageId } = req.params
  try {
    const snapshot = await db
      .collection(`galerias/${galeriaId}/fotos/${imageId}/comments`)
      .orderBy('createdAt', 'desc')
      .get()
    const comments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    res.json(comments)
  } catch (error) {
    console.error(`Error Firestore Image Comments ${imageId}:`, error)
    res.status(500).json({ error: 'Error fetching image comments' })
  }
})

app.get('/api/firestore/videos/:id/comments', async (req, res) => {
  if (!checkDb(res)) return
  const { id } = req.params
  try {
    const snapshot = await db.collection(`programas/${id}/comments`).get()
    const comments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    res.json(comments)
  } catch (error) {
    console.error(`Error Firestore Video Comments ${id}:`, error)
    res.status(500).json({ error: 'Error fetching video comments' })
  }
})

app.get('/api/firestore/programs', async (req, res) => {
  if (!checkDb(res)) return
  try {
    const snapshot = await db.collection('temas').get()
    const programs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    res.json(programs)
  } catch (error) {
    console.error('Error Firestore Programs (Temas):', error)
    res.status(500).json({ error: 'Error fetching programs' })
  }
})

app.put('/api/firestore/programs/:id', async (req, res) => {
  const { id } = req.params
  const data = req.body
  console.log(`📡 Request received to UPDATE program (tema) ${id}`, data)

  if (!db) {
    console.warn('⚠️ DB not available, MOCK update success.')
    return res.json({ success: true, message: 'Mock update success' })
  }

  try {
    await db.collection('temas').doc(id).set(data, { merge: true })
    res.json({ success: true, message: 'Program updated successfully' })
  } catch (error) {
    console.error('Error updating program:', error)
    res.status(500).json({ error: 'Error updating program' })
  }
})

// --- BANNER ---
app.get('/api/firestore/banner', async (req, res) => {
  console.log('📡 Request received for /api/firestore/banner')

  // MOCK DATA FALLBACK (If DB is down)
  if (!db) {
    console.warn('⚠️ DB not available, returning MOCK data for banner.')
    return res.json([
      {
        id: 'AC3DWGgPJQHHE9legSLY',
        active: 'true',
        altText: 'Aniversario Neurokids',
        imageSrc:
          'https://res.cloudinary.com/duiqgfa0v/image/upload/v1769641672/WhatsApp_Image_2026-01-26_at_18.57.02_q9bjld.jpg',
      },
    ])
  }

  try {
    const snapshot = await db.collection('banner').get()
    const banners = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    res.json(banners)
  } catch (error) {
    console.error('Error Firestore Banner:', error)
    res.status(500).json({ error: 'Error fetching banner' })
  }
})

// --- AD ---
app.get('/api/firestore/ad', async (req, res) => {
  console.log('📡 Request received for /api/firestore/ad')

  // MOCK DATA FALLBACK (If DB is down)
  if (!db) {
    console.warn('⚠️ DB not available, returning MOCK data for ad.')
    return res.json([
      {
        id: 'WosTmr9VgCsYknnsSDrK',
        altText: 'Ad anuncio 1',
        active: 'true',
        imageSrc: 'https://picsum.photos/200/300',
      },
      {
        id: 'w0dFr5VUUHE5XaD7ilMT',
        active: 'true',
        altText: 'Ad anuncio 2',
        imageSrc:
          'https://res.cloudinary.com/duiqgfa0v/image/upload/v1769474008/IMG_1400_djwzjb.png',
      },
    ])
  }

  try {
    const snapshot = await db.collection('ad').get()
    const ads = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    res.json(ads)
  } catch (error) {
    console.error('Error Firestore Ad:', error)
    res.status(500).json({ error: 'Error fetching ad' })
  }
})

// --- AD CRUD ---
app.put('/api/firestore/ad/:id', async (req, res) => {
  const { id } = req.params
  if (!db) return res.json({ success: true })
  try {
    await db.collection('ad').doc(id).set(req.body, { merge: true })
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating ad:', error)
    res.status(500).json({ error: 'Error updating ad' })
  }
})

app.post('/api/firestore/ad', async (req, res) => {
  if (!db) return res.json({ success: true, id: 'mock-id' })
  try {
    const docRef = await db.collection('ad').add(req.body)
    res.json({ success: true, id: docRef.id })
  } catch (error) {
    console.error('Error creating ad:', error)
    res.status(500).json({ error: 'Error creating ad' })
  }
})

app.delete('/api/firestore/ad/:id', async (req, res) => {
  const { id } = req.params
  if (!db) return res.json({ success: true })
  try {
    await db.collection('ad').doc(id).delete()
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting ad:', error)
    res.status(500).json({ error: 'Error deleting ad' })
  }
})

// --- BANNER CRUD ---
app.get('/api/firestore/banner/all', async (req, res) => {
  if (!db) return res.json([])
  try {
    const snapshot = await db.collection('banner').get()
    res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
  } catch (error) {
    console.error('Error fetching banners:', error)
    res.status(500).json({ error: 'Error fetching banners' })
  }
})

app.put('/api/firestore/banner/:id', async (req, res) => {
  const { id } = req.params
  if (!db) return res.json({ success: true })
  try {
    await db.collection('banner').doc(id).set(req.body, { merge: true })
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating banner:', error)
    res.status(500).json({ error: 'Error updating banner' })
  }
})

app.post('/api/firestore/banner', async (req, res) => {
  if (!db) return res.json({ success: true, id: 'mock-id' })
  try {
    const docRef = await db.collection('banner').add(req.body)
    res.json({ success: true, id: docRef.id })
  } catch (error) {
    console.error('Error creating banner:', error)
    res.status(500).json({ error: 'Error creating banner' })
  }
})

app.delete('/api/firestore/banner/:id', async (req, res) => {
  const { id } = req.params
  if (!db) return res.json({ success: true })
  try {
    await db.collection('banner').doc(id).delete()
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting banner:', error)
    res.status(500).json({ error: 'Error deleting banner' })
  }
})

// --- EVENTOS CRUD ---
app.put('/api/firestore/eventos/:id', async (req, res) => {
  const { id } = req.params
  if (!db) return res.json({ success: true })
  try {
    await db.collection('eventos').doc(id).set(req.body, { merge: true })
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating evento:', error)
    res.status(500).json({ error: 'Error updating evento' })
  }
})

app.post('/api/firestore/eventos', async (req, res) => {
  if (!db) return res.json({ success: true, id: 'mock-id' })
  try {
    const docRef = await db.collection('eventos').add(req.body)
    res.json({ success: true, id: docRef.id })
  } catch (error) {
    console.error('Error creating evento:', error)
    res.status(500).json({ error: 'Error creating evento' })
  }
})

app.delete('/api/firestore/eventos/:id', async (req, res) => {
  const { id } = req.params
  if (!db) return res.json({ success: true })
  try {
    await db.collection('eventos').doc(id).delete()
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting evento:', error)
    res.status(500).json({ error: 'Error deleting evento' })
  }
})

// --- CAMPANA CRUD ---
app.put('/api/firestore/campana/:id', async (req, res) => {
  const { id } = req.params
  if (!db) return res.json({ success: true })
  try {
    await db.collection('campana').doc(id).set(req.body, { merge: true })
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating campana:', error)
    res.status(500).json({ error: 'Error updating campana' })
  }
})

app.get('/api/firestore/campana/all', async (req, res) => {
  if (!db) return res.json([])
  try {
    const snapshot = await db.collection('campana').get()
    res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
  } catch (error) {
    console.error('Error fetching campanas:', error)
    res.status(500).json({ error: 'Error fetching campanas' })
  }
})

// --- VIDEOS (PROGRAMAS) CRUD ---
app.put('/api/firestore/videos/:id', async (req, res) => {
  const { id } = req.params
  if (!db) return res.json({ success: true })
  try {
    await db.collection('programas').doc(id).set(req.body, { merge: true })
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating video:', error)
    res.status(500).json({ error: 'Error updating video' })
  }
})

app.post('/api/firestore/videos', async (req, res) => {
  if (!db) return res.json({ success: true, id: 'mock-id' })
  try {
    const docRef = await db.collection('programas').add(req.body)
    res.json({ success: true, id: docRef.id })
  } catch (error) {
    console.error('Error creating video:', error)
    res.status(500).json({ error: 'Error creating video' })
  }
})

app.delete('/api/firestore/videos/:id', async (req, res) => {
  const { id } = req.params
  if (!db) return res.json({ success: true })
  try {
    await db.collection('programas').doc(id).delete()
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting video:', error)
    res.status(500).json({ error: 'Error deleting video' })
  }
})

// --- BLOGS ---
app.get('/api/firestore/blogs', async (req, res) => {
  console.log('📡 Request received for /api/firestore/blogs')

  // MOCK DATA FALLBACK
  if (!db) {
    console.warn('⚠️ DB not available, returning MOCK data for blogs.')
    return res.json([
      {
        id: '0KxoRmqUKBDPwwYEMbNP',
        authorImage: 'https://csdkids-images.s3.us-east-2.amazonaws.com/defaultAvatar1.jpg',
        authorName: 'Ana Laura Sosa Nevárez',
        category: 'Terapia de Lenguaje',
        categoryColor: '#2aa2c2',
        date: '2025-07-13T10:58:56.827Z',
        description:
          '13 de julio | Día Internacional del TDAH Hoy es un día para reflexionar, aprender y empatizar. El Trastorno por Dé...',
        imageUrl: 'https://csdkids-images.s3.us-east-2.amazonaws.com/defaultAvatar1.jpg',
        orden: 39,
        text: '<p><strong>Cada 13 de julio</strong> se conmemora el <strong>Día Internacional del TDAH</strong>...</p>',
        title: 'TDAH: Entender para acompañar mejor a nuestros niños',
      },
    ])
  }

  try {
    const snapshot = await db.collection('blogs').orderBy('date', 'desc').get()
    const blogs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    res.json(blogs)
  } catch (error) {
    console.error('Error Firestore Blogs:', error)
    res.status(500).json({ error: 'Error fetching blogs' })
  }
})

app.put('/api/firestore/blogs/:id', async (req, res) => {
  const { id } = req.params
  const data = req.body
  console.log(`📡 Request received to UPDATE blog ${id}`, data)

  if (!db) {
    console.warn('⚠️ DB not available, MOCK update success.')
    return res.json({ success: true, message: 'Mock update success' })
  }

  try {
    await db.collection('blogs').doc(id).set(data, { merge: true })
    res.json({ success: true, message: 'Blog updated successfully' })
  } catch (error) {
    console.error('Error updating blog:', error)
    res.status(500).json({ error: 'Error updating blog' })
  }
})

app.post('/api/firestore/blogs', async (req, res) => {
  const data = req.body
  console.log('📡 Request received to CREATE blog', data)

  if (!db) {
    console.warn('⚠️ DB not available, MOCK create success.')
    return res.json({ success: true, id: 'mock-new-id', message: 'Mock create success' })
  }

  try {
    const docRef = await db.collection('blogs').add(data)
    res.json({ success: true, id: docRef.id, message: 'Blog created successfully' })
  } catch (error) {
    console.error('Error creating blog:', error)
    res.status(500).json({ error: 'Error creating blog' })
  }
})

// ==========================================
// --- SUSCRIPTORES & EMAIL ---
// ==========================================

// Configurar cliente de Resend
if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY no configurada — emails desactivados')
}
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// POST /api/subscribers — Suscribir un correo
app.post('/api/subscribers', async (req, res) => {
  const { email } = req.body
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Correo inválido' })
  }

  // Mock si no hay DB
  if (!db) {
    console.warn('⚠️ DB no disponible, mock subscribe success.')
    return res.json({ success: true, message: 'Mock subscribe success' })
  }

  try {
    // Verificar si ya existe
    const snapshot = await db
      .collection('subscribers')
      .where('email', '==', email.toLowerCase())
      .get()

    if (!snapshot.empty) {
      return res.status(409).json({ error: 'Este correo ya está registrado', alreadyExists: true })
    }

    await db.collection('subscribers').add({
      email: email.toLowerCase(),
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Correo de bienvenida al nuevo suscriptor via Resend
    try {
      if (!resend) throw new Error('RESEND_API_KEY no configurada')
      await resend.emails.send({
        from: 'hola@crianzasanabydkids.mx',
        to: email,
        subject: "¡Bienvenido/a a Crianza Sana by D'Kids! 🌱",
        html: `
            <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
              <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:40px 30px;text-align:center">
                <h1 style="color:#fff;margin:0;font-size:28px">¡Gracias por suscribirte! 🌱</h1>
              </div>
              <div style="padding:30px">
                <p style="color:#374151;font-size:16px;line-height:1.6">Hola,</p>
                <p style="color:#374151;font-size:16px;line-height:1.6">Te has suscrito exitosamente a las actualizaciones de <strong>Crianza Sana by D'Kids</strong>. A partir de ahora recibirás notificaciones cuando publiquemos nuevos blogs y programas.</p>
                <p style="color:#6b7280;font-size:14px;margin-top:30px">Si no solicitaste esta suscripción, puedes ignorar este mensaje.</p>
              </div>
              <div style="background:#f9fafb;padding:20px;text-align:center">
                <p style="color:#9ca3af;font-size:12px;margin:0">© 2026 Crianza Sana by D'Kids — <a href="https://crianzasanabydkids.mx" style="color:#7c3aed">crianzasanabydkids.mx</a></p>
              </div>
            </div>
          `,
      })
    } catch (emailErr) {
      console.warn('⚠️ No se pudo enviar correo de bienvenida:', emailErr.message)
    }

    res.json({ success: true, message: 'Suscripción exitosa' })
  } catch (error) {
    console.error('Error al suscribir:', error)
    res.status(500).json({ error: 'Error al guardar suscripción' })
  }
})

// GET /api/subscribers — Obtener todos los suscriptores (admin)
app.get('/api/subscribers', async (req, res) => {
  if (!db) return res.json([])
  try {
    const snapshot = await db.collection('subscribers').orderBy('subscribedAt', 'desc').get()
    const subscribers = snapshot.docs.map((doc) => ({
      id: doc.id,
      email: doc.data().email,
      subscribedAt: doc.data().subscribedAt?.toDate?.() || null,
    }))
    res.json(subscribers)
  } catch (error) {
    console.error('Error obteniendo suscriptores:', error)
    res.status(500).json({ error: 'Error obteniendo suscriptores' })
  }
})

// DELETE /api/subscribers/:id — Eliminar un suscriptor
app.delete('/api/subscribers/:id', async (req, res) => {
  const { id } = req.params
  if (!db) return res.json({ success: true })
  try {
    await db.collection('subscribers').doc(id).delete()
    res.json({ success: true })
  } catch (error) {
    console.error('Error eliminando suscriptor:', error)
    res.status(500).json({ error: 'Error eliminando suscriptor' })
  }
})

// POST /api/send-newsletter — Enviar correo a todos los suscriptores
app.post('/api/send-newsletter', async (req, res) => {
  const { type, title, description, link } = req.body
  if (!title) return res.status(400).json({ error: 'Título requerido' })

  if (!process.env.RESEND_API_KEY && !resend) {
    return res.status(503).json({ error: 'Servicio de correo de Resend no configurado.' })
  }

  let subscribers = []
  if (db) {
    const snapshot = await db.collection('subscribers').get()
    subscribers = snapshot.docs.map((d) => d.data().email)
  }

  if (subscribers.length === 0) {
    return res.json({ success: true, sent: 0, message: 'No hay suscriptores registrados' })
  }

  const typeLabel = type === 'program' ? 'Nuevo Programa 🎬' : 'Nuevo Blog 📝'
  const ctaLabel = type === 'program' ? 'Ver Programa' : 'Leer Blog'
  const gradient =
    type === 'program'
      ? 'linear-gradient(135deg,#0f766e,#14b8a6)'
      : 'linear-gradient(135deg,#7c3aed,#a855f7)'

  const htmlBody = `
    <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
      <div style="background:${gradient};padding:40px 30px;text-align:center">
        <p style="color:rgba(255,255,255,0.8);margin:0 0 8px;font-size:14px;letter-spacing:2px;text-transform:uppercase">${typeLabel}</p>
        <h1 style="color:#fff;margin:0;font-size:26px;line-height:1.3">${title}</h1>
      </div>
      <div style="padding:30px">
        ${description ? `<p style="color:#374151;font-size:16px;line-height:1.7">${description}</p>` : ''}
        ${link ? `<div style="text-align:center;margin:30px 0"><a href="${link}" style="background:${gradient.includes('0f766e') ? '#0f766e' : '#7c3aed'};color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;display:inline-block">${ctaLabel} →</a></div>` : ''}
        <p style="color:#6b7280;font-size:14px">Recibe este correo porque estás suscrito/a a las actualizaciones de Crianza Sana by D'Kids.</p>
      </div>
      <div style="background:#f9fafb;padding:20px;text-align:center">
        <p style="color:#9ca3af;font-size:12px;margin:0">© 2026 Crianza Sana by D'Kids — <a href="https://crianzasanabydkids.mx" style="color:#7c3aed">crianzasanabydkids.mx</a></p>
      </div>
    </div>
  `

  let sent = 0
  let errors = 0
  for (const email of subscribers) {
    try {
      if (!resend) throw new Error('RESEND_API_KEY no configurada')
      await resend.emails.send({
        from: 'hola@crianzasanabydkids.mx',
        to: email,
        subject: `${typeLabel}: ${title}`,
        html: htmlBody,
      })
      sent++
    } catch (e) {
      console.error(`Error enviando a ${email}:`, e.message)
      errors++
    }
  }

  res.json({ success: true, sent, errors, total: subscribers.length })
})

// --- SEO / SERVER SIDE RENDERING (LIGERO) ---

app.get('/api/firestore/eventos', async (req, res) => {
  console.log('📡 Request received for /api/firestore/eventos')

  // MOCK DATA FALLBACK (If DB is down)
  if (!db) {
    console.warn('⚠️ DB not available, returning MOCK data for events.')
    return res.json([
      {
        id: 'LkjjgMSU400fjttjXAdi',
        altText: 'Prueba',
        buttonText: 'Texto del botón ',
        imageSrc: 'https://picsum.photos/200/300',
        message: 'Mensaje',
        phone: '6181072514',
        showButton: 'true',
        type: 'call',
      },
    ])
  }

  try {
    const snapshot = await db.collection('eventos').get()
    const eventos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    res.json(eventos)
  } catch (error) {
    console.error('Error Firestore Eventos:', error)
    res.status(500).json({ error: 'Error fetching eventos' })
  }
})
app.get('/blog/:id', async (req, res) => {
  const blogId = req.params.id
  console.log(`🤖 Solicitud de blog para metadatos: ${blogId}`)

  // IMPORTANTE: Siempre usar la plantilla compilada de producción (dist)
  // Si no está cargada (dev mode?), intentamos leerla o fallar a estático
  let htmlToSend = indexTemplate

  if (!htmlToSend) {
    // Si no tenemos plantilla en memoria, intentamos leer al vuelo
    try {
      const distPath = path.join(__dirname, 'dist', 'index.html')
      htmlToSend = await fs.readFile(distPath, 'utf8')
    } catch (e) {
      // ERROR CLARO: No hay build
      console.error('❌ Build no encontrado (dist/index.html)')
      return res.status(500).send(`
        <div style="font-family:sans-serif; text-align:center; padding:50px;">
          <h1>⚠️ Error: Application Not Built</h1>
          <p>The server cannot find <code>dist/index.html</code>.</p>
          <p>Please run <b>npm run build</b> to generate the production files.</p>
        </div>
      `)
    }
  }

  try {
    let metaData = defaultMeta
    if (db) {
      const blogRef = db.collection('blogs').doc(blogId)
      const doc = await blogRef.get()
      if (doc.exists) {
        const blogData = doc.data()

        // --- CONSTRUCCIÓN DE LA DESCRIPCIÓN ---
        let baseDescription =
          blogData.title1 || blogData.text?.substring(0, 150) + '...' || defaultMeta.description

        baseDescription = baseDescription.replace(/<[^>]*>?/gm, '') // Limpiar HTML

        if (blogData.category) {
          baseDescription = `${blogData.category} | ${baseDescription}`
        }

        metaData = {
          title: blogData.title || defaultMeta.title,
          description: baseDescription,
          image: blogData.imageUrl || defaultMeta.image,
        }
      }
    }

    // Reemplazo usando Regex sobre los tags existentes en dist/index.html
    // Buscamos <meta property="og:title" content="..."> y lo reemplazamos
    const finalHtml = htmlToSend
      .replace(/<title>.*?<\/title>/, `<title>${metaData.title}</title>`)
      .replace(
        /<meta property="og:title" content=".*?" \/>/,
        `<meta property="og:title" content="${metaData.title}" />`,
      )
      .replace(
        /<meta property="og:description" content=".*?" \/>/,
        `<meta property="og:description" content="${metaData.description}" />`,
      )
      .replace(
        /<meta property="og:image" content=".*?" \/>/,
        `<meta property="og:image" content="${metaData.image}" />`,
      )
      // Ajuste opcional para Twitter cards si existen
      .replace(
        /<meta name="twitter:title" content=".*?" \/>/,
        `<meta name="twitter:title" content="${metaData.title}" />`,
      )
      .replace(
        /<meta name="twitter:description" content=".*?" \/>/,
        `<meta name="twitter:description" content="${metaData.description}" />`,
      )
      .replace(
        /<meta name="twitter:image" content=".*?" \/>/,
        `<meta name="twitter:image" content="${metaData.image}" />`,
      )

    res.send(finalHtml)
  } catch (error) {
    console.error('❌ Error generando metadatos del blog:', error)
    // En caso de error, mandamos el HTML base sin modificar
    res.send(htmlToSend || 'Error cargando aplicación')
  }
})

// --- SEO QUIZ ---
app.get('/quiz', async (req, res) => {
  const catId = req.query.cat
  console.log(`🤖 Solicitud de quiz para metadatos: ${catId}`)

  let htmlToSend = indexTemplate
  if (!htmlToSend) {
    try {
      const distPath = path.join(__dirname, 'dist', 'index.html')
      htmlToSend = await fs.readFile(distPath, 'utf8')
    } catch (e) {
      console.error('❌ Build no encontrado (dist/index.html)')
      return res.status(500).send(`
        <div style="font-family:sans-serif; text-align:center; padding:50px;">
          <h1>⚠️ Error: Application Not Built</h1>
          <p>The server cannot find <code>dist/index.html</code>.</p>
          <p>Please run <b>npm run build</b> to generate the production files.</p>
        </div>
      `)
    }
  }

  const categories = [
    { id: 'pediatria', name: 'Pediatría / Cardiología', emoji: '🩺' },
    { id: 'psicologia', name: 'Psicología Infantil', emoji: '❤️' },
    { id: 'nutricion', name: 'Nutrición', emoji: '🍎' },
    { id: 'lenguaje', name: 'Lenguaje / Comunicación', emoji: '👅' },
    { id: 'fisioterapia', name: 'Fisioterapia', emoji: '🤸' },
    { id: 'odontopediatria', name: 'Odontopediatría', emoji: '🦷' },
    { id: 'tcc', name: 'Terapia Cognitivo-Conductual', emoji: '🧠' },
    { id: 'legal', name: 'Orientación Legal Familiar', emoji: '⚖️' },
  ]

  let metaData = { ...defaultMeta }
  metaData.title = 'Quiz Crianza Sana'
  metaData.description =
    'Descubre si tu hijo necesita apoyo profesional con nuestro breve cuestionario.'

  if (catId) {
    const cat = categories.find((c) => c.id === catId)
    if (cat) {
      metaData.title = `${cat.emoji} Test de ${cat.name} - Crianza Sana`
      metaData.description = `Responde este test rápido para saber si tu hijo podría beneficiarse de apoyo en ${cat.name}.`
    }
  }

  const finalHtml = htmlToSend
    .replace(/<title>.*?<\/title>/, `<title>${metaData.title}</title>`)
    .replace(
      /<meta property="og:title" content=".*?" \/>/,
      `<meta property="og:title" content="${metaData.title}" />`,
    )
    .replace(
      /<meta property="og:description" content=".*?" \/>/,
      `<meta property="og:description" content="${metaData.description}" />`,
    )
    .replace(
      /<meta property="og:image" content=".*?" \/>/,
      `<meta property="og:image" content="${metaData.image}" />`,
    )

  res.send(finalHtml)
})
app.use(compression())
// ==========================================
// 5. SERVIR FRONTEND (VUE)
// ==========================================
// Servir archivos estáticos de la carpeta dist
app.use(express.static(path.join(__dirname, 'dist')))

// Manejo específico para archivos estáticos no encontrados (evitar devolver index.html como JS)
app.get(
  ['/assets/*', '/*.js', '/*.css', '/*.png', '/*.jpg', '/*.jpeg', '/*.gif', '/*.ico', '/*.svg'],
  (req, res) => {
    res.status(404).send('Archivo no encontrado')
  },
)

// Cualquier otra ruta que no sea API ni archivo estático, enviar al index.html (SPA)
app.get('*', (req, res) => {
  // Evitar cache del index.html para que siempre cargue la versión más reciente (con los nuevos JS/CSS)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

// ==========================================
// 6. ARRANCAR SERVIDOR
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor unificado escuchando en puerto ${PORT}`)

  initializeServices().catch((err) => {
    console.error('Error fatal iniciando servicios:', err)
  })
})
