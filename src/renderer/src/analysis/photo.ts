// 照片导入与智能分析：代理图 / 缩略图、EXIF 拍摄时间、清晰度、曝光、重复检测、人脸与闭眼
import type { FaceBox, PhotoAnalysis, PhotoAsset, PhotoFlag } from '@shared/types'
import { fileUrl } from '../engine/textures'
import { strHash } from '../engine/math'
import { parseProduct } from '../engine/textkeys'
import exifr from 'exifr'
import type { FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision'

const PROXY = 2048
const THUMB = 360

let landmarkerP: Promise<FaceLandmarker | null> | null = null

function getLandmarker(): Promise<FaceLandmarker | null> {
  if (!landmarkerP) {
    landmarkerP = (async () => {
      try {
        const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision')
        const base = new URL('./mediapipe', location.href).toString()
        const fileset = await FilesetResolver.forVisionTasks(base)
        return await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: new URL('./models/face_landmarker.task', location.href).toString(), delegate: 'GPU' },
          runningMode: 'IMAGE',
          numFaces: 6,
          minFaceDetectionConfidence: 0.4,
          outputFaceBlendshapes: true
        })
      } catch (e) {
        console.warn('人脸模型加载失败，跳过人脸分析', e)
        return null
      }
    })()
  }
  return landmarkerP
}

// ---------- 主体抠图（3D 视差用，本地运行） ----------

let segmenterP: Promise<ImageSegmenter | null> | null = null
function getSegmenter(): Promise<ImageSegmenter | null> {
  if (!segmenterP) {
    segmenterP = (async () => {
      try {
        const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
        const fileset = await FilesetResolver.forVisionTasks(new URL('./mediapipe', location.href).toString())
        return await ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: new URL('./models/deeplab_v3.tflite', location.href).toString(), delegate: 'GPU' },
          runningMode: 'IMAGE',
          outputCategoryMask: true,
          outputConfidenceMasks: false
        })
      } catch (e) {
        console.warn('抠图模型加载失败，跳过 3D 视差', e)
        return null
      }
    })()
  }
  return segmenterP
}

// DeepLab（PASCAL VOC）类别里适合做主体的：鸟、猫、牛、狗、马、人、羊
const SUBJECT = new Set([3, 8, 10, 12, 13, 15, 17])

/** 生成主体蒙版 PNG（白色为主体），主体太小或太大时放弃 */
async function makeMask(src: ImageBitmap, key: string): Promise<{ path: string; area: number } | null> {
  const seg = await getSegmenter()
  if (!seg) return null
  const s = Math.min(1, 512 / Math.max(src.width, src.height))
  const c = canvasOf(src.width * s, src.height * s)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  let result
  try {
    result = seg.segment(c as unknown as HTMLCanvasElement)
  } catch (e) {
    console.warn('抠图失败', e)
    return null
  }
  const cm = result.categoryMask
  if (!cm) {
    result.close()
    return null
  }
  const labels = cm.getAsUint8Array()
  const w = cm.width
  const h = cm.height
  const img = new ImageData(w, h)
  let fg = 0
  for (let i = 0; i < labels.length; i++) {
    const on = SUBJECT.has(labels[i])
    if (on) fg++
    const v = on ? 255 : 0
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  result.close()
  const area = fg / (w * h)
  if (area < 0.04 || area > 0.7) return null
  const raw = canvasOf(w, h)
  raw.getContext('2d')!.putImageData(img, 0, 0)
  // 边缘羽化，避免主体抠图出现锯齿
  const out = canvasOf(w, h)
  const g = out.getContext('2d')!
  g.filter = `blur(${Math.max(1, Math.round(w / 300))}px)`
  g.drawImage(raw, 0, 0)
  const blob = await out.convertToBlob({ type: 'image/png' })
  const path = await window.mv.cacheWrite(`m-${key}.png`, await blob.arrayBuffer())
  return { path, area: Math.round(area * 100) / 100 }
}

/** 给还没有蒙版的照片补做抠图（打开 3D 视差时调用） */
export async function ensureMasks(photos: PhotoAsset[], onProgress?: (done: number, total: number) => void): Promise<PhotoAsset[]> {
  const todo = photos.filter((p) => p.media !== 'video' && !p.mask && p.maskArea === undefined)
  let done = 0
  const out = new Map<string, PhotoAsset>()
  for (const p of todo) {
    try {
      const res = await fetch(fileUrl(p.proxy ?? p.path))
      const bmp = await createImageBitmap(await res.blob(), { imageOrientation: 'from-image' })
      const key = strHash(`${p.path}|mask`).toString(16)
      const m = await makeMask(bmp, key)
      bmp.close()
      out.set(p.id, { ...p, mask: m?.path, maskArea: m?.area ?? 0 })
    } catch {
      out.set(p.id, { ...p, maskArea: 0 })
    }
    onProgress?.(++done, todo.length)
  }
  return photos.map((p) => out.get(p.id) ?? p)
}

// ---------- 视频素材 ----------

export const VIDEO_RE = /\.(mp4|mov|m4v|webm)$/i

/** 取视频的一帧做封面，并读出时长和尺寸 */
async function videoFrame(path: string): Promise<{ bmp: ImageBitmap; duration: number }> {
  const v = document.createElement('video')
  v.muted = true
  v.preload = 'auto'
  v.crossOrigin = 'anonymous'
  v.src = fileUrl(path)
  try {
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve()
      v.onerror = () => reject(new Error('视频无法解码（建议使用 H.264 编码的 MP4）'))
      setTimeout(() => reject(new Error('读取视频超时')), 20000)
    })
    const duration = v.duration || 0
    await new Promise<void>((resolve) => {
      v.onseeked = () => resolve()
      v.currentTime = Math.min(1, duration / 3)
      setTimeout(resolve, 5000)
    })
    const bmp = await createImageBitmap(v)
    return { bmp, duration }
  } finally {
    v.removeAttribute('src')
    v.load()
  }
}

