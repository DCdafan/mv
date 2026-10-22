// 蛋糕店 / 烘焙甜品模板：突出产品名、价格，适合新品宣传、门店推广（抖音、朋友圈、门店大屏）
import type { AnimSpec, BgFill, BuildCtx, Layer, SceneStyle, Template, TextStyle } from '../engine/types'
import type { FrameOpt } from './styles'
import {
  FULL,
  bgLayer,
  blurFrame,
  decorAt,
  decorCenter,
  duo,
  fit,
  fullscreen,
  grid4,
  intro,
  kind,
  magazine,
  outro,
  photo,
  polaroid,
  px,
  pxc,
  shapeFrame,
  shortSide,
  stagger,
  text,
  trio,
  ts,
  zoomPop
} from './styles'

const S = shortSide

// ---------------- 产品元素 ----------------

export interface BadgeOpt {
  kind: 'burst' | 'pill'
  color: string
  color2?: string
  text: TextStyle
}

/** 价格标签：爆炸贴或胶囊，没有价格时自动隐藏 */
function priceBadge(c: BuildCtx, key: string, cx: number, cy: number, size: number, b: BadgeOpt, delay = 0.8): Layer[] {
  const anim: AnimSpec = { type: 'pop', delay, duration: 0.6 }
  if (b.kind === 'burst') {
    return [
      decorCenter(c, 'burst', cx, cy, size, b.color, 1, { in: anim, loop: { type: 'pulse', amp: 0.04, period: 1.4 }, showIf: key, rotation: -8 }, b.color2 ?? '#ffffff'),
      text(key, '', pxc(c, cx, cy, size * 0.82, size * 0.5), b.text, anim, { rotation: -8, loop: { type: 'pulse', amp: 0.04, period: 1.4 } })
    ]
  }
  const w = size
  const h = size * 0.42
  return [
    { type: 'shape', shape: 'round', radius: 0.5, rect: pxc(c, cx, cy, w, h), color: b.color, color2: b.color2 ?? b.color, gradientAngle: 0, in: anim, showIf: key, shadow: { blur: 0.012, alpha: 0.25, dy: 0.006 } },
    text(key, '', pxc(c, cx, cy, w * 0.9, h), b.text, anim)
  ]
}

/** 丝带标签（如「本店招牌」「新品上市」），文字可在编辑器里改，清空即隐藏 */
function tagRibbon(c: BuildCtx, cx: number, cy: number, w: number, color: string, color2: string, style: TextStyle, defaultText: string, anim: AnimSpec = { type: 'flyLeft', duration: 0.7, delay: 0.2, distance: 0.6 }): Layer[] {
  return [
    decorCenter(c, 'ribbon', cx, cy, w, color, 0.25, { in: anim, showIf: 'tag' }, color2),
    text('tag', defaultText, pxc(c, cx, cy - w * 0.015, w * 0.75, w * 0.14), style, anim)
  ]
}

export interface ProductOpt {
  id: string
  name?: string
  weight?: number
  energy?: [number, number]
  bg?: BgFill
  frame?: FrameOpt
  nameStyle: TextStyle
  badge: BadgeOpt
  tag?: { text: string; color: string; color2: string; style: TextStyle }
  flip?: boolean
  decor?: (c: BuildCtx) => Layer[]
}

