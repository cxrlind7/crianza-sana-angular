import { BetaAnalyticsDataClient } from '@google-analytics/data'
import 'dotenv/config'

// Lee las credenciales desde la variable de entorno (Railway + .env local)
// Sin credenciales el servidor debe poder arrancar igual; solo fallan los endpoints de analytics.
const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
  : null

if (!credentials) {
  console.warn('⚠️ GOOGLE_APPLICATION_CREDENTIALS_JSON no definida. Analytics no funcionará.')
}

const analyticsDataClient = credentials
  ? new BetaAnalyticsDataClient({ credentials })
  : {
      runReport: async () => {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON no configurada')
      },
    }

/*
 * GA4 limita las consultas simultáneas por propiedad (error RESOURCE_EXHAUSTED: "Exhausted concurrent
 * requests quota"). El panel de analytics dispara decenas a la vez, así que todas pasan por esta fila:
 * máximo MAX_SIMULTANEAS corriendo, y si Google aún pide bajar el ritmo, se reintenta con espera.
 */
const MAX_SIMULTANEAS = 6
let corriendo = 0
const enEspera = []

function turno() {
  if (corriendo < MAX_SIMULTANEAS) {
    corriendo++
    return Promise.resolve()
  }
  return new Promise((resolve) => enEspera.push(resolve))
}

function liberar() {
  const siguiente = enEspera.shift()
  if (siguiente) siguiente()
  else corriendo--
}

const esCuotaSimultanea = (error) => error?.code === 8 || /RESOURCE_EXHAUSTED|concurrent requests/i.test(error?.message || '')

const runReportOriginal = analyticsDataClient.runReport.bind(analyticsDataClient)
analyticsDataClient.runReport = async (...args) => {
  for (let intento = 0; ; intento++) {
    await turno()
    try {
      return await runReportOriginal(...args)
    } catch (error) {
      if (!esCuotaSimultanea(error) || intento >= 3) throw error
    } finally {
      liberar()
    }
    await new Promise((r) => setTimeout(r, 400 * (intento + 1)))
  }
}

const PROPERTY_ID = '483239794'

