// 节日与生活模板：圣诞、新春、生日、萌宠、告白
import type { BuildCtx, Layer, Template, TextStyle } from '../engine/types'
import {
  blurFrame,
  decorAt,
  decorCenter,
  duo,
  fullscreen,
  grid4,
  heroTwo,
  intro,
  kind,
  outro,
  panes,
  polaroid,
  polaroidPair,
  shapeFrame,
  shortSide,
  stack,
  trio,
  ts,
  zoomPop
} from './styles'

const S = shortSide

// ---------------- 圣诞快乐 ----------------
const X = { bg: '#0f3d2e', primary: '#d62839', accent: '#f4d35e', text: '#fffaf0', textSoft: '#cfe3d6' }
const xmasTitle = (size: number, more: Partial<TextStyle> = {}): TextStyle =>
  ts('ZCOOLKuaiLe', size, '#fffaf0', { stroke: { color: '#d62839', width: 0.08 }, shadow: { color: 'rgba(0,0,0,0.35)', blur: 0.08, dy: 0.06 }, ...more })
const snowflakes = (c: BuildCtx): Layer[] =>
  [0, 1, 2].map((i) =>
    decorCenter(c, 'snowflake', c.W * [0.1, 0.88, 0.78][i], c.H * [0.14, 0.2, 0.86][i], S(c) * [0.08, 0.06, 0.05][i], 'rgba(255,255,255,0.85)', 1, {
      in: { type: 'pop', delay: 0.3 + i * 0.2 },
      loop: { type: 'spin', period: 10 + i * 3 }
    })
  )

export const christmas: Template = {
  id: 'christmas',
  name: '圣诞快乐',
  category: '节日',
  description: '墨绿与圣诞红、飘雪、圣诞树与礼物盒、卡点脉冲，适合圣诞写真、门店圣诞活动',
  tags: ['圣诞', '节日', '冬天', '活动'],
  palette: X,
  fonts: { title: 'ZCOOLKuaiLe', body: 'ZCOOLKuaiLe', script: 'GreatVibes' },
  grade: { exposure: 0.03, contrast: 1.05, saturation: 1.05, warmth: 0.12 },
  post: { vignette: 0.35, grain: 0.01, leak: 0.08 },
  background: { kind: 'gradient', colors: ['#14513b', '#08241b'], angle: 90 },
  overlay: [
    { type: 'snow', count: 70, colors: ['#ffffff'], opacity: 0.9, speed: 0.8 },
    { type: 'stars', count: 20, colors: ['#fff2c8'], opacity: 0.6 }
  ],
  beatFx: 'pulse',
  transitions: [
    { name: 'starOpen', weight: 2 },
    { name: 'fade', weight: 2 },
    { name: 'circleOpen', weight: 1.5 },
    { name: 'lightSweep', weight: 1.5 },
    { name: 'zoomThrough', weight: 1 },
    { name: 'polkaDots', weight: 1 }
  ],
  music: 'jingle-bells.mp3',
  pace: 'normal',
  intro: intro({
    id: 'xm-intro',
    withPhoto: true,
    photoFrame: { shape: 'circle', border: { width: 0.012, color: '#f4d35e' } },
    titleStyle: xmasTitle(0.12),
    titleChar: { type: 'pop', delay: 0.5, stagger: 0.14, duration: 0.6 },
    subStyle: ts('GreatVibes', 0.065, '#f4d35e'),
    dateStyle: ts('ZCOOLKuaiLe', 0.03, X.textSoft),
    decor: (c) => {
      const k = kind(c)
      return [
        decorAt(c, 'xmasTree', k === 'tall' ? c.W * 0.15 : c.W * 0.12, c.H * (k === 'tall' ? 0.74 : 0.56), S(c) * 0.24, '#2d8a5b', { in: { type: 'slideUp', delay: 0.3, duration: 0.9 } }, '#f4d35e'),
        decorAt(c, 'gift', k === 'tall' ? c.W * 0.85 : c.W * 0.88, c.H * (k === 'tall' ? 0.8 : 0.66), S(c) * 0.16, '#d62839', { in: { type: 'drop', delay: 0.6, duration: 1 } }, '#f4d35e'),
        ...snowflakes(c)
      ]
    }
  }),
  outro: outro({
    id: 'xm-outro',
    withPhoto: false,
    endStyle: xmasTitle(0.075, { lineHeight: 1.45 }),
    endChar: { type: 'rise', delay: 0.3, stagger: 0.08, duration: 0.7 },
    smallStyle: ts('ZCOOLKuaiLe', 0.032, X.textSoft),
    decor: (c) => [
      decorCenter(c, 'gift', c.W * 0.42, c.H * 0.18, S(c) * 0.12, '#d62839', 1, { in: { type: 'pop', delay: 0.2 } }, '#f4d35e'),
      decorCenter(c, 'gift', c.W * 0.58, c.H * 0.19, S(c) * 0.1, '#f4d35e', 1, { in: { type: 'pop', delay: 0.4 } }, '#d62839')
    ]
  }),
  styles: [
    polaroid({ id: 'xm-pola', card: '#fffaf0', caption: ts('ZCOOLKuaiLe', 0.045, '#8a1c24'), tape: '#d62839', weight: 3, decor: snowflakes }),
    zoomPop({ id: 'xm-pop', bg: { kind: 'template' }, border: { width: 0.01, color: '#f4d35e' }, radius: 0.03, shadow: { blur: 0.03, alpha: 0.5 }, weight: 2.5 }),
    duo({ id: 'xm-duo', border: { width: 0.01, color: '#fffaf0' }, radius: 0.04, anim: { type: 'pop', duration: 0.6 }, weight: 2.5 }),
    shapeFrame({ id: 'xm-circle', name: '圆形相框', shape: 'circle', ring: { color: '#f4d35e', width: 0.006 }, caption: xmasTitle(0.06, { lineHeight: 1.4 }), weight: 2 }),
    fullscreen({ id: 'xm-full', caption: xmasTitle(0.065), weight: 2 }),
    grid4({ id: 'xm-grid', border: { width: 0.008, color: '#fffaf0' }, radius: 0.05, weight: 1.2 }),
    stack({ id: 'xm-stack', card: '#fffaf0', weight: 1.2 })
  ],
  captions: ['圣诞快乐', '愿你被温柔以待', '礼物和你，都是最好的', '平安夜，平安喜乐', '一起等雪来', 'Merry Christmas'],
  defaults: { title: '圣诞快乐', subtitle: 'Merry Christmas', ending: '愿你岁岁平安\n年年喜乐' },
  coverColors: ['#0f3d2e', '#d62839']
}