/** 产品卡：大图 + 品名 + 价格（+ 丝带标签） */
export function productCard(o: ProductOpt): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '产品卡',
    slots: ['any'],
    weight: o.weight ?? 4,
    energy: o.energy ?? [0, 1],
    needsProduct: true,
    build: (c) => {
      const s = S(c)
      const k = kind(c)
      const layers: Layer[] = [bgLayer(o.bg)]
      const frame = o.frame ?? { radius: 0.04 }
      if (k === 'wide') {
        const m = s * 0.07
        const ph = c.H - m * 2
        const pw = Math.min(c.W * 0.56, ph * 1.3)
        const flip = o.flip ?? false
        const px0 = flip ? c.W - m - pw : m
        layers.push(photo(0, px(c, px0, m, pw, ph), frame, { in: { type: flip ? 'slideLeft' : 'slideRight', duration: 0.8, distance: 0.06 }, motionStrength: 0.7 }))
        const x0 = flip ? m : m + pw
        const x1 = flip ? c.W - m - pw : c.W - m
        const icx = (x0 + x1) / 2
        const iw = x1 - x0 - s * 0.06
        if (o.tag) layers.push(...tagRibbon(c, icx, c.H * 0.24, Math.min(iw, s * 0.5), o.tag.color, o.tag.color2, o.tag.style, o.tag.text))
        layers.push(text('product@0', '', pxc(c, icx, c.H * 0.46, iw, s * 0.32), { ...o.nameStyle, lineHeight: 1.25 }, { type: 'slideUp', delay: 0.4, duration: 0.8 }))
        layers.push(...priceBadge(c, 'price@0', icx, c.H * 0.72, s * (o.badge.kind === 'burst' ? 0.28 : 0.3), o.badge))
      } else {
        const m = s * 0.06
        const ph = c.H * (k === 'tall' ? 0.6 : 0.56)
        layers.push(photo(0, px(c, m, m, c.W - m * 2, ph), frame, { in: { type: 'slideDown', duration: 0.8, distance: 0.05 }, motionStrength: 0.7 }))
        if (o.tag) layers.push(...tagRibbon(c, m + s * 0.24, m + s * 0.07, s * 0.44, o.tag.color, o.tag.color2, o.tag.style, o.tag.text))
        const ny = m + ph + (c.H - m - ph) * (k === 'tall' ? 0.3 : 0.32)
        layers.push(text('product@0', '', pxc(c, c.W / 2, ny, c.W - m * 2, s * 0.26), { ...o.nameStyle, lineHeight: 1.25 }, { type: 'slideUp', delay: 0.4, duration: 0.8 }))
        if (o.badge.kind === 'burst') layers.push(...priceBadge(c, 'price@0', c.W - m - s * 0.13, m + ph - s * 0.04, s * 0.3, o.badge))
        else layers.push(...priceBadge(c, 'price@0', c.W / 2, ny + s * (k === 'tall' ? 0.2 : 0.17), s * 0.32, o.badge))
      }
      if (o.decor) layers.push(...o.decor(c))
      return layers
    }
  }
}

/** 产品大图：满屏 + 底部品名与价格 */
export function productHero(o: ProductOpt): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '产品大图',
    slots: ['match'],
    weight: o.weight ?? 3,
    energy: o.energy ?? [0, 1],
    needsProduct: true,
    build: (c) => {
      const s = S(c)
      const k = kind(c)
      const m = s * 0.07
      const layers: Layer[] = [
        photo(0, FULL, {}, { motionStrength: 1.1 }),
        { type: 'shape', shape: 'rect', rect: px(c, 0, c.H * 0.55, c.W, c.H * 0.45), color: 'rgba(0,0,0,0)', color2: 'rgba(0,0,0,0.6)', gradientAngle: 90 }
      ]
      if (o.tag) layers.push(...tagRibbon(c, m + s * 0.22, m + s * 0.06, s * 0.42, o.tag.color, o.tag.color2, o.tag.style, o.tag.text))
      const nameW = k === 'tall' ? c.W - m * 2 : c.W * 0.6
      const ny = c.H - m - s * (k === 'tall' ? 0.32 : 0.12)
      layers.push(text('product@0', '', px(c, m, ny - s * 0.09, nameW, s * 0.18), { ...o.nameStyle, align: 'left', shadow: { color: 'rgba(0,0,0,0.5)', blur: 0.15 } }, { type: 'slideRight', delay: 0.4, duration: 0.8 }))
      if (k === 'tall') layers.push(...priceBadge(c, 'price@0', m + s * 0.17, ny + s * 0.2, s * 0.32, { ...o.badge, kind: 'pill' }))
      else layers.push(...priceBadge(c, 'price@0', c.W - m - s * 0.17, ny, s * 0.32, { ...o.badge, kind: 'pill' }))
      if (o.decor) layers.push(...o.decor(c))
      return layers
    }
  }
}

