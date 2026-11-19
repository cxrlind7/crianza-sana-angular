// Importa un live de Facebook como programa(s): descarga el video, lee los temas del flyer,
// ubica el cambio de especialista, genera las portadas y publica en `programas`.
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import ffmpegPath from 'ffmpeg-static'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'

const run = promisify(execFile)
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'portadas')
const MODEL = 'claude-opus-5-5'

GlobalFonts.registerFromPath(path.join(ASSETS, 'Poppins-Bold.ttf'), 'PoppinsBold')
GlobalFonts.registerFromPath(path.join(ASSETS, 'Poppins-SemiBold.ttf'), 'PoppinsSemiBold')

// ---------- yt-dlp ----------
// Binario autónomo (no necesita Python). Se renueva cada semana porque Facebook cambia seguido.
const YTDLP_URL =
  process.platform === 'win32'
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux'
const YTDLP_PATH = process.env.YTDLP_PATH || path.join(os.tmpdir(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')

async function ensureYtDlp() {
  const stat = await fsp.stat(YTDLP_PATH).catch(() => null)
  if (stat && Date.now() - stat.mtimeMs < 7 * 24 * 3600 * 1000) return YTDLP_PATH
  const res = await fetch(YTDLP_URL)
  if (!res.ok) throw new Error(`No se pudo descargar yt-dlp (${res.status})`)
  await fsp.writeFile(YTDLP_PATH, Buffer.from(await res.arrayBuffer()))
  await fsp.chmod(YTDLP_PATH, 0o755)
  return YTDLP_PATH
}

export async function liveInfo(fbUrl) {
  const bin = await ensureYtDlp()
  const { stdout } = await run(bin, ['--skip-download', '--dump-single-json', '--no-warnings', fbUrl], {
    maxBuffer: 64 * 1024 * 1024,
  })
  const info = JSON.parse(stdout)
  return { title: info.title, timestamp: info.timestamp, duration: info.duration, liveStatus: info.live_status }
}

async function downloadVideo(fbUrl, outFile) {
  const bin = await ensureYtDlp()
  await run(
    bin,
    ['-f', 'bv*[height<=1080]+ba/b', '--merge-output-format', 'mp4', '--ffmpeg-location', ffmpegPath, '--no-warnings', '-o', outFile, fbUrl],
    { maxBuffer: 64 * 1024 * 1024, timeout: 60 * 60 * 1000 },
  )
}

// ---------- ffmpeg ----------
async function videoDuration(file) {
  // ffmpeg sin salida termina con error, pero imprime la duración en stderr.
  const out = await run(ffmpegPath, ['-i', file]).catch((e) => e)
  const m = /Duration: (\d+):(\d+):(\d+\.?\d*)/.exec(out.stderr || '')
  if (!m) throw new Error('No se pudo leer la duración del video')
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

export async function frameAt(file, seconds) {
  const { stdout } = await run(
    ffmpegPath,
    ['-v', 'error', '-ss', String(seconds), '-i', file, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
  )
  return stdout
}

/** Cuadrícula de capturas: una cada `step` segundos desde `start`, `cols` por renglón. */
export async function contactSheet(file, start, length, step, cols) {
  const count = Math.max(1, Math.floor(length / step))
  const rows = Math.ceil(count / cols)
  const { stdout } = await run(
    ffmpegPath,
    [
      '-v', 'error', '-ss', String(start), '-t', String(length), '-i', file,
      '-vf', `fps=1/${step},scale=320:-1,tile=${cols}x${rows}`,
      '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-q:v', '4', '-',
    ],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
  )
  return { image: stdout, count, cols, rows }
}

// ---------- Claude ----------
let anthropic = null
const claude = () => (anthropic ??= new Anthropic())

async function askJson(content, schema) {
  const response = await claude().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content }],
  })
  if (response.stop_reason === 'refusal') throw new Error('Claude rechazó la solicitud')
  const text = response.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error(`Respuesta vacía de Claude (${response.stop_reason})`)
  return JSON.parse(text)
}

const img = (buffer, mediaType) => ({
  type: 'image',
  source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
})