function canvasOf(w: number, h: number): OffscreenCanvas {
  return new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
}

async function toJpeg(bmp: ImageBitmap, maxSide: number, quality: number): Promise<ArrayBuffer> {
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const c = canvasOf(bmp.width * s, bmp.height * s)
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await c.convertToBlob({ type: 'image/jpeg', quality })
  return blob.arrayBuffer()
}

interface Pixels {
  gray: Float32Array
  w: number
  h: number
}

function grayscale(bmp: ImageBitmap, maxSide: number): Pixels {
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.max(8, Math.round(bmp.width * s))
  const h = Math.max(8, Math.round(bmp.height * s))
  const c = canvasOf(w, h)
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(bmp, 0, 0, w, h)
  const d = g.getImageData(0, 0, w, h).data
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) gray[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255
  return { gray, w, h }
}

/** 拉普拉斯方差（越大越清晰）+ 边缘能量重心（无人脸时的兴趣点） */
function sharpnessAndSaliency(p: Pixels): { sharp: number; cx: number; cy: number } {
  const { gray, w, h } = p
  let sum = 0
  let sum2 = 0
  let n = 0
  let ex = 0
  let ey = 0
  let et = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]
      sum += lap
      sum2 += lap * lap
      n++
      const e = Math.abs(lap)
      ex += e * x
      ey += e * y
      et += e
    }
  }
  const mean = sum / n
  return { sharp: sum2 / n - mean * mean, cx: et ? ex / et / w : 0.5, cy: et ? ey / et / h : 0.45 }
}

function dHash(bmp: ImageBitmap): string {
  const c = canvasOf(9, 8)
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(bmp, 0, 0, 9, 8)
  const d = g.getImageData(0, 0, 9, 8).data
  let bits = ''
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const a = d[(y * 9 + x) * 4] + d[(y * 9 + x) * 4 + 1] + d[(y * 9 + x) * 4 + 2]
      const b = d[(y * 9 + x + 1) * 4] + d[(y * 9 + x + 1) * 4 + 1] + d[(y * 9 + x + 1) * 4 + 2]
      bits += a > b ? '1' : '0'
    }
  }
  let hex = ''
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

export function hamming(a: string, b: string): number {
  let d = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) {
      d += x & 1
      x >>= 1
    }
  }
  return d
}