/** 菜单板：三款产品并排，各带品名和价格 */
export function menuBoard(o: ProductOpt & { card?: string; priceStyle: TextStyle }): SceneStyle {
  return {
    id: o.id,
    name: o.name ?? '菜单板',
    slots: ['any', 'any', 'any'],
    weight: o.weight ?? 2.5,
    energy: o.energy ?? [0.2, 1],
    durationFactor: 0.8,
    needsProduct: true,
    build: (c) => {
      const s = S(c)
      const k = kind(c)
      const layers: Layer[] = [bgLayer(o.bg)]
      const card = o.card ?? '#ffffff'
      const m = s * 0.07
      const g = s * 0.04
      const pad = s * 0.025
      const nameStyle: TextStyle = { ...o.nameStyle, size: o.nameStyle.size * 0.62 }
      for (let i = 0; i < 3; i++) {
        const a = stagger({ type: 'pop', duration: 0.55 }, i, 0.18)
        if (k === 'tall') {
          const ch = (c.H - m * 2 - g * 2) / 3
          const y = m + i * (ch + g)
          const side = ch - pad * 2
          layers.push({ type: 'shape', shape: 'round', radius: 0.08, rect: px(c, m, y, c.W - m * 2, ch), color: card, shadow: { blur: 0.02, alpha: 0.18, dy: 0.008 }, in: a })
          layers.push(photo(i, px(c, m + pad, y + pad, side, side), { radius: 0.08 }, { in: a, motionStrength: 0.5 }))
          const tx = m + pad * 2 + side
          const tw = c.W - m - pad - tx
          layers.push(text(`product@${i}`, '', px(c, tx, y + ch * 0.18, tw, ch * 0.4), { ...nameStyle, align: 'left' }, { ...a, type: 'fade', delay: (a.delay ?? 0) + 0.3 }))
          layers.push(text(`price@${i}`, '', px(c, tx, y + ch * 0.58, tw, ch * 0.26), { ...o.priceStyle, align: 'left' }, { ...a, type: 'fade', delay: (a.delay ?? 0) + 0.45 }))
        } else {
          const cw = (c.W - m * 2 - g * 2) / 3
          const [, side0] = fit(cw - pad * 2, c.H, 1)
          const side = Math.min(side0, (c.H - m * 2) * 0.68)
          const ch = side + pad * 2 + s * 0.24
          const y = (c.H - ch) / 2
          const x = m + i * (cw + g)
          layers.push({ type: 'shape', shape: 'round', radius: 0.06, rect: px(c, x, y, cw, ch), color: card, shadow: { blur: 0.02, alpha: 0.18, dy: 0.008 }, in: a })
          layers.push(photo(i, px(c, x + (cw - side) / 2, y + pad, side, side), { radius: 0.06 }, { in: a, motionStrength: 0.5 }))
          layers.push(text(`product@${i}`, '', pxc(c, x + cw / 2, y + pad + side + s * 0.07, cw - pad * 2, s * 0.09), nameStyle, { ...a, type: 'fade', delay: (a.delay ?? 0) + 0.3 }))
          layers.push(text(`price@${i}`, '', pxc(c, x + cw / 2, y + pad + side + s * 0.165, cw - pad * 2, s * 0.08), o.priceStyle, { ...a, type: 'fade', delay: (a.delay ?? 0) + 0.45 }))
        }
      }
      if (o.decor) layers.push(...o.decor(c))
      return layers
    }
  }
}

const sweets = (c: BuildCtx, color: string, color2: string): Layer[] => {
  const s = S(c)
  const k = kind(c)
  return [
    decorAt(c, 'cupcake', k === 'tall' ? c.W * 0.14 : c.W * 0.09, c.H * (k === 'tall' ? 0.06 : 0.68), s * 0.15, color, { in: { type: 'drop', delay: 0.5, duration: 1 }, loop: { type: 'sway', amp: 0.06, period: 3 } }, color2),
    decorAt(c, 'macaron', k === 'tall' ? c.W * 0.86 : c.W * 0.91, c.H * (k === 'tall' ? 0.08 : 0.72), s * 0.14, '#a8e6cf', { in: { type: 'drop', delay: 0.7, duration: 1 }, loop: { type: 'float', amp: 0.012, period: 2.6 } }, '#ffffff')
  ]
}