// ---------------- 新春团圆 ----------------
const N = { bg: '#a30d14', primary: '#f5c451', accent: '#ffe8a3', text: '#ffe8a3', textSoft: '#f7cf86' }
const goldBrush = (size: number, more: Partial<TextStyle> = {}): TextStyle =>
  ts('MaShanZheng', size, N.text, { gradient: ['#fff3c4', '#e0a93a'], shadow: { color: 'rgba(60,0,0,0.5)', blur: 0.15 }, ...more })
const crackers = (c: BuildCtx): Layer[] => [
  decorAt(c, 'firecracker', c.W * 0.06, 0, S(c) * 0.09, '#e3242b', { in: { type: 'drop', delay: 0.3, duration: 1 }, loop: { type: 'sway', amp: 0.05, period: 2.4 } }, '#f5c451'),
  decorAt(c, 'firecracker', c.W * 0.94, 0, S(c) * 0.09, '#e3242b', { in: { type: 'drop', delay: 0.5, duration: 1 }, loop: { type: 'sway', amp: 0.05, period: 2.8 } }, '#f5c451')
]

export const newYear: Template = {
  id: 'new-year',
  name: '新春团圆',
  category: '节日',
  description: '中国红与鎏金、福字鞭炮灯笼、夜空烟花、卡点闪光，适合春节全家福、拜年视频、年货促销',
  tags: ['春节', '新年', '全家福', '喜庆'],
  palette: N,
  fonts: { title: 'MaShanZheng', body: 'ZCOOLXiaoWei' },
  grade: { exposure: 0.03, contrast: 1.06, saturation: 1.08, warmth: 0.15 },
  post: { vignette: 0.35, grain: 0.008, leak: 0.06 },
  background: { kind: 'radial', colors: ['#c8161d', '#6b0a0e'] },
  overlay: [
    { type: 'fireworks', count: 160, colors: ['#ffd36b', '#ff6b6b', '#fff3c4', '#ffb347'], opacity: 0.9, size: [0.004, 0.009] },
    { type: 'goldDust', count: 30, colors: ['#ffd98a'], opacity: 0.6 }
  ],
  beatFx: 'flash',
  transitions: [
    { name: 'ink', weight: 2 },
    { name: 'flash', weight: 2 },
    { name: 'splitOpen', weight: 1.5 },
    { name: 'burn', weight: 1.5 },
    { name: 'spinBlur', weight: 1 },
    { name: 'fade', weight: 1 }
  ],
  music: 'spring.mp3',
  pace: 'normal',
  intro: intro({
    id: 'ny-intro',
    withPhoto: false,
    titleStyle: goldBrush(0.15, { letterSpacing: 0.25 }),
    titleChar: { type: 'drop', delay: 0.6, stagger: 0.18, duration: 1 },
    subStyle: ts('ZCOOLXiaoWei', 0.045, N.textSoft, { letterSpacing: 0.4 }),
    dateStyle: ts('ZCOOLXiaoWei', 0.03, N.textSoft, { letterSpacing: 0.3 }),
    decor: (c) => [
      decorCenter(c, 'fu', c.W / 2, c.H * 0.22, S(c) * 0.26, '#e3242b', 1, { in: { type: 'rotateIn', duration: 1, distance: 1.2 }, loop: { type: 'sway', amp: 0.04, period: 3 } }, '#f5c451'),
      decorAt(c, 'lantern', c.W * 0.2, 0, S(c) * 0.12, '#e3242b', { in: { type: 'drop', delay: 0.2, duration: 1.2 }, loop: { type: 'sway', amp: 0.06, period: 3 } }, '#f5c451'),
      decorAt(c, 'lantern', c.W * 0.8, 0, S(c) * 0.12, '#e3242b', { in: { type: 'drop', delay: 0.4, duration: 1.2 }, loop: { type: 'sway', amp: 0.06, period: 3.4 } }, '#f5c451'),
      ...crackers(c),
      decorCenter(c, 'auspiciousCloud', c.W * 0.5, c.H * 0.9, S(c) * 0.34, 'rgba(245,196,81,0.5)', 0.5, { in: { type: 'slideUp', delay: 1 } })
    ]
  }),
  outro: outro({
    id: 'ny-outro',
    withPhoto: false,
    endStyle: goldBrush(0.085, { lineHeight: 1.5 }),
    endChar: { type: 'fade', delay: 0.3, stagger: 0.12, duration: 0.8 },
    smallStyle: ts('ZCOOLXiaoWei', 0.032, N.textSoft, { letterSpacing: 0.3 }),
    decor: (c) => [decorCenter(c, 'fu', c.W / 2, c.H * 0.17, S(c) * 0.16, '#e3242b', 1, { in: { type: 'pop', delay: 0.2 } }, '#f5c451'), ...crackers(c)]
  }),
  styles: [
    blurFrame({ id: 'ny-frame', name: '鎏金相框', bg: { kind: 'template' }, border: { width: 0.008, color: '#f5c451' }, shadow: { blur: 0.03, alpha: 0.5 }, decor: crackers, weight: 3 }),
    blurFrame({ id: 'ny-side', name: '相框+祝福', side: 'right', bg: { kind: 'template' }, border: { width: 0.008, color: '#f5c451' }, caption: goldBrush(0.07, { lineHeight: 1.5 }), weight: 2.5 }),
    shapeFrame({ id: 'ny-circle', name: '团圆圆框', shape: 'circle', ring: { color: '#f5c451', width: 0.006 }, caption: goldBrush(0.065, { lineHeight: 1.5 }), weight: 2 }),
    duo({ id: 'ny-duo', border: { width: 0.008, color: '#f5c451' }, weight: 2 }),
    trio({ id: 'ny-trio', border: { width: 0.006, color: '#f5c451' } }),
    heroTwo({ id: 'ny-hero', border: { width: 0.006, color: '#f5c451' } }),
    fullscreen({ id: 'ny-full', caption: goldBrush(0.07), weight: 1.5 })
  ],
  captions: ['新春快乐', '阖家团圆', '福气满满', '岁岁平安', '万事如意', '团圆的味道'],
  defaults: { title: '新春快乐', subtitle: '阖家团圆 · 万事如意', ending: '新的一年\n平安喜乐 万事胜意' },
  coverColors: ['#a30d14', '#f5c451']
}