async function detectFaces(bmp: ImageBitmap): Promise<FaceBox[]> {
  const lm = await getLandmarker()
  if (!lm) return []
  try {
    const s = Math.min(1, 1024 / Math.max(bmp.width, bmp.height))
    const c = canvasOf(bmp.width * s, bmp.height * s)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const res = lm.detect(c as unknown as HTMLCanvasElement)
    return res.faceLandmarks.map((pts, i) => {
      let x0 = 1
      let y0 = 1
      let x1 = 0
      let y1 = 0
      for (const p of pts) {
        x0 = Math.min(x0, p.x)
        y0 = Math.min(y0, p.y)
        x1 = Math.max(x1, p.x)
        y1 = Math.max(y1, p.y)
      }
      const bs = res.faceBlendshapes?.[i]?.categories ?? []
      const blink = (name: string): number => bs.find((c2) => c2.categoryName === name)?.score ?? 0
      const eyesClosed = blink('eyeBlinkLeft') > 0.55 && blink('eyeBlinkRight') > 0.55
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, eyesClosed }
    })
  } catch (e) {
    console.warn('人脸检测失败', e)
    return []
  }
}

export interface ImportProgress {
  done: number
  total: number
  current?: string
}

interface RawResult {
  asset: PhotoAsset
  sharpRaw: number
  brightness: number
  clipHi: number
  clipLo: number
  saliency: { x: number; y: number }
}

async function importOne(path: string, id: string): Promise<RawResult> {
  const name = path.split(/[\\/]/).pop() || path
  const st = await window.mv.stat(path)
  const key = strHash(`${path}|${st.size}|${st.mtimeMs}`).toString(16)
  const isVideo = VIDEO_RE.test(path)
  let blob: Blob | null = null
  let bmp: ImageBitmap
  let duration: number | undefined
  if (isVideo) {
    const f = await videoFrame(path)
    bmp = f.bmp
    duration = f.duration
  } else {
    blob = await (await fetch(fileUrl(path))).blob()
    bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  }
  const width = bmp.width
  const height = bmp.height

  let proxy = await window.mv.cacheExists(`p-${key}.jpg`)
  if (!proxy) proxy = await window.mv.cacheWrite(`p-${key}.jpg`, await toJpeg(bmp, PROXY, 0.9))
  let thumb = await window.mv.cacheExists(`t-${key}.jpg`)
  if (!thumb) thumb = await window.mv.cacheWrite(`t-${key}.jpg`, await toJpeg(bmp, THUMB, 0.82))

  let takenAt: number | undefined
  try {
    if (!blob) throw new Error('视频没有 EXIF')
    const exif = await exifr.parse(blob, ['DateTimeOriginal', 'CreateDate'])
    const d = exif?.DateTimeOriginal ?? exif?.CreateDate
    if (d instanceof Date && !isNaN(d.getTime())) takenAt = d.getTime()
  } catch {
    /* 没有 EXIF */
  }
  if (!takenAt) takenAt = st.birthtimeMs || st.mtimeMs

  const px = grayscale(bmp, 512)
  const { sharp, cx, cy } = sharpnessAndSaliency(px)
  let bsum = 0
  let hi = 0
  let lo = 0
  for (const v of px.gray) {
    bsum += v
    if (v > 0.97) hi++
    if (v < 0.03) lo++
  }
  const total = px.gray.length
  const hash = dHash(bmp)
  const faces = await detectFaces(bmp)
  let mask: { path: string; area: number } | null = null
  if (!isVideo) {
    const cached = await window.mv.cacheExists(`m-${key}.png`)
    mask = cached ? { path: cached, area: 0.2 } : await makeMask(bmp, key)
  }
  bmp.close()

  const ratio = width / height
  const orientation = ratio > 1.08 ? 'landscape' : ratio < 0.92 ? 'portrait' : 'square'
  const asset: PhotoAsset = {
    id,
    path,
    name,
    width,
    height,
    orientation,
    takenAt,
    proxy,
    thumb,
    product: isVideo ? undefined : parseProduct(name),
    media: isVideo ? 'video' : undefined,
    duration,
    mask: mask?.path,
    maskArea: mask?.area ?? 0,
    analysis: { sharpness: 0, brightness: bsum / total, faces, hash, score: 0, focus: { x: 0.5, y: 0.45 }, flags: [] }
  }
  return { asset, sharpRaw: sharp, brightness: bsum / total, clipHi: hi / total, clipLo: lo / total, saliency: { x: cx, y: cy } }
}