async function leerFlyer(flyer, especialistas) {
  const lista = especialistas.map((p) => `- ${p.id}: ${p.name}`).join('\n')
  return askJson(
    [
      img(flyer.buffer, flyer.mediaType),
      {
        type: 'text',
        text: `Este es el flyer de un programa de radio "Crianza Sana by D-kids". La presentadora es Carina Lares; no es invitada.
Extrae los temas en el orden numerado del flyer y quién presenta cada uno.

- titulo: el tema tal cual, pero con ortografía y acentos corregidos y separadores normalizados ("; " → ": " cuando introduce la explicación). No cambies las palabras.
- especialista: nombre completo como aparece, sin títulos (Dr., Dra., Psic., L.T.C.H., etc.).
- nombreCorto: nombre de pila y primer apellido en MAYÚSCULAS, sin títulos (ej. "LUIS GALVÁN").
- especialistaId: el id de esta lista si es la misma persona, o null si no está:
${lista}`,
      },
    ],
    {
      type: 'object',
      properties: {
        temas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              titulo: { type: 'string' },
              especialista: { type: 'string' },
              nombreCorto: { type: 'string' },
              especialistaId: { type: ['integer', 'null'] },
            },
            required: ['titulo', 'especialista', 'nombreCorto', 'especialistaId'],
            additionalProperties: false,
          },
        },
      },
      required: ['temas'],
      additionalProperties: false,
    },
  )
}

const CAMBIO_SCHEMA = {
  type: 'object',
  properties: { indice: { type: 'integer' } },
  required: ['indice'],
  additionalProperties: false,
}

async function elegirCaptura(sheet, primero, segundo) {
  const { indice } = await askJson(
    [
      img(sheet.image, 'image/jpeg'),
      {
        type: 'text',
        text: `Cuadrícula de ${sheet.count} capturas de un programa de radio en video, en orden de izquierda a derecha y de arriba abajo, numeradas desde 0 (${sheet.cols} por renglón).
En la primera parte la presentadora (Carina) platica con ${primero}; después ${primero} se va y entra ${segundo}.
¿Cuál es el número de la primera captura en la que ${primero} ya se está yendo o ${segundo} ya está entrando o sentado?`,
      },
    ],
    CAMBIO_SCHEMA,
  )
  return Math.min(Math.max(indice, 0), sheet.count - 1)
}

/** Segundo en que entra el segundo especialista: primero por minuto, luego cada 5 s. */
async function detectarCambio(file, duration, primero, segundo) {
  const gruesa = await contactSheet(file, 0, duration, 60, 6)
  const minuto = await elegirCaptura(gruesa, primero, segundo)
  const inicio = Math.max(0, (minuto - 1) * 60)
  const fina = await contactSheet(file, inicio, 120, 5, 6)
  const idx = await elegirCaptura(fina, primero, segundo)
  return Math.round(inicio + idx * 5)
}

// ---------- Portadas ----------
// Mismo diseño que las de octubre 2026: cuadro de color con el tema, recuadro blanco con el nombre
// y comillas sobre papel rasgado. Primer tema turquesa, segundo azul marino.
const COLORES = ['#17a2c3', '#0b2a49']
const BLANCO = '#f7f7f5'
const CUADRO = [500, 598, 921, 259] // x, y, ancho, alto
const RECUADRO = [543, 829, 827, 174]
const COMILLAS = [
  ['izq', 380, 590],
  ['der', 1285, 960],
]

function lineas(ctx, texto, maxWidth) {
  const out = []
  let cur = ''
  for (const w of texto.split(/\s+/)) {
    const t = cur ? `${cur} ${w}` : w
    if (ctx.measureText(t).width <= maxWidth || !cur) cur = t
    else {
      out.push(cur)
      cur = w
    }
  }
  if (cur) out.push(cur)
  return out
}

async function comilla(nombre, color) {
  const papel = await loadImage(path.join(ASSETS, `comilla-${nombre}-papel.png`))
  const marca = await loadImage(path.join(ASSETS, `comilla-${nombre}-marca.png`))
  const c = createCanvas(papel.width, papel.height)
  const ctx = c.getContext('2d')
  ctx.drawImage(marca, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.globalCompositeOperation = 'destination-over'
  ctx.drawImage(papel, 0, 0)
  return c
}

export async function generarPortada(framePng, titulo, nombre, color) {
  const canvas = createCanvas(1920, 1080)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(await loadImage(framePng), 0, 0, 1920, 1080)
  for (const [n, x, y] of COMILLAS) ctx.drawImage(await comilla(n, color), x, y)
  ctx.fillStyle = color
  ctx.fillRect(...CUADRO)
  ctx.fillStyle = BLANCO
  ctx.fillRect(...RECUADRO)

  let size = 48
  let ls
  for (;;) {
    ctx.font = `${size}px PoppinsBold`
    ls = lineas(ctx, titulo, 700)
    if (ls.length * size <= 200 || size <= 34) break
    size -= 2
  }
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = CUADRO[0] + CUADRO[2] / 2
  const cy = (CUADRO[1] + RECUADRO[1]) / 2
  ls.forEach((l, i) => ctx.fillText(l, cx, cy + (i - (ls.length - 1) / 2) * size))

  ctx.font = '46px PoppinsSemiBold'
  ctx.fillStyle = color
  ctx.fillText(nombre, RECUADRO[0] + RECUADRO[2] / 2, RECUADRO[1] + RECUADRO[3] / 2 + 2)
  return canvas.encode('jpeg', 92)
}

// ---------- Publicación ----------
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Fecha del live en hora de Durango (YYYY-MM-DD). */
export function fechaDurango(timestamp) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date(timestamp * 1000))
}

