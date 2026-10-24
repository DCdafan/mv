import type { Aspect, Pace } from '@shared/types'
import type { EaseName } from './math'

/** 归一化矩形：左上角 + 宽高，相对画布 0..1 */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type MaskType = 'rect' | 'round' | 'ellipse' | 'heart' | 'arch' | 'diamond' | 'hexagon' | 'circle'

export type AnimType =
  | 'none'
  | 'fade'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'flyLeft'
  | 'flyRight'
  | 'flyUp'
  | 'flyDown'
  | 'zoomIn'
  | 'zoomOut'
  | 'pop'
  | 'rotateIn'
  | 'flipX'
  | 'reveal'
  | 'drop'
  | 'spread'

export interface AnimSpec {
  type: AnimType
  delay?: number // 秒
  duration?: number // 秒
  ease?: EaseName
  distance?: number // 归一化距离
}

export interface LoopSpec {
  type: 'float' | 'pulse' | 'sway' | 'spin' | 'breathe'
  amp?: number
  period?: number
}

export type MotionType = 'zoomIn' | 'zoomOut' | 'panLeft' | 'panRight' | 'panUp' | 'panDown' | 'none' | 'auto'

export interface Grade {
  exposure: number // EV
  contrast: number // 1 = 原样
  saturation: number // 1 = 原样
  warmth: number // -1..1
  tint: number // -1..1（正值偏洋红）
  fade: number // 0..0.3 抬黑
  mono: number // 0..1 黑白
  splitShadow: string
  splitHighlight: string
  splitAmount: number // 0..0.3
}

export const DEFAULT_GRADE: Grade = {
  exposure: 0,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  tint: 0,
  fade: 0,
  mono: 0,
  splitShadow: '#808080',
  splitHighlight: '#808080',
  splitAmount: 0
}

export type FontKey =
  | 'MaShanZheng'
  | 'ZCOOLKuaiLe'
  | 'ZCOOLXiaoWei'
  | 'LongCang'
  | 'ZhiMangXing'
  | 'GreatVibes'
  | 'PlayfairDisplay'
  | 'Montserrat'
  | 'Pacifico'
  | 'Caveat'
  | 'Sans'
  | 'Serif'

export interface TextStyle {
  font: FontKey
  size: number // 相对画布短边
  color: string
  weight?: number
  italic?: boolean
  letterSpacing?: number // em
  lineHeight?: number
  align?: 'left' | 'center' | 'right'
  vAlign?: 'top' | 'middle' | 'bottom'
  stroke?: { color: string; width: number } // width: em
  shadow?: { color: string; blur: number; dx?: number; dy?: number } // em
  gradient?: [string, string]
  uppercase?: boolean
}

export type BgFill =
  | { kind: 'template' }
  | { kind: 'color'; color: string }
  | { kind: 'gradient'; colors: [string, string]; angle?: number }
  | { kind: 'radial'; colors: [string, string] }
  | { kind: 'blurPhoto'; slot: number; dim?: number; tint?: string }
  | { kind: 'pattern'; pattern: 'paper' | 'dots' | 'grid' | 'lines' | 'film'; color: string; color2: string }

export type ParticleType =
  | 'petals'
  | 'snow'
  | 'hearts'
  | 'stars'
  | 'bokeh'
  | 'bubbles'
  | 'confetti'
  | 'sparkles'
  | 'goldDust'
  | 'leaves'
  | 'fireflies'
  | 'sprinkles'
  | 'fireworks'

export interface ParticleConfig {
  type: ParticleType
  count: number
  colors: string[]
  size?: [number, number] // 相对短边
  speed?: number // 倍率
  opacity?: number
  seed?: number
}

interface LayerBase {
  key?: string
  /** 只有这个文字 key 有内容时才显示（例如没有价格时隐藏价格贴纸） */
  showIf?: string
  rect: Rect
  rotation?: number // 度
  opacity?: number
  in?: AnimSpec
  out?: AnimSpec
  loop?: LoopSpec
}

export interface BgLayer extends LayerBase {
  type: 'bg'
  fill: BgFill
}