// ---------------- 甜蜜烘焙 ----------------
const P = { bg: '#fff1f4', primary: '#ff6f91', accent: '#7dd3c0', text: '#6b3a4a', textSoft: '#b07d8c' }
const pinkTitle = (size: number, more: Partial<TextStyle> = {}): TextStyle => ts('ZCOOLKuaiLe', size, '#ff6f91', { stroke: { color: '#ffffff', width: 0.08 }, shadow: { color: 'rgba(160,60,90,0.25)', blur: 0.08, dy: 0.06 }, ...more })

export const bakerySweet: Template = {
  id: 'bakery-sweet',
  name: '甜蜜烘焙',
  category: '烘焙',
  industry: 'bakery',
  description: '粉色波点、彩色糖粒、纸杯蛋糕与马卡龙，产品卡自动显示品名和价格，适合蛋糕店日常上新',
  tags: ['蛋糕店', '甜品', '上新', '抖音'],
  palette: P,
  fonts: { title: 'ZCOOLKuaiLe', body: 'ZCOOLKuaiLe', script: 'Pacifico' },
  grade: { exposure: 0.04, contrast: 1.04, saturation: 1.1, warmth: 0.08 },
  post: { vignette: 0, grain: 0.005, leak: 0 },
  background: { kind: 'pattern', pattern: 'dots', color: '#fff1f4', color2: '#ffdce5' },
  overlay: [{ type: 'sprinkles', count: 26, colors: ['#ff6f91', '#ffd23f', '#7dd3c0', '#9b8cff', '#ffffff'], opacity: 0.9, speed: 0.7 }],
  transitions: [
    { name: 'circleOpen', weight: 2 },
    { name: 'pushLeft', weight: 2 },
    { name: 'heart', weight: 1.5 },
    { name: 'zoomThrough', weight: 1.5 },
    { name: 'fade', weight: 1.5 },
    { name: 'diamond', weight: 1 }
  ],
  music: 'summer-sunday.mp3',
  pace: 'normal',
  defaultAspect: '9:16',
  intro: intro({
    id: 'bs-intro',
    withPhoto: true,
    photoFrame: { shape: 'circle', border: { width: 0.014, color: '#ffffff' } },
    titleStyle: pinkTitle(0.12),
    subStyle: ts('Pacifico', 0.045, '#7dd3c0'),
    dateStyle: ts('ZCOOLKuaiLe', 0.03, P.textSoft),
    titleAnim: { type: 'pop', delay: 0.5, duration: 0.8 },
    decor: (c) => sweets(c, '#ffb3c6', '#ffd6a5')
  }),
  outro: outro({
    id: 'bs-outro',
    withPhoto: false,
    endStyle: pinkTitle(0.075, { lineHeight: 1.45 }),
    smallStyle: ts('ZCOOLKuaiLe', 0.034, P.text),
    decor: (c) => [decorCenter(c, 'cake', c.W / 2, c.H * 0.2, S(c) * 0.2, '#ffffff', 0.875, { in: { type: 'pop', delay: 0.2 } }, '#ffb3c6')]
  }),
  styles: [
    productCard({
      id: 'bs-card',
      frame: { radius: 0.05, border: { width: 0.01, color: '#ffffff' }, shadow: { blur: 0.025, alpha: 0.2, dy: 0.01 } },
      nameStyle: ts('ZCOOLKuaiLe', 0.075, P.text),
      badge: { kind: 'burst', color: '#ff6f91', color2: '#ffffff', text: ts('ZCOOLKuaiLe', 0.075, '#ffffff') },
      tag: { text: '本店招牌', color: '#7dd3c0', color2: '#4fb3a1', style: ts('ZCOOLKuaiLe', 0.038, '#ffffff') }
    }),
    productCard({
      id: 'bs-card2',
      name: '产品卡·右图',
      flip: true,
      weight: 3,
      frame: { radius: 0.05, border: { width: 0.01, color: '#ffffff' } },
      nameStyle: ts('ZCOOLKuaiLe', 0.075, P.text),
      badge: { kind: 'pill', color: '#ff6f91', color2: '#ff8fab', text: ts('ZCOOLKuaiLe', 0.065, '#ffffff') },
      decor: (c) => sweets(c, '#ffb3c6', '#ffd6a5')
    }),
    productHero({
      id: 'bs-hero',
      nameStyle: ts('ZCOOLKuaiLe', 0.08, '#ffffff'),
      badge: { kind: 'pill', color: '#ff6f91', text: ts('ZCOOLKuaiLe', 0.06, '#ffffff') }
    }),
    menuBoard({
      id: 'bs-menu',
      nameStyle: ts('ZCOOLKuaiLe', 0.075, P.text),
      priceStyle: ts('ZCOOLKuaiLe', 0.05, '#ff6f91'),
      badge: { kind: 'pill', color: '#ff6f91', text: ts('ZCOOLKuaiLe', 0.05, '#fff') }
    }),
    polaroid({ id: 'bs-pola', caption: ts('ZCOOLKuaiLe', 0.045, P.text), tape: '#ff9fb5', weight: 1.5 }),
    zoomPop({ id: 'bs-pop', bg: { kind: 'template' }, border: { width: 0.012, color: '#ffffff' }, radius: 0.06, shadow: { blur: 0.02, alpha: 0.25 }, weight: 1.5 }),
    duo({ id: 'bs-duo', border: { width: 0.01, color: '#ffffff' }, radius: 0.06, anim: { type: 'pop', duration: 0.6 }, weight: 1.5 }),
    grid4({ id: 'bs-grid', border: { width: 0.008, color: '#ffffff' }, radius: 0.08, weight: 1.2 })
  ],
  captions: ['每一口都是幸福', '新鲜出炉', '甜蜜不打烊', '今天也要吃点甜的', '用心烘焙每一天', '手作的温度'],
  defaults: { title: '甜蜜上新', subtitle: 'Sweet Bakery', ending: '欢迎到店品尝\n每一口都是幸福' },
  coverColors: ['#fff1f4', '#ff6f91']
}