// ---------------- 生日派对 ----------------
const B = { bg: '#2b1055', primary: '#ff5ea8', accent: '#ffd23f', text: '#ffffff', textSoft: '#e0c3ff' }
const partyTitle = (size: number, more: Partial<TextStyle> = {}): TextStyle =>
  ts('ZCOOLKuaiLe', size, '#ffffff', { gradient: ['#ffe066', '#ff5ea8'], stroke: { color: '#ffffff', width: 0.06 }, shadow: { color: 'rgba(0,0,0,0.4)', blur: 0.1, dy: 0.06 }, ...more })
const balloons = (c: BuildCtx): Layer[] => [
  decorAt(c, 'balloon', c.W * 0.08, c.H * 0.1, S(c) * 0.1, '#ff5ea8', { in: { type: 'flyUp', duration: 1.4 }, loop: { type: 'float', amp: 0.015, period: 3 } }, '#ffffff'),
  decorAt(c, 'balloon', c.W * 0.15, c.H * 0.2, S(c) * 0.08, '#ffd23f', { in: { type: 'flyUp', duration: 1.6, delay: 0.15 }, loop: { type: 'float', amp: 0.015, period: 3.4 } }, '#ffffff'),
  decorAt(c, 'balloon', c.W * 0.9, c.H * 0.12, S(c) * 0.1, '#4cc3ff', { in: { type: 'flyUp', duration: 1.5, delay: 0.1 }, loop: { type: 'float', amp: 0.015, period: 3.2 } }, '#ffffff')
]

