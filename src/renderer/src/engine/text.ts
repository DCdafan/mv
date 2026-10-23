import type { FontKey, TextStyle } from './types'

export const FONT_FILES: Partial<Record<FontKey, string>> = {
  MaShanZheng: 'MaShanZheng.ttf',
  ZCOOLKuaiLe: 'ZCOOLKuaiLe.ttf',
  ZCOOLXiaoWei: 'ZCOOLXiaoWei.ttf',
  LongCang: 'LongCang.ttf',
  ZhiMangXing: 'ZhiMangXing.ttf',
  GreatVibes: 'GreatVibes.ttf',
  PlayfairDisplay: 'PlayfairDisplay.ttf',
  Montserrat: 'Montserrat.ttf',
  Pacifico: 'Pacifico.ttf',
  Caveat: 'Caveat.ttf'
}

export const FONT_LABEL: Record<FontKey, string> = {
  MaShanZheng: '马善政楷书',
  ZCOOLKuaiLe: '站酷快乐体',
  ZCOOLXiaoWei: '站酷小薇',
  LongCang: '龙藏手书',
  ZhiMangXing: '志莽行书',
  GreatVibes: 'Great Vibes',
  PlayfairDisplay: 'Playfair Display',
  Montserrat: 'Montserrat',
  Pacifico: 'Pacifico',
  Caveat: 'Caveat',
  Sans: '苹方 / 雅黑',
  Serif: '宋体'
}

const SYS_CJK_SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif'
const SYS_CJK_SERIF = '"Songti SC","STSong","SimSun","Noto Serif CJK SC",serif'

export function fontFamily(key: FontKey): string {
  if (key === 'Sans') return SYS_CJK_SANS
  if (key === 'Serif') return SYS_CJK_SERIF
  // 英文字体缺中文字形时回退到系统中文字体
  const fallback = ['GreatVibes', 'PlayfairDisplay', 'Pacifico', 'Caveat'].includes(key) ? SYS_CJK_SERIF : SYS_CJK_SANS
  return `"MV-${key}",${fallback}`
}

const loaded = new Map<FontKey, Promise<void>>()
const done = new Set<FontKey>()

export function isFontLoaded(key: FontKey): boolean {
  return !FONT_FILES[key] || done.has(key)
}

export function loadFont(key: FontKey): Promise<void> {
  const file = FONT_FILES[key]
  if (!file) return Promise.resolve()
  let p = loaded.get(key)
  if (!p) {
    const face = new FontFace(`MV-${key}`, `url(./fonts/${file})`)
    p = face
      .load()
      .then((f) => {
        document.fonts.add(f)
        done.add(key)
      })
      .catch((e) => console.warn('字体加载失败', key, e))
    loaded.set(key, p)
  }
  return p
}

export function loadAllFonts(): Promise<void> {
  return Promise.all((Object.keys(FONT_FILES) as FontKey[]).map(loadFont)).then(() => undefined)
}

export interface CharBox {
  x0: number
  x1: number
  y0: number
  y1: number
}

export interface TextRaster {
  canvas: HTMLCanvasElement
  w: number
  h: number
  /** 每个可见字符在画布上的范围（逐字动画用） */
  chars: CharBox[]
}

/** 把文字按样式画到画布上。S：目标画布短边像素 */
export function rasterizeText(text: string, style: TextStyle, S: number, maxWidthPx: number): TextRaster {
  const size = Math.max(4, style.size * S)
  const ls = (style.letterSpacing ?? 0) * size
  const lh = (style.lineHeight ?? 1.3) * size
  const content = style.uppercase ? text.toUpperCase() : text
  const font = `${style.italic ? 'italic ' : ''}${style.weight ?? 400} ${size}px ${fontFamily(style.font)}`
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = font
  ;(measure as unknown as { letterSpacing: string }).letterSpacing = `${ls}px`

  // 按最大宽度折行（中文逐字，英文按词）
  const lines: string[] = []
  for (const para of content.split('\n')) {
    if (!para) {
      lines.push('')
      continue
    }
    const tokens = para.match(/[A-Za-z0-9'’\-.,!?]+\s*|\s+|./gu) || [para]
    let cur = ''
    for (const tk of tokens) {
      const test = cur + tk
      if (cur && measure.measureText(test).width > maxWidthPx) {
        lines.push(cur.trimEnd())
        cur = tk.trimStart()
      } else cur = test
    }
    lines.push(cur)
  }

  const widths = lines.map((l) => measure.measureText(l).width)
  const strokeW = style.stroke ? style.stroke.width * size : 0
  const sh = style.shadow
  const shPad = sh ? (sh.blur + Math.max(Math.abs(sh.dx ?? 0), Math.abs(sh.dy ?? 0))) * size : 0
  const pad = Math.ceil(strokeW + shPad + size * 0.25)
  const textW = Math.max(1, ...widths)
  const w = Math.ceil(textW + pad * 2)
  const h = Math.ceil(lh * lines.length + pad * 2)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.font = font
  ;(ctx as unknown as { letterSpacing: string }).letterSpacing = `${ls}px`
  ctx.textBaseline = 'middle'
  const align = style.align ?? 'center'

  let fill: string | CanvasGradient = style.color
  if (style.gradient) {
    const g = ctx.createLinearGradient(0, pad, 0, h - pad)
    g.addColorStop(0, style.gradient[0])
    g.addColorStop(1, style.gradient[1])
    fill = g
  }

  const chars: CharBox[] = []
  lines.forEach((line, i) => {
    const y = pad + lh * i + lh / 2
    // letterSpacing 会在末尾多加一个间距，居中时补偿
    const lw = widths[i] - (ls > 0 ? ls : 0)
    const x = align === 'left' ? pad : align === 'right' ? w - pad - lw : (w - lw) / 2
    if (sh) {
      ctx.save()
      ctx.shadowColor = sh.color
      ctx.shadowBlur = sh.blur * size
      ctx.shadowOffsetX = (sh.dx ?? 0) * size
      ctx.shadowOffsetY = (sh.dy ?? 0) * size
      ctx.fillStyle = fill
      ctx.fillText(line, x, y)
      ctx.restore()
    }
    if (style.stroke) {
      ctx.lineJoin = 'round'
      ctx.lineWidth = strokeW * 2
      ctx.strokeStyle = style.stroke.color
      ctx.strokeText(line, x, y)
    }
    ctx.fillStyle = fill
    ctx.fillText(line, x, y)
    // 记录每个字的位置：相邻字之间按测量边界切开，首尾和上下延伸到画布边缘（带上描边和阴影）
    const glyphs = [...line]
    const y0 = i === 0 ? 0 : y - lh / 2
    const y1 = i === lines.length - 1 ? h : y + lh / 2
    let prefix = ''
    let prevX = x
    glyphs.forEach((ch, k) => {
      prefix += ch
      const nx = x + measure.measureText(prefix).width - (k === glyphs.length - 1 && ls > 0 ? ls : 0)
      if (ch.trim()) chars.push({ x0: k === 0 ? Math.max(0, prevX - pad) : prevX, x1: k === glyphs.length - 1 ? Math.min(w, nx + pad) : nx, y0, y1 })
      prevX = nx
    })
  })
  return { canvas, w, h, chars }
}
