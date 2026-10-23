// 可复用的版式工厂。每个模板用这些工厂 + 自己的配色、字体、装饰组合出整套版式。
import type {
  AnimSpec,
  BuildCtx,
  Layer,
  MaskType,
  PhotoLayer,
  Rect,
  SceneStyle,
  SlotSpec,
  TextLayer,
  TextStyle,
  CharAnim,
  FontKey,
  BgFill
} from '../engine/types'

// ---------- 坐标工具 ----------

export const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 }
export const shortSide = (c: BuildCtx): number => Math.min(c.W, c.H)
/** 像素矩形 → 归一化矩形 */
export const px = (c: BuildCtx, x: number, y: number, w: number, h: number): Rect => ({ x: x / c.W, y: y / c.H, w: w / c.W, h: h / c.H })
/** 以中心点（像素）定义矩形 */
export const pxc = (c: BuildCtx, cx: number, cy: number, w: number, h: number): Rect => px(c, cx - w / 2, cy - h / 2, w, h)
export const kind = (c: BuildCtx): 'wide' | 'tall' | 'square' => (c.ar > 1.2 ? 'wide' : c.ar < 0.85 ? 'tall' : 'square')
/** 照片框宽高比（按实际照片方向，没有照片时按默认） */
const photoAr = (c: BuildCtx, slot: number, fallback: 'landscape' | 'portrait'): number => {
  const o = c.orient[slot] ?? fallback
  return o === 'landscape' ? 3 / 2 : o === 'portrait' ? 2 / 3 : 1
}
/** 在 maxW x maxH 内按宽高比 ar 放最大的框 */
export const fit = (maxW: number, maxH: number, ar: number): [number, number] => (maxW / maxH > ar ? [maxH * ar, maxH] : [maxW, maxW / ar])

export const stagger = (base: AnimSpec, i: number, step = 0.18): AnimSpec => ({ ...base, delay: (base.delay ?? 0) + i * step })

// ---------- 通用选项 ----------

export interface FrameOpt {
  border?: { width: number; color: string }
  radius?: number
  shadow?: PhotoLayer['shadow']
  mask?: MaskType
}

export interface StyleOpt extends FrameOpt {
  id: string
  name?: string
  weight?: number
  energy?: [number, number]
  anim?: AnimSpec
  caption?: TextStyle | null
  decor?: (c: BuildCtx) => Layer[]
  bg?: BgFill
}

export const photo = (slot: number, rect: Rect, f: FrameOpt = {}, extra: Partial<PhotoLayer> = {}): PhotoLayer => ({
  type: 'photo',
  slot,
  rect,
  motion: 'auto',
  border: f.border,
  radius: f.radius,
  shadow: f.shadow,
  mask: f.mask,
  ...extra
})

export const text = (key: string | undefined, value: string, rect: Rect, style: TextStyle, anim?: AnimSpec, extra: Partial<TextLayer> = {}): TextLayer => ({
  type: 'text',
  key,
  text: value,
  rect,
  style,
  in: anim,
  ...extra
})

export const bgLayer = (fill: BgFill = { kind: 'template' }): Layer => ({ type: 'bg', fill, rect: FULL })

export function ts(font: FontKey, size: number, color: string, more: Partial<TextStyle> = {}): TextStyle {
  return { font, size, color, ...more }
}

const withDecor = (c: BuildCtx, o: StyleOpt, layers: Layer[]): Layer[] => (o.decor ? [...layers, ...o.decor(c)] : layers)

// ---------- 单张照片 ----------

/** 满屏照片 + 推拉摇移，可选底部字幕 */
export function fullscreen(o: StyleOpt): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '满屏',
    slots: ['match'],
    weight: o.weight ?? 3,
    energy: o.energy ?? [0, 1],
    durationFactor: 1,
    captionKey: !!o.caption,
    build: (c) => {
      const S = shortSide(c)
      const layers: Layer[] = [photo(0, FULL, {}, { motionStrength: 1.1 })]
      if (o.caption) {
        layers.push({ type: 'shape', shape: 'rect', rect: px(c, 0, c.H * 0.68, c.W, c.H * 0.32), color: 'rgba(0,0,0,0)', color2: 'rgba(0,0,0,0.45)', gradientAngle: 90 })
        layers.push(text('caption', '', px(c, S * 0.08, c.H - S * 0.2, c.W - S * 0.16, S * 0.12), o.caption, { type: 'slideUp', delay: 0.5, duration: 0.9 }))
      }
      return withDecor(c, o, layers)
    }
  }
}