export async function getBlogPageViews(startDate = '30daysAgo', endDate = 'today') {
  // 1️⃣ Consulta: visitas totales y tiempo de lectura promedio
  const [pageViewsResponse] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' }, // ✅ Vistas
      { name: 'activeUsers' }, // ✅ Usuarios activos
      { name: 'screenPageViewsPerUser' }, // ✅ Vistas por usuario
      { name: 'userEngagementDuration' }, // ✅ Tiempo total de interacción
      { name: 'eventCount' }, // ✅ Número de eventos
      { name: 'engagementRate' }, // ✅ Tasa de interacción
      { name: 'averageSessionDuration' }, // ✅ Duración promedio de sesión
    ],
  })

  // 2️⃣ Consulta: solo eventos 'share_blog'
  const [shareEventsResponse] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: {
          matchType: 'EXACT',
          value: 'share_blog',
        },
      },
    },
  })

  // 3️⃣ Consulta: visitas diarias por fecha
  const [dailyResponse] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }, { name: 'date' }],
    metrics: [{ name: 'screenPageViews' }],
  })

  // 4️⃣ Consulta: interacciones reales con cada blog (leer hasta el final, escuchar, compartir)
  const [interactionsResponse] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: ['scroll_blog_completo', 'escuchar_blog', 'share_blog'] },
      },
    },
  })

  const viewsByPath = {}

  pageViewsResponse.rows?.forEach((row) => {
    const path = row.dimensionValues[0].value
    const values = row.metricValues.map((v) => parseFloat(v.value))

    if (path.startsWith('/blog/')) {
      // DEBUG: Ver valores crudos para validar unidades
      // console.log(`Path: ${path}, Views: ${values[0]}, Users: ${values[1]}, Duration: ${values[3]}`)

      viewsByPath[path] = {
        visits: values[0],
        users: values[1],
        viewsPerUser: values[2].toFixed(2),
        avgEngagementPerUser: values[1] > 0 ? Math.round(values[3] / values[1]) : 0,
        avgEngagementPerVisit: values[0] > 0 ? Math.round(values[3] / values[0]) : 0,
        readTime: values[0] > 0 ? Math.round(values[3] / values[0]) : 0, // segundos (userEngagementDuration es en segundos)
        totalEvents: values[4],
        // engagementRate de GA es por SESIÓN (>10 s, 2+ páginas o conversión), no mide lo que se hizo
        // en el blog. Se conserva como referencia; la "tasa de interacción" se calcula abajo.
        gaEngagementRate: (parseFloat(values[5]) * 100).toFixed(2),
        avgSessionDuration: parseFloat(values[6]).toFixed(0),
        daily: {},
      }
    }
  })

  // Procesar eventos 'share_blog'
  shareEventsResponse.rows?.forEach((row) => {
    const path = row.dimensionValues[0].value
    const shares = parseInt(row.metricValues[0].value)

    if (viewsByPath[path]) {
      viewsByPath[path].shares = shares
      // const v = viewsByPath[path].visits
      // viewsByPath[path].interactionRate = v > 0 ? Math.round((shares / v) * 100) : 0
    }
  })

  // Interacciones por blog → tasa de interacción = % de visitas con una interacción real.
  interactionsResponse.rows?.forEach((row) => {
    const path = row.dimensionValues[0].value
    const event = row.dimensionValues[1].value
    const count = parseInt(row.metricValues[0].value)
    const entry = viewsByPath[path]
    if (!entry) return
    if (event === 'scroll_blog_completo') entry.completeReads = count
    if (event === 'escuchar_blog') entry.listens = count
    if (event === 'share_blog') entry.shares = Math.max(entry.shares || 0, count)
  })

  Object.values(viewsByPath).forEach((entry) => {
    entry.completeReads ??= 0
    entry.listens ??= 0
    entry.shares ??= 0
    const interactions = entry.completeReads + entry.listens + entry.shares
    entry.interactions = interactions
    // Una misma visita puede leer, escuchar y compartir: se topa en 100 %.
    entry.engagementRate = entry.visits > 0 ? Math.min(100, Math.round((interactions / entry.visits) * 100)) : 0
    entry.completeReadRate = entry.visits > 0 ? Math.min(100, Math.round((entry.completeReads / entry.visits) * 100)) : 0
  })

  // Procesar visitas diarias
  dailyResponse.rows?.forEach((row) => {
    const path = row.dimensionValues[0].value
    const date = row.dimensionValues[1].value
    const count = parseInt(row.metricValues[0].value)

    if (path.startsWith('/blog/')) {
      if (!viewsByPath[path]) {
        viewsByPath[path] = {
          visits: 0,
          averageReadTime: 0,
          shares: 0,
          interactionRate: 0,
          daily: {},
        }
      }

      if (!viewsByPath[path].daily) {
        viewsByPath[path].daily = {}
      }

      viewsByPath[path].daily[date] = count
    }
  })

  return viewsByPath
}

export async function getHomepageDailyViews(startDate = '30daysAgo', endDate = 'today') {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'screenPageViews' }],
    dimensionFilter: {
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'EXACT', value: '/' },
      },
    },
  })

  const data = {}
  response.rows?.forEach((row) => {
    const date = row.dimensionValues[0].value
    const count = parseInt(row.metricValues[0].value)
    data[date] = count
  })

  return data
}

export async function getRoutePageViews(paths = [], startDate = '30daysAgo', endDate = 'today') {
  const validPaths = Array.isArray(paths)
    ? paths.filter((p) => typeof p === 'string' && p.trim() !== '')
    : []

  if (!validPaths.length) {
    console.warn('No valid paths provided')
    return {}
  }

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
      { name: 'userEngagementDuration' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' }, // ✅ Added
    ],
    dimensionFilter: {
      orGroup: {
        expressions: validPaths.map((path) => ({
          filter: {
            fieldName: 'pagePath',
            stringFilter: {
              matchType: 'EXACT',
              value: path,
            },
          },
        })),
      },
    },
  })

  const data = {}
  response.rows?.forEach((row) => {
    const path = row.dimensionValues[0].value
    const views = parseInt(row.metricValues[0].value)
    const users = parseInt(row.metricValues[1].value)
    const duration = parseFloat(row.metricValues[2].value)
    const engagementRate = parseFloat(row.metricValues[3].value)
    const avgSessionDuration = parseFloat(row.metricValues[4].value)

    data[path] = {
      views,
      users,
      avgEngagementPerUser: users > 0 ? Math.round(duration / users) : 0,
      avgEngagementPerView: views > 0 ? Math.round(duration / views) : 0,
      engagementRate: (engagementRate * 100).toFixed(0),
      avgSessionDuration: avgSessionDuration.toFixed(0), // ✅ Added
    }
  })

  return data
}

