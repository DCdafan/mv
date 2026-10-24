import type { PhotoAsset } from '@shared/types'
import { createTexture, type GL } from './gl'

export interface TexInfo {
  tex: WebGLTexture
  w: number
  h: number
}

export function fileUrl(path: string): string {
  // 内置素材用相对地址，本地文件走自定义协议
  if (path.startsWith('./') || path.includes('://')) return path
  return 'mvfile://local/' + encodeURIComponent(path)
}

export interface Entry {
  photo?: TexInfo
  blur?: TexInfo
  mask?: TexInfo
  video?: HTMLVideoElement
  loading?: Promise<void>
  failed?: boolean
  used: number
}

/** 照片 / 视频纹理：按需异步加载，LRU 淘汰；附带模糊背景版和主体蒙版 */
export class PhotoTextures {
  private map = new Map<string, Entry>()
  private tick = 0
  onLoaded?: () => void

  constructor(private gl: GL, private maxSize: number, private useOriginal: boolean, private limit = 60) {}

  private source(p: PhotoAsset): string {
    if (p.media === 'video') return p.path
    if (!this.useOriginal && p.proxy) return p.proxy
    return p.path
  }

  get(p: PhotoAsset): Entry | undefined {
    const e = this.map.get(p.id)
    if (e) e.used = ++this.tick
    return e
  }

  request(p: PhotoAsset): Promise<void> {
    let e = this.map.get(p.id)
    if (e && (e.photo || e.failed)) return Promise.resolve()
    if (e?.loading) return e.loading
    e = { used: ++this.tick }
    this.map.set(p.id, e)
    const entry = e
    const job = p.media === 'video' ? this.loadVideo(p, entry) : this.load(p).then((r) => Object.assign(entry, r))
    entry.loading = job
      .then(() => {
        this.evict()
        this.onLoaded?.()
      })
      .catch((err) => {
        console.warn('素材加载失败', p.path, err)
        entry.failed = true
      })
      .finally(() => {
        entry.loading = undefined
      })
    return entry.loading
  }

  private blurOf(src: CanvasImageSource, w: number, h: number): TexInfo {
    const bw = 96
    const bh = Math.max(1, Math.round((bw * h) / w))
    const c = document.createElement('canvas')
    c.width = bw
    c.height = bh
    const ctx = c.getContext('2d')!
    ctx.filter = 'blur(5px)'
    ctx.drawImage(src, -8, -8, bw + 16, bh + 16)
    return { tex: createTexture(this.gl, c, false), w: bw, h: bh }
  }

  private async bitmap(path: string, maxSize: number): Promise<ImageBitmap> {
    const res = await fetch(fileUrl(path))
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const blob = await res.blob()
    const probe = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxSize / Math.max(probe.width, probe.height))
    if (scale >= 1) return probe
    const w = Math.round(probe.width * scale)
    const h = Math.round(probe.height * scale)
    probe.close()
    return createImageBitmap(blob, { imageOrientation: 'from-image', resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
  }

  private async load(p: PhotoAsset): Promise<{ photo: TexInfo; blur: TexInfo; mask?: TexInfo }> {
    const bmp = await this.bitmap(this.source(p), this.maxSize)
    const gl = this.gl
    const photo = { tex: createTexture(gl, bmp, true), w: bmp.width, h: bmp.height }
    const blur = this.blurOf(bmp, bmp.width, bmp.height)
    bmp.close()
    let mask: TexInfo | undefined
    if (p.mask) {
      try {
        const mb = await this.bitmap(p.mask, 1024)
        mask = { tex: createTexture(gl, mb, false), w: mb.width, h: mb.height }
        mb.close()
      } catch {
        /* 没有蒙版就不做视差 */
      }
    }
    return { photo, blur, mask }
  }

  private async loadVideo(p: PhotoAsset, entry: Entry): Promise<void> {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.crossOrigin = 'anonymous'
    v.src = fileUrl(p.path)
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve()
      v.onerror = () => reject(new Error('视频无法解码'))
    })
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    entry.video = v
    entry.photo = { tex, w: v.videoWidth, h: v.videoHeight }
    this.uploadVideo(entry)
    entry.blur = this.blurOf(v, v.videoWidth, v.videoHeight)
  }

  /** 把视频当前帧上传到纹理 */
  uploadVideo(e: Entry): void {
    const v = e.video
    if (!v || !e.photo || v.readyState < 2) return
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, e.photo.tex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  }

  /** 精确定位到某一时刻（导出用），等待解码完成 */
  async seekExact(p: PhotoAsset, time: number, tolerance: number): Promise<void> {
    await this.request(p)
    const e = this.map.get(p.id)
    const v = e?.video
    if (!v) return
    const t = Math.max(0, Math.min(time, (v.duration || time) - 0.04))
    if (Math.abs(v.currentTime - t) <= tolerance && v.readyState >= 2) return
    await new Promise<void>((resolve) => {
      const done = (): void => {
        v.removeEventListener('seeked', done)
        resolve()
      }
      v.addEventListener('seeked', done)
      v.currentTime = t
      setTimeout(done, 3000)
    })
  }

  private release(e: Entry): void {
    if (e.photo) this.gl.deleteTexture(e.photo.tex)
    if (e.blur) this.gl.deleteTexture(e.blur.tex)
    if (e.mask) this.gl.deleteTexture(e.mask.tex)
    if (e.video) {
      e.video.pause()
      e.video.removeAttribute('src')
      e.video.load()
    }
  }

  private evict(): void {
    if (this.map.size <= this.limit) return
    const entries = [...this.map.entries()].filter(([, e]) => e.photo).sort((a, b) => a[1].used - b[1].used)
    const n = this.map.size - this.limit
    for (let i = 0; i < n && i < entries.length; i++) {
      const [id, e] = entries[i]
      this.release(e)
      this.map.delete(id)
    }
  }

  /** 暂停所有视频（预览停止播放时） */
  pauseAll(): void {
    for (const e of this.map.values()) e.video?.pause()
  }

  dispose(): void {
    for (const e of this.map.values()) this.release(e)
    this.map.clear()
  }
}

/** 品牌 Logo 等单张图片纹理 */
export async function loadImageTexture(gl: GL, path: string, maxSize = 1024): Promise<TexInfo> {
  const res = await fetch(fileUrl(path))
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const bmp = await createImageBitmap(await res.blob())
  const s = Math.min(1, maxSize / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bmp.width * s))
  c.height = Math.max(1, Math.round(bmp.height * s))
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return { tex: createTexture(gl, c, true), w: c.width, h: c.height }
}

/** 文字、装饰等由画布生成的纹理，按 key 缓存 */
export class CanvasTextures {
  private map = new Map<string, TexInfo & { used: number }>()
  private tick = 0
  constructor(private gl: GL, private limit = 300) {}

  get(key: string, make: () => HTMLCanvasElement): TexInfo {
    const hit = this.map.get(key)
    if (hit) {
      hit.used = ++this.tick
      return hit
    }
    const c = make()
    const info = { tex: createTexture(this.gl, c, true), w: c.width, h: c.height, used: ++this.tick }
    this.map.set(key, info)
    if (this.map.size > this.limit) {
      const old = [...this.map.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, this.map.size - this.limit)
      for (const [k, v] of old) {
        this.gl.deleteTexture(v.tex)
        this.map.delete(k)
      }
    }
    return info
  }

  clear(): void {
    for (const v of this.map.values()) this.gl.deleteTexture(v.tex)
    this.map.clear()
  }
}