/** 模糊背景 + 居中相框，适合方向与画布不一致的照片 */
export function blurFrame(o: StyleOpt & { side?: 'center' | 'left' | 'right'; dim?: number }): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '模糊背景相框',
    slots: ['cross'],
    weight: o.weight ?? 3,
    energy: o.energy ?? [0, 1],
    captionKey: !!o.caption && o.side !== 'center',
    build: (c) => {
      const S = shortSide(c)
      const k = kind(c)
      const ar = photoAr(c, 0, k === 'wide' ? 'portrait' : 'landscape')
      const side = o.side ?? 'center'
      const [w, h] = fit(c.W * (side === 'center' || k === 'tall' ? 0.86 : 0.5), c.H * (side !== 'center' && k === 'tall' ? 0.6 : 0.86), ar)
      let cx = c.W / 2
      let cy = c.H / 2
      if (side !== 'center') {
        if (k === 'tall') cy = c.H * 0.42
        else cx = side === 'left' ? c.W * 0.32 : c.W * 0.68
      }
      const layers: Layer[] = [
        bgLayer(o.bg ?? { kind: 'blurPhoto', slot: 0, dim: o.dim ?? 0.3 }),
        photo(0, pxc(c, cx, cy, w, h), o, { in: o.anim ?? { type: 'zoomIn', distance: 0.92, duration: 0.9 }, motionStrength: 0.6 })
      ]
      if (side !== 'center' && o.caption) {
        const r =
          k === 'tall'
            ? px(c, S * 0.1, cy + h / 2 + S * 0.06, c.W - S * 0.2, c.H - (cy + h / 2) - S * 0.12)
            : side === 'left'
              ? px(c, cx + w / 2 + S * 0.08, c.H * 0.25, c.W - (cx + w / 2) - S * 0.16, c.H * 0.5)
              : px(c, S * 0.08, c.H * 0.25, cx - w / 2 - S * 0.16, c.H * 0.5)
        layers.push(text('caption', '', r, o.caption, { type: 'reveal', delay: Math.min(0.6, c.dur * 0.12), duration: Math.min(1.4, c.dur * 0.35) }))
      }
      return withDecor(c, o, layers)
    }
  }
}

/** 形状相框：圆形 / 爱心 / 拱门 / 六边形 */
export function shapeFrame(o: StyleOpt & { shape: MaskType; ring?: { color: string; width: number } }): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '形状相框',
    slots: ['any'],
    weight: o.weight ?? 1.5,
    energy: o.energy ?? [0, 0.8],
    captionKey: !!o.caption,
    build: (c) => {
      const S = shortSide(c)
      const k = kind(c)
      let size = S * 0.74
      let cx = c.W / 2
      let cy = c.H / 2
      const shapeAr = o.shape === 'arch' ? 0.75 : o.shape === 'heart' ? 1.1 : 1
      let w = o.shape === 'arch' ? size * shapeAr : size * (o.shape === 'heart' ? 1.1 : 1)
      let h = size
      if (k === 'wide' && o.caption) cx = c.W * 0.36
      if (k === 'tall' && o.caption) cy = c.H * 0.4
      if (k === 'tall') {
        size = c.W * 0.78
        w = o.shape === 'arch' ? size : size
        h = o.shape === 'arch' ? size / 0.75 : size
      }
      const layers: Layer[] = [bgLayer(o.bg)]
      if (o.ring) {
        layers.push({
          type: 'shape',
          shape: o.shape,
          rect: pxc(c, cx, cy, w + S * 0.06, h + S * 0.06),
          color: o.ring.color,
          stroke: o.ring.width,
          radius: 0,
          in: { type: 'zoomIn', duration: 1.1, delay: 0.1 },
          loop: { type: 'pulse', amp: 0.01, period: 3 }
        })
      }
      layers.push(photo(0, pxc(c, cx, cy, w, h), { ...o, mask: o.shape }, { in: o.anim ?? { type: 'zoomIn', distance: 0.8, duration: 0.9 }, motionStrength: 0.7 }))
      if (o.caption) {
        const r = k === 'tall' ? px(c, S * 0.08, cy + h / 2 + S * 0.06, c.W - S * 0.16, S * 0.3) : px(c, cx + w / 2 + S * 0.06, c.H * 0.3, c.W - cx - w / 2 - S * 0.14, c.H * 0.4)
        layers.push(text('caption', '', r, o.caption, { type: 'reveal', delay: Math.min(0.7, c.dur * 0.12), duration: Math.min(1.4, c.dur * 0.35) }))
      }
      return withDecor(c, o, layers)
    }
  }
}