export async function getPersonPageViews(startDate = '30daysAgo', endDate = 'today') {
  // Usamos BEGINS_WITH para capturar todos los perfiles (/person/1, /person/111, etc.)
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
      { name: 'userEngagementDuration' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' }, // ✅ Added
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'pagePath',
        stringFilter: {
          matchType: 'BEGINS_WITH',
          value: '/person/',
        },
      },
    },
  })

  const data = {}
  response.rows?.forEach((row) => {
    const path = row.dimensionValues[0].value
    const views = parseInt(row.metricValues[0].value)
    const users = parseInt(row.metricValues[1].value)
    const duration = parseFloat(row.metricValues[2].value)
    const engagementRate = parseFloat(row.metricValues[3].value)
    const avgSessionDuration = parseFloat(row.metricValues[4].value)

    data[path] = {
      views,
      users,
      avgEngagementPerUser: users > 0 ? Math.round(duration / users) : 0,
      avgEngagementPerView: views > 0 ? Math.round(duration / views) : 0,
      engagementRate: (engagementRate * 100).toFixed(0),
      avgSessionDuration: avgSessionDuration.toFixed(0), // ✅ Added
    }
  })

  return data
}

export async function getBlogEventBreakdown(startDate = '30daysAgo', endDate = 'today') {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
  })

  const breakdown = {}

  response.rows?.forEach((row) => {
    const path = row.dimensionValues[0].value
    const event = row.dimensionValues[1].value
    const count = parseInt(row.metricValues[0].value)

    if (path.startsWith('/blog/')) {
      if (!breakdown[path]) breakdown[path] = {}
      breakdown[path][event] = count
    }
  })

  return breakdown
}

export async function getLocationViews(startDate = '30daysAgo', endDate = 'today') {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'country' }, { name: 'city' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 50,
  })

  const locations = []
  response.rows?.forEach((row) => {
    const country = row.dimensionValues[0].value
    const city = row.dimensionValues[1].value
    const views = parseInt(row.metricValues[0].value)
    const users = parseInt(row.metricValues[1].value)
    if (country !== '(not set)') {
      locations.push({ country, city: city === '(not set)' ? 'Desconocida' : city, views, users })
    }
  })

  return locations
}

// ==========================================
// PANEL DE ANALÍTICAS: resumen, origen del tráfico y eventos
// ==========================================

const toISODate = (d) => d.toISOString().slice(0, 10)

/** Convierte 'today', 'NdaysAgo' o 'YYYY-MM-DD' a Date (UTC, sin hora). */
function resolveDate(value) {
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  if (!value || value === 'today') return today
  if (value === 'yesterday') return new Date(today.getTime() - 86400000)
  const ago = /^(\d+)daysAgo$/.exec(value)
  if (ago) return new Date(today.getTime() - Number(ago[1]) * 86400000)
  const d = new Date(`${value}T00:00:00Z`)
  return isNaN(d.getTime()) ? today : d
}

/** Periodo anterior de la misma duración, para comparar ("vs. periodo anterior"). */
function previousRange(startDate, endDate) {
  const start = resolveDate(startDate)
  const end = resolveDate(endDate)
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1)
  const prevEnd = new Date(start.getTime() - 86400000)
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000)
  return { startDate: toISODate(prevStart), endDate: toISODate(prevEnd) }
}

const runReport = (request) =>
  analyticsDataClient.runReport({ property: `properties/${PROPERTY_ID}`, ...request }).then(([r]) => r)