export const birthday: Template = {
  id: 'birthday',
  name: '生日派对',
  category: '节日',
  description: '紫色派对夜、气球彩纸、蛋糕蜡烛、生日快乐歌、卡点脉冲加闪光，适合生日 vlog、宝宝周岁、蛋糕店生日蛋糕',
  tags: ['生日', '派对', '周岁', '蛋糕'],
  palette: B,
  fonts: { title: 'ZCOOLKuaiLe', body: 'ZCOOLKuaiLe', script: 'Pacifico' },
  grade: { exposure: 0.04, contrast: 1.06, saturation: 1.12, warmth: 0.06 },
  post: { vignette: 0.3, grain: 0, leak: 0.1 },
  background: { kind: 'gradient', colors: ['#3a1c71', '#1c0b3a'], angle: 90 },
  overlay: [
    { type: 'confetti', count: 30, colors: ['#ff5ea8', '#ffd23f', '#4cc3ff', '#7ed957', '#ffffff'], opacity: 0.9, speed: 0.6 },
    { type: 'bokeh', count: 10, colors: ['#ff5ea8', '#9b8cff', '#ffd23f'], opacity: 0.3 }
  ],
  beatFx: 'both',
  transitions: [
    { name: 'polkaDots', weight: 2 },
    { name: 'gridFlip', weight: 1.5 },
    { name: 'circleOpen', weight: 1.5 },
    { name: 'zoomThrough', weight: 1.5 },
    { name: 'starOpen', weight: 1 },
    { name: 'pushLeft', weight: 1 }
  ],
  music: 'happy-birthday.mp3',
  pace: 'fast',
  intro: intro({
    id: 'bd-intro',
    withPhoto: true,
    photoFrame: { shape: 'circle', border: { width: 0.014, color: '#ffffff' } },
    titleStyle: partyTitle(0.13),
    titleChar: { type: 'pop', delay: 0.5, stagger: 0.12, duration: 0.55 },
    subStyle: ts('Pacifico', 0.05, '#ffd23f'),
    dateStyle: ts('ZCOOLKuaiLe', 0.03, B.textSoft),
    decor: (c) => [...balloons(c), decorCenter(c, 'cake', kind(c) === 'tall' ? c.W * 0.82 : c.W * 0.86, c.H * 0.78, S(c) * 0.18, '#ffffff', 0.875, { in: { type: 'drop', delay: 0.8, duration: 1 } }, '#ff9fc8')]
  }),
  outro: outro({
    id: 'bd-outro',
    withPhoto: false,
    endStyle: partyTitle(0.08, { lineHeight: 1.4 }),
    endChar: { type: 'wave', delay: 0.3, stagger: 0.06, duration: 0.5 },
    smallStyle: ts('ZCOOLKuaiLe', 0.034, B.textSoft),
    decor: (c) => [decorCenter(c, 'cake', c.W / 2, c.H * 0.18, S(c) * 0.2, '#ffffff', 0.875, { in: { type: 'pop', delay: 0.2 } }, '#ff9fc8'), ...balloons(c)]
  }),
  styles: [
    zoomPop({ id: 'bd-pop', bg: { kind: 'template' }, border: { width: 0.012, color: '#ffffff' }, radius: 0.06, shadow: { blur: 0.03, alpha: 0.5 }, weight: 3, decor: balloons }),
    polaroid({ id: 'bd-pola', card: '#ffffff', caption: ts('ZCOOLKuaiLe', 0.045, '#6a2c91'), tape: '#ff5ea8', weight: 2.5 }),
    polaroidPair({ id: 'bd-pair', weight: 2 }),
    grid4({ id: 'bd-grid', border: { width: 0.008, color: '#ffffff' }, radius: 0.08, weight: 1.5 }),
    duo({ id: 'bd-duo', border: { width: 0.01, color: '#ffffff' }, radius: 0.06, anim: { type: 'pop', duration: 0.55 }, weight: 2 }),
    shapeFrame({ id: 'bd-heart', name: '爱心相框', shape: 'heart', caption: partyTitle(0.06, { lineHeight: 1.4 }), weight: 1.5 }),
    stack({ id: 'bd-stack', weight: 1.2 })
  ],
  captions: ['生日快乐', '又长大了一岁', '许个愿吧', '今天你最大', '愿你永远开心', '吹蜡烛啦'],
  defaults: { title: '生日快乐', subtitle: 'Happy Birthday', ending: '愿你所愿皆所得\n岁岁有今朝' },
  coverColors: ['#2b1055', '#ff5ea8']
}