/** 根据一批照片的相对清晰度、人脸、曝光等算综合分并标记问题 */
function finalize(results: RawResult[]): PhotoAsset[] {
  const sharps = results.map((r) => r.sharpRaw).sort((a, b) => a - b)
  const median = sharps[Math.floor(sharps.length / 2)] || 1
  const out: PhotoAsset[] = []
  for (const r of results) {
    const a = r.asset.analysis!
    const rel = r.sharpRaw / median
    a.sharpness = Math.round(Math.min(1, rel / 2) * 100) / 100
    const flags: PhotoFlag[] = []
    if (rel < 0.3 && r.sharpRaw < 0.002) flags.push('blur')
    if (a.faces.some((f) => f.eyesClosed)) flags.push('eyesClosed')
    if (r.brightness < 0.16 || r.clipLo > 0.35) flags.push('dark')
    if (r.brightness > 0.86 || r.clipHi > 0.3) flags.push('overexposed')
    // 兴趣点：有人脸取人脸（偏上，眼睛位置），否则取边缘能量重心并向中心收敛
    if (a.faces.length) {
      let wx = 0
      let wy = 0
      let wt = 0
      for (const f of a.faces) {
        const area = f.w * f.h
        wx += (f.x + f.w / 2) * area
        wy += (f.y + f.h * 0.4) * area
        wt += area
      }
      a.focus = { x: wx / wt, y: wy / wt }
    } else {
      a.focus = { x: 0.5 + (r.saliency.x - 0.5) * 0.6, y: 0.45 + (r.saliency.y - 0.5) * 0.6 }
    }
    let score = 55 + a.sharpness * 25
    if (a.faces.length) score += 10
    if (flags.includes('blur')) score -= 35
    if (flags.includes('eyesClosed')) score -= 25
    if (flags.includes('dark') || flags.includes('overexposed')) score -= 12
    a.score = Math.max(0, Math.min(100, Math.round(score)))
    a.flags = flags
    out.push(r.asset)
  }
  // 重复检测：dHash 汉明距离 ≤ 6 视为重复，保留分数最高的一张
  for (let i = 0; i < out.length; i++) {
    for (let j = 0; j < i; j++) {
      const ai = out[i].analysis!
      const aj = out[j].analysis!
      if (ai.dupOf || aj.dupOf) continue
      if (hamming(ai.hash, aj.hash) <= 6) {
        const [keep, drop] = ai.score >= aj.score ? [out[i], out[j]] : [out[j], out[i]]
        drop.analysis!.dupOf = keep.id
        drop.analysis!.flags.push('duplicate')
      }
    }
  }
  return out
}

let idSeq = 0
export const newPhotoId = (): string => 'p' + Date.now().toString(36) + (idSeq++).toString(36)

/** 导入并分析一批照片；existing 用来和已有照片一起做重复检测 */
export async function importPhotos(
  paths: string[],
  onProgress?: (p: ImportProgress) => void,
  existing: PhotoAsset[] = []
): Promise<PhotoAsset[]> {
  const known = new Set(existing.map((p) => p.path))
  const todo = paths.filter((p) => !known.has(p))
  const results: RawResult[] = []
  let done = 0
  const queue = [...todo]
  const worker = async (): Promise<void> => {
    while (queue.length) {
      const p = queue.shift()!
      try {
        results.push(await importOne(p, newPhotoId()))
      } catch (e) {
        console.warn('导入失败', p, e)
      }
      done++
      onProgress?.({ done, total: todo.length, current: p })
    }
  }
  await Promise.all([worker(), worker(), worker()])
  // 保持文件顺序
  const order = new Map(todo.map((p, i) => [p, i]))
  results.sort((a, b) => (order.get(a.asset.path) ?? 0) - (order.get(b.asset.path) ?? 0))
  const fresh = finalize(results)
  // 新照片与已有照片之间也查一次重复
  for (const f of fresh) {
    if (f.analysis!.dupOf) continue
    const twin = existing.find((e) => e.analysis && hamming(e.analysis.hash, f.analysis!.hash) <= 6)
    if (twin) {
      f.analysis!.dupOf = twin.id
      f.analysis!.flags.push('duplicate')
    }
  }
  return fresh
}

export const FLAG_LABEL: Record<PhotoFlag, string> = {
  blur: '模糊',
  eyesClosed: '闭眼',
  duplicate: '重复',
  dark: '过暗',
  overexposed: '过曝'
}

export type { PhotoAnalysis }
