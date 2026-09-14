import { BetaAnalyticsDataClient } from '@google-analytics/data'
import 'dotenv/config'

// Lee las credenciales desde la variable de entorno (Railway + .env local)
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)

const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials,
})

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
        engagementRate: (parseFloat(values[5]) * 100).toFixed(2), // GA4 devuelve decimal (0.55), convertimos a %
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