/** 拍立得：白色卡纸 + 照片 + 手写字幕 */
export function polaroid(o: StyleOpt & { card?: string; tilt?: number; tape?: string }): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '拍立得',
    slots: ['any'],
    weight: o.weight ?? 2,
    energy: o.energy ?? [0, 0.85],
    captionKey: true,
    build: (c) => {
      const S = shortSide(c)
      const ar = photoAr(c, 0, 'portrait')
      const k = kind(c)
      const maxH = (k === 'tall' ? c.H * 0.6 : c.H * 0.72)
      const [pw, ph] = fit(k === 'tall' ? c.W * 0.78 : c.W * 0.6, maxH, ar)
      const m = Math.max(pw, ph) * 0.05
      const cw = pw + m * 2
      const ch = ph + m * 2 + S * 0.12
      const cx = c.W / 2 + (c.rand() - 0.5) * S * 0.08
      const cy = c.H / 2 + S * 0.01
      const rot = (o.tilt ?? 4) * (c.rand() < 0.5 ? -1 : 1) * (0.6 + c.rand() * 0.4)
      const anim: AnimSpec = o.anim ?? { type: 'drop', duration: 1, distance: 0.25 }
      // 卡片和照片一起旋转：照片中心相对卡片中心偏上，按旋转角换算位置
      const rad = (rot * Math.PI) / 180
      const off = -(ch / 2 - m - ph / 2)
      const pcx = cx - Math.sin(rad) * off
      const pcy = cy + Math.cos(rad) * off
      const capOff = ch / 2 - S * 0.065
      const layers: Layer[] = [
        bgLayer(o.bg),
        { type: 'shape', shape: 'rect', rect: pxc(c, cx, cy, cw, ch), color: o.card ?? '#fffdf8', rotation: rot, shadow: { blur: 0.025, alpha: 0.35, dy: 0.012 }, in: anim },
        photo(0, pxc(c, pcx, pcy, pw, ph), {}, { rotation: rot, in: anim, motionStrength: 0.6 })
      ]
      if (o.caption) {
        layers.push(
          text('caption', '', pxc(c, cx - Math.sin(rad) * capOff, cy + Math.cos(rad) * capOff, cw * 0.9, S * 0.09), o.caption, { ...anim, delay: (anim.delay ?? 0) + 0.05 }, {
            rotation: rot
          })
        )
      }
      if (o.tape) {
        layers.push({ type: 'decor', decor: 'tape', color: o.tape, rect: pxc(c, cx + Math.sin(rad) * (ch / 2), cy - Math.cos(rad) * (ch / 2) - S * 0.005, S * 0.22, 0), rotation: rot - 4, in: { type: 'fade', delay: 0.8, duration: 0.4 } })
        layers[layers.length - 1].rect.y -= layers[layers.length - 1].rect.w * (c.W / c.H) * 0.125
      }
      return withDecor(c, o, layers)
    }
  }
}

/** 放大弹出：模糊背景 + 带边框照片弹出 */
export function zoomPop(o: StyleOpt): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '弹出相框',
    slots: ['any'],
    weight: o.weight ?? 1.5,
    energy: o.energy ?? [0.4, 1],
    build: (c) => {
      const ar = photoAr(c, 0, 'landscape')
      const [w, h] = fit(c.W * 0.8, c.H * 0.8, ar)
      return withDecor(c, o, [
        bgLayer(o.bg ?? { kind: 'blurPhoto', slot: 0, dim: 0.25 }),
        photo(0, pxc(c, c.W / 2, c.H / 2, w, h), o, { in: o.anim ?? { type: 'pop', duration: 0.7 }, motionStrength: 0.5 })
      ])
    }
  }
}