// ---------------- 新品上市 ----------------
const R = { bg: '#c8102e', primary: '#ffd23f', accent: '#ffffff', text: '#ffffff', textSoft: '#ffe7a3' }
const promoTitle = (size: number, more: Partial<TextStyle> = {}): TextStyle =>
  ts('ZCOOLKuaiLe', size, '#ffd23f', { stroke: { color: '#7a0010', width: 0.1 }, shadow: { color: 'rgba(0,0,0,0.35)', blur: 0.06, dy: 0.08 }, ...more })

export const bakeryPromo: Template = {
  id: 'bakery-promo',
  name: '新品上市',
  category: '烘焙',
  industry: 'bakery',
  description: '红黄撞色促销风、价格爆炸贴、快节奏转场，适合新品发布、节日活动、限时优惠',
  tags: ['蛋糕店', '促销', '新品', '快节奏'],
  palette: R,
  fonts: { title: 'ZCOOLKuaiLe', body: 'Sans' },
  grade: { exposure: 0.05, contrast: 1.08, saturation: 1.15, warmth: 0.06 },
  post: { vignette: 0.2, grain: 0, leak: 0 },
  background: { kind: 'radial', colors: ['#e2252f', '#8e0b17'] },
  overlay: [{ type: 'confetti', count: 18, colors: ['#ffd23f', '#ffffff', '#ff9f1c'], opacity: 0.85, speed: 0.6 }],
  transitions: [
    { name: 'zoomThrough', weight: 2 },
    { name: 'pushUp', weight: 2 },
    { name: 'flash', weight: 2 },
    { name: 'crossZoom', weight: 1.5 },
    { name: 'glitch', weight: 1 },
    { name: 'cut', weight: 1 }
  ],
  music: 'apple-cider.mp3',
  pace: 'fast',
  defaultAspect: '9:16',
  intro: intro({
    id: 'bp-intro',
    titleStyle: promoTitle(0.16),
    subStyle: ts('Sans', 0.04, '#ffffff', { weight: 700, letterSpacing: 0.3 }),
    dateStyle: ts('Sans', 0.03, '#ffe7a3', { letterSpacing: 0.2 }),
    overlay: 'rgba(150,0,15,0.55)',
    titleAnim: { type: 'zoomOut', delay: 0.3, duration: 0.7, distance: 2 },
    decor: (c) => [decorCenter(c, 'sunburst', c.W / 2, c.H * 0.44, S(c) * 1.1, 'rgba(255,210,63,0.16)', 1, { loop: { type: 'spin', period: 14 }, in: { type: 'fade', duration: 1 } })]
  }),
  outro: outro({
    id: 'bp-outro',
    withPhoto: false,
    endStyle: promoTitle(0.09, { lineHeight: 1.35 }),
    smallStyle: ts('Sans', 0.034, '#ffe7a3', { weight: 500 }),
    decor: (c) => [decorCenter(c, 'sunburst', c.W / 2, c.H * 0.42, S(c) * 1.2, 'rgba(255,210,63,0.12)', 1, { loop: { type: 'spin', period: 16 } })]
  }),
  styles: [
    productCard({
      id: 'bp-card',
      frame: { radius: 0.03, border: { width: 0.01, color: '#ffd23f' } },
      nameStyle: ts('ZCOOLKuaiLe', 0.085, '#ffffff', { shadow: { color: 'rgba(0,0,0,0.3)', blur: 0.08, dy: 0.05 } }),
      badge: { kind: 'burst', color: '#ffd23f', color2: '#c8102e', text: ts('ZCOOLKuaiLe', 0.085, '#c8102e') },
      tag: { text: '新品上市', color: '#ffd23f', color2: '#e0a800', style: ts('ZCOOLKuaiLe', 0.04, '#c8102e') }
    }),
    productHero({
      id: 'bp-hero',
      nameStyle: ts('ZCOOLKuaiLe', 0.09, '#ffffff'),
      badge: { kind: 'pill', color: '#ffd23f', text: ts('ZCOOLKuaiLe', 0.065, '#c8102e') },
      tag: { text: '限时尝鲜', color: '#ffd23f', color2: '#e0a800', style: ts('ZCOOLKuaiLe', 0.038, '#c8102e') }
    }),
    menuBoard({
      id: 'bp-menu',
      name: '爆款三连',
      card: '#fff8e1',
      nameStyle: ts('ZCOOLKuaiLe', 0.075, '#7a0010'),
      priceStyle: ts('ZCOOLKuaiLe', 0.055, '#c8102e'),
      badge: { kind: 'pill', color: '#ffd23f', text: ts('ZCOOLKuaiLe', 0.05, '#c8102e') }
    }),
    zoomPop({ id: 'bp-pop', bg: { kind: 'template' }, border: { width: 0.012, color: '#ffd23f' }, weight: 1.5 }),
    fullscreen({ id: 'bp-full', caption: promoTitle(0.08), weight: 1.5 }),
    duo({ id: 'bp-duo', border: { width: 0.01, color: '#ffd23f' }, anim: { type: 'flyUp', duration: 0.5 } })
  ],
  captions: ['限时尝鲜', '人气爆款', '本周必吃', '好吃到停不下来', '新品登场', '手慢无'],
  defaults: { title: '新品上市', subtitle: 'NEW ARRIVAL · 限时尝鲜', ending: '到店即享\n新品尝鲜价' },
  coverColors: ['#c8102e', '#ffd23f']
}