/** Un reporte que falla (p. ej. una dimensión sin datos aún) no tumba todo el panel. */
const safeReport = (label, request) =>
  runReport(request).catch((error) => {
    console.warn(`⚠️ Analytics: reporte "${label}" falló:`, error.message)
    return { rows: [] }
  })

const eventFilter = (names) => ({
  filter: { fieldName: 'eventName', inListFilter: { values: names } },
})

const num = (v) => Number(v?.value ?? 0)

export async function getSiteOverview(startDate = '30daysAgo', endDate = 'today') {
  const prev = previousRange(startDate, endDate)
  const metrics = [
    { name: 'activeUsers' },
    { name: 'newUsers' },
    { name: 'sessions' },
    { name: 'screenPageViews' },
    { name: 'userEngagementDuration' },
    { name: 'engagedSessions' },
  ]

  const [current, previous, daily, devices] = await Promise.all([
    runReport({ dateRanges: [{ startDate, endDate }], metrics }),
    runReport({ dateRanges: [prev], metrics }),
    runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
    }),
    runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }],
    }),
  ])

  const totals = (report) => {
    const m = report.rows?.[0]?.metricValues ?? []
    const users = num(m[0])
    const sessions = num(m[2])
    return {
      users,
      newUsers: num(m[1]),
      sessions,
      pageViews: num(m[3]),
      // Tiempo real con la página en primer plano, promedio por visitante (segundos).
      avgEngagementPerUser: users > 0 ? Math.round(num(m[4]) / users) : 0,
      engagedSessionsRate: sessions > 0 ? Math.round((num(m[5]) / sessions) * 100) : 0,
    }
  }

  return {
    current: totals(current),
    previous: totals(previous),
    previousRange: prev,
    daily: (daily.rows ?? [])
      .map((r) => ({
        date: r.dimensionValues[0].value,
        users: num(r.metricValues[0]),
        pageViews: num(r.metricValues[1]),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    devices: (devices.rows ?? []).map((r) => ({ device: r.dimensionValues[0].value, users: num(r.metricValues[0]) })),
  }
}

/** Agrupa la fuente de cada sesión en orígenes entendibles. */
function classifySource(source, medium, channel) {
  const s = `${source} ${medium}`.toLowerCase()
  if (/whatsapp|wa\.me/.test(s)) return 'WhatsApp'
  if (/instagram|^ig\b/.test(s)) return 'Instagram'
  if (/facebook|fb\.|^fb\b|meta/.test(s)) return 'Facebook'
  if (/tiktok/.test(s)) return 'TikTok'
  if (/youtube/.test(s)) return 'YouTube'
  if (/spotify/.test(s)) return 'Spotify'
  if (/compartido/.test(s)) return 'Enlace compartido'
  if (/^(qr|tarjeta)$/.test(String(source).toLowerCase())) return 'Código QR / tarjeta digital'
  if (/google/.test(s)) return medium === 'cpc' ? 'Google (anuncios)' : 'Google'
  if (/bing|yahoo|duckduckgo|ecosia/.test(s)) return 'Otros buscadores'
  if (/chatgpt|openai|perplexity|claude|gemini|copilot/.test(s)) return 'Asistentes de IA'
  if (source === '(direct)') return 'Directo / WhatsApp sin etiqueta'
  if (channel === 'Organic Social') return 'Otras redes sociales'
  if (channel === 'Referral') return 'Otros sitios web'
  return 'Otros'
}

export async function getTrafficSources(startDate = '30daysAgo', endDate = 'today') {
  const report = await runReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'engagedSessions' }, { name: 'userEngagementDuration' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 200,
  })

  const byOrigin = {}
  const sources = []
  for (const row of report.rows ?? []) {
    const [source, medium, channel] = row.dimensionValues.map((d) => d.value)
    const [sessions, users, engaged, duration] = row.metricValues.map(num)
    const origin = classifySource(source, medium, channel)
    sources.push({ source, medium, origin, sessions, users })
    const o = (byOrigin[origin] ??= { origin, sessions: 0, users: 0, engagedSessions: 0, engagementDuration: 0 })
    o.sessions += sessions
    o.users += users
    o.engagedSessions += engaged
    o.engagementDuration += duration
  }

  const origins = Object.values(byOrigin)
    .map((o) => ({
      origin: o.origin,
      sessions: o.sessions,
      users: o.users,
      engagedRate: o.sessions > 0 ? Math.round((o.engagedSessions / o.sessions) * 100) : 0,
      avgTimePerSession: o.sessions > 0 ? Math.round(o.engagementDuration / o.sessions) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)

  return { origins, sources: sources.slice(0, 25) }
}

const TRACKED_EVENTS = [
  'click_whatsapp',
  'click_red_social',
  'ver_video',
  'video_completo',
  'quiz_inicio',
  'quiz_resultado',
  'suscripcion_newsletter',
  'descarga',
  'share_blog',
  'compartir',
  'escuchar_blog',
  'scroll_blog_completo',
]

export async function getSiteEvents(startDate = '30daysAgo', endDate = 'today') {
  const range = [{ startDate, endDate }]
  const prev = previousRange(startDate, endDate)
  const breakdown = (label, dims, events, limit = 25) =>
    safeReport(label, {
      dateRanges: range,
      dimensions: dims.map((name) => ({ name })),
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: eventFilter(events),
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit,
    })

  const [totals, prevTotals, whatsappByLabel, whatsappByPage, videos, social, quiz, shares, downloads] =
    await Promise.all([
      breakdown('totales', ['eventName'], TRACKED_EVENTS, 50),
      safeReport('totales anteriores', {
        dateRanges: [prev],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: eventFilter(TRACKED_EVENTS),
      }),
      breakdown('whatsapp por botón', ['linkText'], ['click_whatsapp']),
      breakdown('whatsapp por página', ['pagePath'], ['click_whatsapp']),
      breakdown('videos', ['eventName', 'videoTitle', 'videoProvider'], ['ver_video', 'video_completo'], 100),
      breakdown('redes sociales', ['linkDomain'], ['click_red_social']),
      breakdown('quiz', ['eventName', 'method'], ['quiz_inicio', 'quiz_resultado']),
      breakdown('compartidos', ['method'], ['share_blog', 'compartir']),
      breakdown('descargas', ['fileName'], ['descarga']),
    ])

  const countsByName = (report) =>
    Object.fromEntries((report.rows ?? []).map((r) => [r.dimensionValues[0].value, num(r.metricValues[0])]))
  const simple = (report) =>
    (report.rows ?? [])
      .map((r) => ({ label: r.dimensionValues[0].value, count: num(r.metricValues[0]) }))
      .filter((r) => r.label && r.label !== '(not set)')

  const videoMap = {}
  for (const r of videos.rows ?? []) {
    const [event, title, provider] = r.dimensionValues.map((d) => d.value)
    const v = (videoMap[title] ??= { title, provider, plays: 0, completed: 0 })
    if (event === 'ver_video') v.plays += num(r.metricValues[0])
    else v.completed += num(r.metricValues[0])
  }

  const quizMap = {}
  for (const r of quiz.rows ?? []) {
    const [event, category] = r.dimensionValues.map((d) => d.value)
    const q = (quizMap[category] ??= { category, started: 0, finished: 0 })
    if (event === 'quiz_inicio') q.started += num(r.metricValues[0])
    else q.finished += num(r.metricValues[0])
  }

  return {
    totals: countsByName(totals),
    previousTotals: countsByName(prevTotals),
    whatsappByLabel: simple(whatsappByLabel),
    whatsappByPage: simple(whatsappByPage),
    videos: Object.values(videoMap)
      .filter((v) => v.title && v.title !== '(not set)')
      .sort((a, b) => b.plays - a.plays),
    social: simple(social),
    quiz: Object.values(quizMap)
      .filter((q) => q.category && q.category !== '(not set)')
      .sort((a, b) => b.started - a.started),
    shares: simple(shares),
    downloads: simple(downloads),
  }
}

// Piezas reutilizadas por utils/analyticsEspecialista.js
export { runReport, safeReport, eventFilter, num, previousRange, classifySource, resolveDate }