/** 杂志版：照片占大半，另一侧放大字号字幕 */
export function magazine(o: StyleOpt & { panel?: string; accent?: string; flip?: boolean }): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '杂志排版',
    slots: ['any'],
    weight: o.weight ?? 1.5,
    energy: o.energy ?? [0, 0.8],
    captionKey: true,
    build: (c) => {
      const S = shortSide(c)
      const k = kind(c)
      const flip = o.flip ?? c.rand() < 0.5
      const layers: Layer[] = [bgLayer(o.panel ? { kind: 'color', color: o.panel } : o.bg)]
      let pr: Rect
      let tr: Rect
      if (k === 'tall') {
        pr = px(c, 0, 0, c.W, c.H * 0.64)
        tr = px(c, S * 0.1, c.H * 0.7, c.W - S * 0.2, c.H * 0.22)
      } else {
        const pw = c.W * (k === 'wide' ? 0.58 : 0.6)
        pr = flip ? px(c, c.W - pw, 0, pw, c.H) : px(c, 0, 0, pw, c.H)
        tr = flip ? px(c, S * 0.08, c.H * 0.3, c.W - pw - S * 0.16, c.H * 0.4) : px(c, pw + S * 0.08, c.H * 0.3, c.W - pw - S * 0.16, c.H * 0.4)
      }
      layers.push(photo(0, pr, {}, { in: { type: k === 'tall' ? 'slideDown' : flip ? 'slideLeft' : 'slideRight', distance: 0.08, duration: 0.9 }, motionStrength: 0.8 }))
      if (o.accent) {
        const lr = k === 'tall' ? px(c, tr.x * c.W, tr.y * c.H - S * 0.03, S * 0.12, S * 0.006) : px(c, tr.x * c.W, tr.y * c.H - S * 0.04, S * 0.14, S * 0.008)
        layers.push({ type: 'shape', shape: 'rect', rect: lr, color: o.accent, in: { type: 'spread', delay: 0.5, duration: 0.8 } })
      }
      if (o.caption) layers.push(text('caption', '', tr, { ...o.caption, align: k === 'tall' ? 'center' : 'left' }, { type: 'slideUp', delay: 0.5, duration: 1 }))
      return withDecor(c, o, layers)
    }
  }
}

/** 同一张照片切成几条，错落滑入 */
export function panes(o: StyleOpt & { count?: number; gap?: number }): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '分屏切片',
    slots: ['match'],
    weight: o.weight ?? 1.2,
    energy: o.energy ?? [0.45, 1],
    build: (c) => {
      const S = shortSide(c)
      const n = o.count ?? 3
      const g = (o.gap ?? 0.018) * S
      const k = kind(c)
      const m = S * 0.05
      const virt = px(c, m, m, c.W - m * 2, c.H - m * 2)
      const layers: Layer[] = [bgLayer(o.bg)]
      for (let i = 0; i < n; i++) {
        let r: Rect
        if (k === 'tall') {
          const hh = (c.H - m * 2 - g * (n - 1)) / n
          r = px(c, m, m + i * (hh + g), c.W - m * 2, hh)
        } else {
          const ww = (c.W - m * 2 - g * (n - 1)) / n
          r = px(c, m + i * (ww + g), m, ww, c.H - m * 2)
        }
        const a: AnimSpec = k === 'tall' ? { type: i % 2 ? 'flyLeft' : 'flyRight', duration: 0.8, delay: i * 0.12 } : { type: i % 2 ? 'flyUp' : 'flyDown', duration: 0.8, delay: i * 0.12 }
        layers.push(photo(0, r, o, { virtual: virt, in: a, motionStrength: 0.9 }))
      }
      return withDecor(c, o, layers)
    }
  }
}

// ---------- 多张照片 ----------

/** 两张并排（横屏放两张竖图，竖屏上下两张横图） */
export function duo(o: StyleOpt): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '双图并排',
    slots: ['cross', 'cross'],
    weight: o.weight ?? 3,
    energy: o.energy ?? [0, 1],
    durationFactor: 0.8,
    build: (c) => {
      const S = shortSide(c)
      const k = kind(c)
      const g = S * 0.035
      const m = S * 0.07
      const layers: Layer[] = [bgLayer(o.bg)]
      const base = o.anim ?? { type: k === 'tall' ? 'slideLeft' : 'slideUp', duration: 0.8, distance: 0.1 }
      for (let i = 0; i < 2; i++) {
        let r: Rect
        if (k === 'tall') {
          const [w, h] = fit(c.W - m * 2, (c.H - m * 2 - g) / 2, 3 / 2)
          r = pxc(c, c.W / 2, c.H / 2 + (i ? 1 : -1) * (h / 2 + g / 2), w, h)
        } else {
          const [w, h] = fit((c.W - m * 2 - g) / 2, c.H - m * 2, 2 / 3)
          r = pxc(c, c.W / 2 + (i ? 1 : -1) * (w / 2 + g / 2), c.H / 2, w, h)
        }
        layers.push(photo(i, r, o, { in: stagger(base, i, 0.2), motionStrength: 0.8 }))
      }
      return withDecor(c, o, layers)
    }
  }
}

