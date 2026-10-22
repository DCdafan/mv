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

interface Entry {
  photo?: TexInfo
  blur?: TexInfo
  loading?: Promise<void>
  failed?: boolean
  used: number
}

/** 照片纹理：按需异步加载，LRU 淘汰，附带一张模糊背景版 */
export class PhotoTextures {
  private map = new Map<string, Entry>()
  private tick = 0
  onLoaded?: () => void

  constructor(private gl: GL, private maxSize: number, private useOriginal: boolean, private limit = 60) {}

  private source(p: PhotoAsset): string {
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
    entry.loading = this.load(p)
      .then(({ photo, blur }) => {
        entry.photo = photo
        entry.blur = blur
        this.evict()
        this.onLoaded?.()
      })
      .catch((err) => {
        console.warn('照片加载失败', p.path, err)
        entry.failed = true
      })
      .finally(() => {
        entry.loading = undefined
      })
    return entry.loading
  }

  private async load(p: PhotoAsset): Promise<{ photo: TexInfo; blur: TexInfo }> {
    const res = await fetch(fileUrl(this.source(p)))
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const blob = await res.blob()
    const probe = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    let w = probe.width
    let h = probe.height
    let bmp: ImageBitmap = probe
    const scale = Math.min(1, this.maxSize / Math.max(w, h))
    if (scale < 1) {
      w = Math.round(w * scale)
      h = Math.round(h * scale)
      bmp = await createImageBitmap(blob, { imageOrientation: 'from-image', resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
      probe.close()
    }
    const gl = this.gl
    const photo = { tex: createTexture(gl, bmp, true), w, h }
    // 模糊背景：缩到很小再模糊，放大后天然柔和
    const bw = 96
    const bh = Math.max(1, Math.round((bw * h) / w))
    const c = document.createElement('canvas')
    c.width = bw
    c.height = bh
    const ctx = c.getContext('2d')!
    ctx.filter = 'blur(5px)'
    ctx.drawImage(bmp, -8, -8, bw + 16, bh + 16)
    const blur = { tex: createTexture(gl, c, false), w: bw, h: bh }
    bmp.close()
    return { photo, blur }
  }

  private evict(): void {
    if (this.map.size <= this.limit) return
    const entries = [...this.map.entries()].filter(([, e]) => e.photo).sort((a, b) => a[1].used - b[1].used)
    const n = this.map.size - this.limit
    for (let i = 0; i < n && i < entries.length; i++) {
      const [id, e] = entries[i]
      this.gl.deleteTexture(e.photo!.tex)
      if (e.blur) this.gl.deleteTexture(e.blur.tex)
      this.map.delete(id)
    }
  }

  dispose(): void {
    for (const e of this.map.values()) {
      if (e.photo) this.gl.deleteTexture(e.photo.tex)
      if (e.blur) this.gl.deleteTexture(e.blur.tex)
    }
    this.map.clear()
  }
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