// ---------------- 萌宠日记 ----------------
const P = { bg: '#fff6e5', primary: '#ff8a3d', accent: '#3bb3a3', text: '#5b3a1e', textSoft: '#9c7a55' }
const paws = (c: BuildCtx): Layer[] => {
  const k = kind(c)
  const pts = k === 'tall' ? [[0.12, 0.9], [0.22, 0.84], [0.3, 0.92], [0.4, 0.86]] : [[0.05, 0.86], [0.1, 0.78], [0.15, 0.88], [0.2, 0.8]]
  return pts.map(([x, y], i) => decorCenter(c, 'paw', c.W * x, c.H * y, S(c) * 0.06, 'rgba(255,138,61,0.55)', 1, { rotation: 20 + i * 8, in: { type: 'pop', delay: 0.5 + i * 0.18, duration: 0.4 } }))
}

export const pets: Template = {
  id: 'pets',
  name: '萌宠日记',
  category: '宠物',
  description: '奶油黄波点、爪印与骨头、拍立得和手写字幕，适合猫狗日常、宠物店、宠物摄影',
  tags: ['宠物', '猫', '狗', '可爱'],
  palette: P,
  fonts: { title: 'ZCOOLKuaiLe', body: 'ZCOOLKuaiLe', script: 'Caveat' },
  grade: { exposure: 0.05, contrast: 1.03, saturation: 1.06, warmth: 0.1 },
  post: { vignette: 0.05, grain: 0.006, leak: 0.04 },
  background: { kind: 'pattern', pattern: 'dots', color: '#fff6e5', color2: '#ffe6bf' },
  overlay: [{ type: 'hearts', count: 8, colors: ['#ff8a3d', '#ffb38a'], opacity: 0.5, speed: 0.6 }],
  beatFx: 'pulse',
  transitions: [
    { name: 'slideZoom', weight: 2 },
    { name: 'polkaDots', weight: 1.5 },
    { name: 'circleOpen', weight: 1.5 },
    { name: 'pushLeft', weight: 1.5 },
    { name: 'diagonalWipe', weight: 1 },
    { name: 'heart', weight: 1 }
  ],
  music: 'apple-cider.mp3',
  pace: 'normal',
  intro: intro({
    id: 'pt-intro',
    withPhoto: true,
    photoFrame: { shape: 'circle', border: { width: 0.014, color: '#ffffff' } },
    titleStyle: ts('ZCOOLKuaiLe', 0.11, P.text, { stroke: { color: '#ffffff', width: 0.08 } }),
    titleChar: { type: 'rise', delay: 0.4, stagger: 0.12, duration: 0.7 },
    subStyle: ts('Caveat', 0.06, P.primary, { weight: 700 }),
    dateStyle: ts('ZCOOLKuaiLe', 0.03, P.textSoft),
    decor: (c) => [...paws(c), decorCenter(c, 'bone', kind(c) === 'tall' ? c.W * 0.8 : c.W * 0.86, c.H * 0.2, S(c) * 0.16, '#e8b77a', 0.4, { rotation: -20, in: { type: 'drop', delay: 0.6 }, loop: { type: 'sway', amp: 0.1, period: 2.4 } })]
  }),
  outro: outro({
    id: 'pt-outro',
    withPhoto: false,
    endStyle: ts('ZCOOLKuaiLe', 0.075, P.text, { lineHeight: 1.45 }),
    endChar: { type: 'pop', delay: 0.3, stagger: 0.1, duration: 0.5 },
    smallStyle: ts('ZCOOLKuaiLe', 0.032, P.textSoft),
    decor: (c) => [decorCenter(c, 'paw', c.W / 2, c.H * 0.2, S(c) * 0.12, '#ff8a3d', 1, { in: { type: 'pop', delay: 0.2 }, loop: { type: 'pulse', amp: 0.06, period: 1.4 } })]
  }),
  styles: [
    polaroid({ id: 'pt-pola', caption: ts('Caveat', 0.055, P.text, { weight: 700 }), tape: '#3bb3a3', weight: 3, decor: paws }),
    polaroid({ id: 'pt-pola2', name: '拍立得·中文', caption: ts('ZCOOLKuaiLe', 0.045, P.text), tape: '#ff8a3d', weight: 2 }),
    polaroidPair({ id: 'pt-pair', weight: 2 }),
    zoomPop({ id: 'pt-pop', bg: { kind: 'template' }, border: { width: 0.012, color: '#ffffff' }, radius: 0.06, shadow: { blur: 0.02, alpha: 0.25 }, weight: 2 }),
    shapeFrame({ id: 'pt-circle', shape: 'circle', ring: { color: '#ff8a3d', width: 0.008 }, caption: ts('ZCOOLKuaiLe', 0.06, P.text, { lineHeight: 1.4 }), weight: 1.5, decor: paws }),
    duo({ id: 'pt-duo', border: { width: 0.01, color: '#ffffff' }, radius: 0.06, anim: { type: 'pop', duration: 0.6 } }),
    grid4({ id: 'pt-grid', border: { width: 0.008, color: '#ffffff' }, radius: 0.08 }),
    fullscreen({ id: 'pt-full', caption: ts('ZCOOLKuaiLe', 0.065, '#ffffff', { stroke: { color: '#ff8a3d', width: 0.08 } }), weight: 1.5 })
  ],
  captions: ['今天也是乖宝宝', '要摸摸头吗', '干饭第一名', '我的快乐源泉', '毛茸茸的幸福', '出去玩咯'],
  defaults: { title: '我家毛孩子', subtitle: 'My Little Buddy', ending: '谢谢你\n陪我长大' },
  coverColors: ['#fff6e5', '#ff8a3d']
}