/** 三联：三张竖图（横屏）/ 三张横图（竖屏） */
export function trio(o: StyleOpt): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '三联排',
    slots: ['cross', 'cross', 'cross'],
    weight: o.weight ?? 2,
    energy: o.energy ?? [0.35, 1],
    durationFactor: 0.7,
    build: (c) => {
      const S = shortSide(c)
      const k = kind(c)
      const g = S * 0.025
      const m = S * 0.06
      const layers: Layer[] = [bgLayer(o.bg)]
      const base = o.anim ?? { type: k === 'tall' ? 'flyLeft' : 'flyUp', duration: 0.75 }
      for (let i = 0; i < 3; i++) {
        let r: Rect
        if (k === 'tall') {
          const hh = (c.H - m * 2 - g * 2) / 3
          const [w, h] = fit(c.W - m * 2, hh, 3 / 2)
          r = pxc(c, c.W / 2, m + hh / 2 + i * (hh + g), w, h)
        } else {
          const ww = (c.W - m * 2 - g * 2) / 3
          const [w, h] = fit(ww, c.H - m * 2, 2 / 3)
          r = pxc(c, m + ww / 2 + i * (ww + g), c.H / 2, w, h)
        }
        layers.push(photo(i, r, o, { in: stagger(base, i, 0.15), motionStrength: 0.8 }))
      }
      return withDecor(c, o, layers)
    }
  }
}

/** 一大两小 */
export function heroTwo(o: StyleOpt): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '一大两小',
    slots: ['match', 'any', 'any'],
    weight: o.weight ?? 1.8,
    energy: o.energy ?? [0.3, 1],
    durationFactor: 0.75,
    build: (c) => {
      const S = shortSide(c)
      const k = kind(c)
      const g = S * 0.025
      const m = S * 0.05
      const layers: Layer[] = [bgLayer(o.bg)]
      if (k === 'tall') {
        const bigH = (c.H - m * 2 - g) * 0.62
        const smallH = c.H - m * 2 - g - bigH
        const sw = (c.W - m * 2 - g) / 2
        layers.push(photo(0, px(c, m, m, c.W - m * 2, bigH), o, { in: { type: 'slideDown', duration: 0.8 } }))
        layers.push(photo(1, px(c, m, m + bigH + g, sw, smallH), o, { in: { type: 'flyLeft', duration: 0.7, delay: 0.25 } }))
        layers.push(photo(2, px(c, m + sw + g, m + bigH + g, sw, smallH), o, { in: { type: 'flyRight', duration: 0.7, delay: 0.4 } }))
      } else {
        const bigW = (c.W - m * 2 - g) * 0.64
        const smallW = c.W - m * 2 - g - bigW
        const sh = (c.H - m * 2 - g) / 2
        layers.push(photo(0, px(c, m, m, bigW, c.H - m * 2), o, { in: { type: 'slideRight', duration: 0.8 } }))
        layers.push(photo(1, px(c, m + bigW + g, m, smallW, sh), o, { in: { type: 'flyDown', duration: 0.7, delay: 0.25 } }))
        layers.push(photo(2, px(c, m + bigW + g, m + sh + g, smallW, sh), o, { in: { type: 'flyUp', duration: 0.7, delay: 0.4 } }))
      }
      return withDecor(c, o, layers)
    }
  }
}

/** 四宫格 */
export function grid4(o: StyleOpt): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '四宫格',
    slots: ['any', 'any', 'any', 'any'],
    weight: o.weight ?? 1.2,
    energy: o.energy ?? [0.5, 1],
    durationFactor: 0.6,
    build: (c) => {
      const S = shortSide(c)
      const g = S * 0.022
      const m = S * 0.05
      const w = (c.W - m * 2 - g) / 2
      const h = (c.H - m * 2 - g) / 2
      const base = o.anim ?? { type: 'pop', duration: 0.55 }
      const layers: Layer[] = [bgLayer(o.bg)]
      for (let i = 0; i < 4; i++) {
        const col = i % 2
        const row = Math.floor(i / 2)
        layers.push(photo(i, px(c, m + col * (w + g), m + row * (h + g), w, h), o, { in: stagger(base, i, 0.14), motionStrength: 0.6 }))
      }
      return withDecor(c, o, layers)
    }
  }
}