async function subir(s3, bucket, publicBase, key, body, contentType) {
  await s3.upload({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }).promise()
  return `${publicBase.replace(/\/$/, '')}/${key}`
}

/**
 * Procesa una importación completa. `log` recibe avances para mostrarlos en el panel.
 * Devuelve los ids de los programas creados.
 */
export async function procesarLive({ fbUrl, flyerUrl, fecha, db, s3, bucket, publicBase, log = () => {} }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY en el servidor')
  if (!s3 || !bucket || !publicBase) throw new Error('Almacenamiento (R2) no configurado')

  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'live-'))
  try {
    log('Leyendo el flyer')
    const flyerRes = await fetch(flyerUrl)
    if (!flyerRes.ok) throw new Error(`No se pudo leer el flyer (${flyerRes.status})`)
    const flyer = {
      buffer: Buffer.from(await flyerRes.arrayBuffer()),
      mediaType: (flyerRes.headers.get('content-type') || 'image/jpeg').split(';')[0],
    }
    const especialistas = (await db.collection('especialistas').get()).docs.map((d) => ({ id: Number(d.id), ...d.data() }))
    const { temas } = await leerFlyer(flyer, especialistas)
    if (!temas.length) throw new Error('No se encontraron temas en el flyer')
    if (temas.length > 2) temas.length = 2

    log('Descargando el live de Facebook')
    const video = path.join(tmp, 'live.mp4')
    await downloadVideo(fbUrl, video)
    const duration = await videoDuration(video)

    let cambio = null
    if (temas.length === 2) {
      log('Buscando el cambio de especialista')
      cambio = await detectarCambio(video, duration, temas[0].especialista, temas[1].especialista)
    }

    const [, mes, dia] = fecha.split('-').map(Number)
    const base = `${String(dia).padStart(2, '0')}-${MESES[mes - 1]}`
    const stamp = Date.now()

    log('Generando portadas')
    const segmentos = temas.map((t, i) => {
      const inicio = i === 0 ? 0 : cambio
      const fin = i === 0 && cambio ? cambio : duration
      return { ...t, inicio, captura: inicio + (fin - inicio) * 0.25 }
    })
    const portadas = []
    for (const [i, s] of segmentos.entries()) {
      const frame = await frameAt(video, s.captura)
      portadas.push(await generarPortada(frame, s.titulo, s.nombreCorto, COLORES[i % 2]))
    }

    log('Subiendo video y portadas')
    const videoUrl = await subir(s3, bucket, publicBase, `programas/${base}-${fecha.slice(0, 4)}-${stamp}.mp4`, fs.createReadStream(video), 'video/mp4')
    const thumbs = []
    for (const [i, p] of portadas.entries()) {
      const sufijo = portadas.length > 1 ? `-${i + 1}` : ''
      thumbs.push(await subir(s3, bucket, publicBase, `programas/${base}${sufijo}-${stamp}.jpg`, p, 'image/jpeg'))
    }

    log('Publicando')
    const ids = []
    for (const [i, s] of segmentos.entries()) {
      const persona = especialistas.find((p) => p.id === s.especialistaId)
      const ref = await db.collection('programas').add({
        title: s.titulo,
        date: fecha,
        url: s.inicio ? `${videoUrl}#t=${s.inicio}` : videoUrl,
        thumbnail: thumbs[i],
        participant: persona?.name || s.especialista,
        description: '',
        publishAt: '',
      })
      ids.push(ref.id)
    }
    return { ids, temas: segmentos.map((s) => ({ titulo: s.titulo, especialista: s.especialista, inicio: s.inicio })) }
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}