// ---------------- 告白时刻 ----------------
const V = { bg: '#3d0a1e', primary: '#ff4d6d', accent: '#ffb3c1', text: '#fff0f3', textSoft: '#ffb3c1' }
const loveText = (size: number, more: Partial<TextStyle> = {}): TextStyle =>
  ts('ZCOOLXiaoWei', size, V.text, { letterSpacing: 0.2, shadow: { color: 'rgba(255,77,109,0.6)', blur: 0.4 }, ...more })
const roses = (c: BuildCtx): Layer[] => [
  decorAt(c, 'rose', c.W * 0.08, c.H * 0.62, S(c) * 0.12, '#ff4d6d', { rotation: -12, in: { type: 'slideUp', delay: 0.5 } }, '#2d6a4f'),
  decorAt(c, 'rose', c.W * 0.92, c.H * 0.64, S(c) * 0.11, '#ff4d6d', { rotation: 14, in: { type: 'slideUp', delay: 0.7 } }, '#2d6a4f')
]

export const valentine: Template = {
  id: 'valentine',
  name: '告白时刻',
  category: '婚纱',
  description: '酒红夜色、爱心飘升、玫瑰与爱心相框、逐字浮现的告白文案，适合情人节、纪念日、求婚视频',
  tags: ['情人节', '告白', '纪念日', '求婚'],
  palette: V,
  fonts: { title: 'ZCOOLXiaoWei', body: 'ZCOOLXiaoWei', script: 'GreatVibes' },
  grade: { exposure: 0.02, contrast: 1.05, saturation: 1.02, warmth: 0.12, splitShadow: '#5a1a3a', splitHighlight: '#ffd0d8', splitAmount: 0.12 },
  post: { vignette: 0.45, grain: 0.01, leak: 0.15 },
  background: { kind: 'radial', colors: ['#7a1236', '#2a0613'] },
  overlay: [
    { type: 'hearts', count: 16, colors: ['#ff4d6d', '#ffb3c1', '#ff8fa3'], opacity: 0.8, speed: 0.7 },
    { type: 'bokeh', count: 10, colors: ['#ff8fa3', '#ffd0d8'], opacity: 0.3 }
  ],
  beatFx: 'pulse',
  transitions: [
    { name: 'heart', weight: 2.5 },
    { name: 'dreamy', weight: 1.5 },
    { name: 'fade', weight: 1.5 },
    { name: 'flash', weight: 1 },
    { name: 'spinBlur', weight: 1 },
    { name: 'lightSweep', weight: 1 }
  ],
  music: 'clair-de-lune.mp3',
  pace: 'slow',
  intro: intro({
    id: 'vl-intro',
    withPhoto: true,
    photoFrame: { shape: 'heart' },
    titleStyle: loveText(0.1, { letterSpacing: 0.3 }),
    titleChar: { type: 'blur', delay: 0.6, stagger: 0.22, duration: 1 },
    subStyle: ts('GreatVibes', 0.065, '#ffb3c1'),
    dateStyle: ts('PlayfairDisplay', 0.026, V.textSoft, { letterSpacing: 0.5 }),
    decor: roses
  }),
  outro: outro({
    id: 'vl-outro',
    withPhoto: true,
    dim: 0.6,
    endStyle: loveText(0.072, { lineHeight: 1.6 }),
    endChar: { type: 'fade', delay: 0.4, stagger: 0.14, duration: 0.9 },
    smallStyle: ts('ZCOOLXiaoWei', 0.03, V.textSoft, { letterSpacing: 0.3 }),
    decor: (c) => [decorCenter(c, 'heart', c.W / 2, c.H * 0.2, S(c) * 0.1, '#ff4d6d', 0.9, { in: { type: 'pop', delay: 0.2 }, loop: { type: 'pulse', amp: 0.1, period: 1 } })]
  }),
  styles: [
    shapeFrame({ id: 'vl-heart', name: '爱心相框', shape: 'heart', caption: loveText(0.055, { lineHeight: 1.6 }), weight: 3 }),
    blurFrame({ id: 'vl-side', name: '相框+告白', side: 'left', border: { width: 0.006, color: '#ffb3c1' }, caption: loveText(0.055, { lineHeight: 1.6 }), dim: 0.55, weight: 2.5 }),
    fullscreen({ id: 'vl-full', caption: loveText(0.055), weight: 2 }),
    duo({ id: 'vl-duo', border: { width: 0.006, color: '#ffb3c1' }, shadow: { blur: 0.03, alpha: 0.5 }, weight: 2 }),
    polaroidPair({ id: 'vl-pair', weight: 1.5 }),
    panes({ id: 'vl-panes', count: 3 }),
    zoomPop({ id: 'vl-pop', border: { width: 0.006, color: '#ffb3c1' }, shadow: { blur: 0.04, alpha: 0.6 } })
  ],
  captions: ['遇见你是我最大的幸运', '余生都是你', '我的心只为你跳动', '和你在一起的每一天', '你是我的例外', '往后余生，风雪是你'],
  defaults: { title: '告白时刻', subtitle: 'Love You Forever', ending: '往后余生\n只想和你一起' },
  coverColors: ['#3d0a1e', '#ff4d6d']
}