/** 照片一张张丢到桌面上叠起来 */
export function stack(o: StyleOpt & { card?: string }): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '照片堆叠',
    slots: ['any', 'any', 'any'],
    weight: o.weight ?? 1.5,
    energy: o.energy ?? [0.2, 0.9],
    durationFactor: 0.8,
    build: (c) => {
      const S = shortSide(c)
      const k = kind(c)
      const layers: Layer[] = [bgLayer(o.bg)]
      const step = Math.min(0.9, c.dur / 4)
      for (let i = 0; i < 3; i++) {
        const ar = photoAr(c, i, 'landscape')
        const [w, h] = fit(k === 'tall' ? c.W * 0.78 : c.W * 0.5, k === 'tall' ? c.H * 0.36 : c.H * 0.62, ar)
        const spread = k === 'tall' ? [0, -0.22, 0.22] : [-0.17, 0.17, 0]
        const cx = k === 'tall' ? c.W / 2 + (c.rand() - 0.5) * S * 0.12 : c.W / 2 + spread[i] * c.W
        const cy = k === 'tall' ? c.H / 2 + spread[i] * c.H : c.H / 2 + (c.rand() - 0.5) * S * 0.12
        const rot = (c.rand() - 0.5) * 16
        const bw = S * 0.016
        const a: AnimSpec = { type: 'rotateIn', delay: i * step, duration: 0.6, distance: (c.rand() - 0.5) * 1.2 }
        layers.push({ type: 'shape', shape: 'rect', rect: pxc(c, cx, cy, w + bw * 2, h + bw * 2), color: o.card ?? '#ffffff', rotation: rot, shadow: { blur: 0.02, alpha: 0.35, dy: 0.01 }, in: a })
        layers.push(photo(i, pxc(c, cx, cy, w, h), {}, { rotation: rot, in: a, motionStrength: 0.5 }))
      }
      return withDecor(c, o, layers)
    }
  }
}

/** 两张拍立得交错 */
export function polaroidPair(o: StyleOpt & { card?: string }): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '拍立得双拼',
    slots: ['cross', 'cross'],
    weight: o.weight ?? 1.5,
    energy: o.energy ?? [0.1, 0.9],
    durationFactor: 0.85,
    build: (c) => {
      const S = shortSide(c)
      const k = kind(c)
      const layers: Layer[] = [bgLayer(o.bg)]
      for (let i = 0; i < 2; i++) {
        const ar = photoAr(c, i, k === 'tall' ? 'landscape' : 'portrait')
        const [pw, ph] = fit(k === 'tall' ? c.W * 0.72 : c.W * 0.32, k === 'tall' ? c.H * 0.32 : c.H * 0.66, ar)
        const mm = Math.max(pw, ph) * 0.05
        const cw = pw + mm * 2
        const ch = ph + mm * 2 + S * 0.06
        const cx = k === 'tall' ? c.W / 2 + (i ? 1 : -1) * S * 0.05 : c.W / 2 + (i ? 1 : -1) * cw * 0.55
        const cy = k === 'tall' ? c.H / 2 + (i ? 1 : -1) * ch * 0.55 : c.H / 2 + (i ? 1 : -1) * S * 0.03
        const rot = (i ? 1 : -1) * (3 + c.rand() * 4)
        const rad = (rot * Math.PI) / 180
        const off = -(ch / 2 - mm - ph / 2)
        const a: AnimSpec = { type: i ? 'flyRight' : 'flyLeft', duration: 0.9, delay: i * 0.25, distance: 0.8 }
        layers.push({ type: 'shape', shape: 'rect', rect: pxc(c, cx, cy, cw, ch), color: o.card ?? '#fffdf8', rotation: rot, shadow: { blur: 0.02, alpha: 0.3, dy: 0.01 }, in: a })
        layers.push(photo(i, pxc(c, cx - Math.sin(rad) * off, cy + Math.cos(rad) * off, pw, ph), {}, { rotation: rot, in: a, motionStrength: 0.5 }))
      }
      return withDecor(c, o, layers)
    }
  }
}

/** 胶片条：一排照片放在胶片上缓慢平移 */
export function filmStrip(o: StyleOpt & { film?: string; holes?: string }): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '胶片条',
    slots: ['any', 'any', 'any'],
    weight: o.weight ?? 1.2,
    energy: o.energy ?? [0.2, 0.9],
    durationFactor: 0.8,
    build: (c) => {
      const S = shortSide(c)
      const k = kind(c)
      const layers: Layer[] = [bgLayer(o.bg)]
      const film = o.film ?? '#141414'
      const holes = o.holes ?? '#f2efe8'
      const drift: AnimSpec = { type: k === 'tall' ? 'slideUp' : 'slideLeft', duration: c.dur + 1, distance: 0.12, ease: 'linear' }
      if (k === 'tall') {
        const bw = c.W * 0.7
        const fh = bw * 0.62
        const g = S * 0.03
        const total = fh * 3 + g * 4
        const y0 = (c.H - total) / 2
        // 竖向胶片：先按横向画，再整体旋转 90°
        layers.push({ type: 'bg', fill: { kind: 'pattern', pattern: 'film', color: film, color2: holes }, rect: pxc(c, c.W / 2, c.H / 2, total + S * 0.4, bw + S * 0.18), rotation: 90, in: { type: 'fade', duration: 0.6 } })
        for (let i = 0; i < 3; i++) layers.push(photo(i, px(c, (c.W - bw) / 2, y0 + g + i * (fh + g), bw, fh), {}, { in: stagger({ type: 'fade', duration: 0.6 }, i, 0.2), motionStrength: 0.4 }))
      } else {
        const bh = c.H * 0.62
        const fw = bh * (k === 'wide' ? 1.45 : 1.1)
        const g = S * 0.03
        const total = fw * 3 + g * 4
        const x0 = (c.W - total) / 2 + total * 0.06
        layers.push({ type: 'bg', fill: { kind: 'pattern', pattern: 'film', color: film, color2: holes }, rect: px(c, x0 - S * 0.3, (c.H - bh) / 2 - S * 0.08, total + S * 0.6, bh + S * 0.16), in: drift })
        for (let i = 0; i < 3; i++) layers.push(photo(i, px(c, x0 + g + i * (fw + g), (c.H - bh) / 2, fw, bh), {}, { in: { ...drift }, motionStrength: 0.4 }))
      }
      return withDecor(c, o, layers)
    }
  }
}