export interface PhotoLayer extends LayerBase {
  type: 'photo'
  slot: number
  mask?: MaskType
  radius?: number // 相对矩形短边
  border?: { width: number; color: string } // width 相对画布短边
  shadow?: { blur: number; alpha: number; dx?: number; dy?: number; color?: string } // 相对短边
  motion?: MotionType
  motionStrength?: number
  grade?: Partial<Grade>
  /** 照片按 virtual 矩形铺满，本图层只显示其中 rect 那一块（分屏切片效果） */
  virtual?: Rect
}

export interface ShapeLayer extends LayerBase {
  type: 'shape'
  shape: MaskType
  color: string
  color2?: string
  gradientAngle?: number
  radius?: number
  stroke?: number // 只描边，宽度相对画布短边
  shadow?: { blur: number; alpha: number; dx?: number; dy?: number; color?: string }
}

export type CharAnimType = 'pop' | 'drop' | 'rise' | 'fade' | 'typewriter' | 'wave' | 'zoom' | 'blur'

/** 逐字动画：每个字依次入场 */
export interface CharAnim {
  type: CharAnimType
  delay?: number // 第一个字开始的时间（秒）
  stagger?: number // 相邻两个字的间隔（秒）
  duration?: number // 每个字的动画时长（秒）
}

export interface TextLayer extends LayerBase {
  type: 'text'
  text: string
  style: TextStyle
  charAnim?: CharAnim
}

export interface DecorLayer extends LayerBase {
  type: 'decor'
  decor: string
  color?: string
  color2?: string
}

export interface ParticleLayer extends LayerBase {
  type: 'particles'
  particles: ParticleConfig
}

/** 品牌 Logo 图片（品牌设置里上传），rect.h 为 0 时按图片比例 */
export interface LogoLayer extends LayerBase {
  type: 'logo'
}

export type Layer = BgLayer | PhotoLayer | ShapeLayer | TextLayer | DecorLayer | ParticleLayer | LogoLayer

/** match：与画布同方向；cross：与画布方向相反（方形画布时两者都等于 any） */
export type SlotSpec = 'landscape' | 'portrait' | 'any' | 'match' | 'cross'

export interface BuildCtx {
  aspect: Aspect
  W: number
  H: number
  ar: number // 宽 / 高
  seed: number
  dur: number // 场景时长（秒）
  rand: () => number
  t: TemplatePalette
  fonts: Template['fonts']
  /** 每个槽位里实际照片的方向，便于版式微调 */
  orient: ('landscape' | 'portrait' | 'square' | null)[]
}

export interface TemplatePalette {
  bg: string
  primary: string
  accent: string
  text: string
  textSoft: string
}

export interface SceneStyle {
  id: string
  name: string
  slots: SlotSpec[]
  weight?: number
  energy?: [number, number]
  durationFactor?: number
  aspects?: Aspect[] // 不填表示全部支持
  captionKey?: boolean // 版式里有可编辑的字幕
  /** 需要照片带商品价格（蛋糕店产品卡等），门店环境这类没价格的照片不会被分到这个版式 */
  needsProduct?: boolean
  build: (ctx: BuildCtx) => Layer[]
}

export interface TransitionChoice {
  name: string
  weight: number
  beats?: number
}

export type TemplateCategory = '婚纱' | '中式' | '儿童' | '旅行' | '写真' | '家庭' | '毕业' | '烘焙' | '节日' | '宠物'

export interface Template {
  id: string
  name: string
  category: TemplateCategory
  description: string
  tags: string[]
  palette: TemplatePalette
  fonts: { title: FontKey; body: FontKey; script?: FontKey }
  grade: Partial<Grade>
  post: { vignette: number; grain: number; leak: number }
  background: BgFill
  overlay?: ParticleConfig[]
  transitions: TransitionChoice[]
  music: string
  pace: Pace
  intro: SceneStyle
  outro: SceneStyle
  styles: SceneStyle[]
  captions: string[]
  defaults: { title: string; subtitle: string; ending: string }
  coverColors: [string, string]
  /** 卡点特效：重拍时画面缩放脉冲 / 闪光 */
  beatFx?: 'none' | 'pulse' | 'flash' | 'both'
  /** 推荐画幅（蛋糕店模板默认竖屏） */
  defaultAspect?: Aspect
  /** 行业：影响片尾电话前缀等文案 */
  industry?: 'studio' | 'bakery'
}