// ---------------- 法式下午茶 ----------------
const T = { bg: '#f4eee4', primary: '#7d8f69', accent: '#c9a227', text: '#3f3a32', textSoft: '#8a8173' }
const serif = (size: number, color = T.text, more: Partial<TextStyle> = {}): TextStyle => ts('Serif', size, color, { letterSpacing: 0.18, ...more })

export const bakeryTea: Template = {
  id: 'bakery-tea',
  name: '法式下午茶',
  category: '烘焙',
  industry: 'bakery',
  description: '奶油纸纹、鼠尾草绿与金色细线、衬线字体菜单排版，适合精品甜品店、咖啡馆、门店大屏',
  tags: ['甜品店', '下午茶', '高级', '菜单'],
  palette: T,
  fonts: { title: 'Serif', body: 'Serif', script: 'GreatVibes' },
  grade: { exposure: 0.03, contrast: 0.98, saturation: 0.95, warmth: 0.12, fade: 0.03 },
  post: { vignette: 0.15, grain: 0.012, leak: 0.05 },
  background: { kind: 'pattern', pattern: 'paper', color: '#f4eee4', color2: '#e6dccb' },
  overlay: [{ type: 'goldDust', count: 22, colors: ['#e9c46a'], opacity: 0.45 }],
  transitions: [
    { name: 'fade', weight: 3 },
    { name: 'wipeLeft', weight: 1.5 },
    { name: 'slideZoom', weight: 1.5 },
    { name: 'blurFade', weight: 1.5 },
    { name: 'doorway', weight: 1 }
  ],
  music: 'morning.mp3',
  pace: 'slow',
  intro: intro({
    id: 'bt-intro',
    withPhoto: true,
    photoFrame: { shape: 'arch', border: { width: 0.006, color: '#c9a227' } },
    titleStyle: serif(0.085, T.text, { letterSpacing: 0.4 }),
    subStyle: ts('GreatVibes', 0.06, T.primary),
    dateStyle: ts('PlayfairDisplay', 0.024, T.textSoft, { letterSpacing: 0.5 }),
    titleAnim: { type: 'reveal', delay: 0.6, duration: 1.4 }
  }),
  outro: outro({
    id: 'bt-outro',
    withPhoto: false,
    endStyle: serif(0.065, T.text, { lineHeight: 1.7, letterSpacing: 0.3 }),
    smallStyle: ts('PlayfairDisplay', 0.028, T.textSoft, { letterSpacing: 0.3 }),
    decor: (c) => [decorCenter(c, 'flourish', c.W / 2, c.H * 0.24, S(c) * 0.42, '#c9a227', 0.125, { in: { type: 'spread', delay: 0.2, duration: 1 } })]
  }),
  styles: [
    productCard({
      id: 'bt-card',
      bg: { kind: 'template' },
      frame: { radius: 0.02, shadow: { blur: 0.02, alpha: 0.18 } },
      nameStyle: serif(0.07),
      badge: { kind: 'pill', color: '#7d8f69', text: ts('PlayfairDisplay', 0.055, '#ffffff', { letterSpacing: 0.1 }) },
      tag: { text: 'Signature', color: '#c9a227', color2: '#a3831c', style: ts('GreatVibes', 0.045, '#ffffff') }
    }),
    productCard({
      id: 'bt-card2',
      name: '产品卡·右图',
      flip: true,
      frame: { mask: 'arch' },
      nameStyle: serif(0.07),
      badge: { kind: 'pill', color: '#7d8f69', text: ts('PlayfairDisplay', 0.055, '#ffffff', { letterSpacing: 0.1 }) },
      weight: 3
    }),
    menuBoard({
      id: 'bt-menu',
      name: '今日菜单',
      card: '#fbf8f2',
      nameStyle: serif(0.075),
      priceStyle: ts('PlayfairDisplay', 0.045, '#7d8f69', { letterSpacing: 0.1 }),
      badge: { kind: 'pill', color: '#7d8f69', text: serif(0.05, '#fff') },
      weight: 3
    }),
    magazine({ id: 'bt-mag', caption: serif(0.055, T.text, { lineHeight: 1.6 }), accent: '#c9a227', weight: 1.5 }),
    blurFrame({ id: 'bt-frame', bg: { kind: 'template' }, side: 'right', caption: serif(0.055, T.text, { lineHeight: 1.6 }), shadow: { blur: 0.03, alpha: 0.18 }, weight: 1.5 }),
    shapeFrame({ id: 'bt-arch', shape: 'arch', ring: { color: '#c9a227', width: 0.003 }, caption: serif(0.055, T.text, { lineHeight: 1.6 }), weight: 1.2 }),
    duo({ id: 'bt-duo', anim: { type: 'fade', duration: 1.1 } }),
    trio({ id: 'bt-trio', anim: { type: 'slideUp', duration: 1, distance: 0.04 } })
  ],
  captions: ['慢享午后时光', '一杯茶，一块蛋糕', '甜点是生活的诗', '法式的浪漫', '手作，只为好味道', '偷得浮生半日闲'],
  defaults: { title: '午后甜点时光', subtitle: 'Afternoon Tea', ending: '愿每个午后\n都有甜点相伴' },
  coverColors: ['#f4eee4', '#7d8f69']
}