/** 半图半色块 + 字幕 */
export function splitPanel(o: StyleOpt & { panel: string; accent?: string }): SceneStyle {
  return magazine({ ...o, panel: o.panel })
}

// ---------- 片头 / 片尾 ----------

export interface IntroOpt {
  id: string
  titleStyle: TextStyle
  subStyle: TextStyle
  dateStyle?: TextStyle
  overlay?: string // 照片上的遮罩颜色
  withPhoto?: boolean
  decor?: (c: BuildCtx) => Layer[]
  bg?: BgFill
  titleAnim?: AnimSpec
  /** 标题逐字动画（设置后代替 titleAnim） */
  titleChar?: CharAnim
  photoFrame?: FrameOpt & { shape?: MaskType }
}

export function intro(o: IntroOpt): SceneStyle {
  const withPhoto = o.withPhoto ?? true
  return {
    id: o.id,
    name: '片头',
    slots: withPhoto ? ['match'] : [],
    weight: 0,
    build: (c) => {
      const S = shortSide(c)
      const k = kind(c)
      const layers: Layer[] = []
      if (withPhoto && !o.photoFrame) {
        layers.push(photo(0, FULL, {}, { motion: 'zoomOut', motionStrength: 1.2 }))
        layers.push({ type: 'shape', shape: 'rect', rect: FULL, color: o.overlay ?? 'rgba(0,0,0,0.35)', in: { type: 'fade', duration: 1.2 } })
      } else {
        layers.push(bgLayer(o.bg))
        if (withPhoto && o.photoFrame) {
          const sz = k === 'tall' ? c.W * 0.62 : S * 0.5
          const shape = o.photoFrame.shape ?? 'circle'
          const w = shape === 'arch' ? sz * 0.78 : sz
          layers.push(photo(0, pxc(c, c.W / 2, k === 'tall' ? c.H * 0.36 : c.H * 0.36, w, sz), { ...o.photoFrame, mask: shape }, { in: { type: 'zoomIn', duration: 1.2, distance: 0.85 } }))
        }
      }
      const tY = withPhoto && o.photoFrame ? (k === 'tall' ? c.H * 0.62 : c.H * 0.72) : c.H * 0.44
      const titleH = o.titleStyle.size * S * 1.6
      layers.push(text('title', '', pxc(c, c.W / 2, tY, c.W - S * 0.16, titleH), o.titleStyle, o.titleChar ? undefined : o.titleAnim ?? { type: 'spread', delay: 0.4, duration: 1.4 }, o.titleChar ? { charAnim: o.titleChar } : {}))
      layers.push(text('subtitle', '', pxc(c, c.W / 2, tY + titleH * 0.5 + o.subStyle.size * S * 1.3, c.W - S * 0.2, o.subStyle.size * S * 1.8), o.subStyle, { type: 'slideUp', delay: 1.0, duration: 1 }))
      if (o.dateStyle) {
        layers.push(text('date', '', pxc(c, c.W / 2, tY + titleH * 0.5 + o.subStyle.size * S * 3.2 + o.dateStyle.size * S, c.W - S * 0.2, o.dateStyle.size * S * 1.8), o.dateStyle, { type: 'fade', delay: 1.5, duration: 1 }))
      }
      if (o.decor) layers.push(...o.decor(c))
      for (const l of layers) if (l.type !== 'bg' && l.type !== 'photo' && !l.out) l.out = { type: 'fade', duration: 0.5 }
      return layers
    }
  }
}

export interface OutroOpt {
  id: string
  endStyle: TextStyle
  smallStyle: TextStyle
  bg?: BgFill
  withPhoto?: boolean
  decor?: (c: BuildCtx) => Layer[]
  dim?: number
  /** 寄语逐字动画 */
  endChar?: CharAnim
}

export function outro(o: OutroOpt): SceneStyle {
  const withPhoto = o.withPhoto ?? true
  return {
    id: o.id,
    name: '片尾',
    slots: withPhoto ? ['any'] : [],
    weight: 0,
    build: (c) => {
      const S = shortSide(c)
      const layers: Layer[] = [bgLayer(withPhoto ? { kind: 'blurPhoto', slot: 0, dim: o.dim ?? 0.45 } : o.bg)]
      const eh = o.endStyle.size * S * 2.6
      layers.push(text('ending', '', pxc(c, c.W / 2, c.H * 0.4, c.W - S * 0.16, eh), o.endStyle, o.endChar ? undefined : { type: 'reveal', delay: 0.3, duration: 1.6 }, o.endChar ? { charAnim: o.endChar } : {}))
      layers.push(text('title', '', pxc(c, c.W / 2, c.H * 0.4 + eh * 0.55 + o.smallStyle.size * S * 1.4, c.W - S * 0.2, o.smallStyle.size * S * 1.8), o.smallStyle, { type: 'fade', delay: 1.2, duration: 1 }))
      // 影楼品牌信息（未开启品牌时文字为空，自动隐藏）
      const by = c.H * 0.76
      const bs: TextStyle = { ...o.smallStyle, size: o.smallStyle.size * 1.05, weight: 600, letterSpacing: 0.2 }
      layers.push(text('studio', '', pxc(c, c.W / 2, by, c.W - S * 0.2, bs.size * S * 1.8), bs, { type: 'slideUp', delay: 1.6, duration: 0.9 }))
      layers.push(text('slogan', '', pxc(c, c.W / 2, by + bs.size * S * 1.7, c.W - S * 0.2, bs.size * S * 1.6), { ...o.smallStyle, size: o.smallStyle.size * 0.85 }, { type: 'fade', delay: 1.9, duration: 0.9 }))
      layers.push(text('phone', '', pxc(c, c.W / 2, by + bs.size * S * 3.1, c.W - S * 0.2, bs.size * S * 1.6), { ...o.smallStyle, size: o.smallStyle.size * 0.8 }, { type: 'fade', delay: 2.1, duration: 0.9 }))
      layers.push(text('address', '', pxc(c, c.W / 2, by + bs.size * S * 4.4, c.W - S * 0.2, bs.size * S * 1.6), { ...o.smallStyle, size: o.smallStyle.size * 0.8 }, { type: 'fade', delay: 2.3, duration: 0.9 }))
      if (o.decor) layers.push(...o.decor(c))
      return layers
    }
  }
}

// ---------- 装饰工具 ----------

export const decorAt = (c: BuildCtx, name: string, cx: number, cy: number, w: number, color: string, more: Partial<Layer> = {}, color2?: string): Layer =>
  ({ type: 'decor', decor: name, color, color2, rect: { x: (cx - w / 2) / c.W, y: cy / c.H, w: w / c.W, h: 0 }, ...more }) as Layer

/** 让装饰的 rect.y 表示中心（decor 的高度在渲染时才知道，这里按宽高比估算） */
export const decorCenter = (c: BuildCtx, name: string, cx: number, cy: number, w: number, color: string, aspect: number, more: Partial<Layer> = {}, color2?: string): Layer =>
  ({ type: 'decor', decor: name, color, color2, rect: { x: (cx - w / 2) / c.W, y: (cy - (w * aspect) / 2) / c.H, w: w / c.W, h: 0 }, ...more }) as Layer

export type { SlotSpec }

/** 版式里可按场景编辑的文字（字幕、品名、价格、标签），供编辑器生成输入框 */
export function styleTextKeys(style: SceneStyle, palette: BuildCtx['t'], fonts: BuildCtx['fonts']): { key: string; def: string }[] {
  const keys = new Map<string, string>()
  try {
    const layers = style.build({ aspect: '16:9', W: 1920, H: 1080, ar: 16 / 9, seed: 1, dur: 4, rand: () => 0.5, t: palette, fonts, orient: style.slots.map(() => null) })
    for (const l of layers) {
      if (l.type !== 'text' || !l.key) continue
      const base = l.key.split('@')[0]
      if (['caption', 'product', 'price', 'tag'].includes(base) && !keys.has(l.key)) keys.set(l.key, l.text)
    }
  } catch {
    /* 版式构建失败时不显示文字输入框 */
  }
  return [...keys.entries()].map(([key, def]) => ({ key, def }))
}
