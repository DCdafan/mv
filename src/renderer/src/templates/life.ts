import type { BuildCtx, Layer, Template } from '../engine/types'
import {
  blurFrame,
  decorAt,
  decorCenter,
  duo,
  filmStrip,
  fullscreen,
  grid4,
  heroTwo,
  intro,
  magazine,
  outro,
  panes,
  polaroid,
  polaroidPair,
  shapeFrame,
  stack,
  text,
  trio,
  ts,
  zoomPop,
  kind,
  pxc
} from './styles'

const S = (c: BuildCtx): number => Math.min(c.W, c.H)

// ---------------- 童趣乐园 ----------------
const K = { bg: '#ffe58a', primary: '#ff7a59', accent: '#4cc3ff', text: '#5a3b1e', textSoft: '#8a6a3e' }
const kidTitle = (size: number, color = '#ffffff', more = {}): ReturnType<typeof ts> =>
  ts('ZCOOLKuaiLe', size, color, { stroke: { color: '#ff7a59', width: 0.09 }, shadow: { color: 'rgba(90,40,0,0.35)', blur: 0.05, dy: 0.08 }, ...more })
const kidFrame = { border: { width: 0.012, color: '#ffffff' }, radius: 0.08, shadow: { blur: 0.02, alpha: 0.3, dy: 0.012 } }
const balloons = (c: BuildCtx): Layer[] => [
  decorAt(c, 'balloon', c.W * 0.07, c.H * 0.08, S(c) * 0.1, '#ff6b6b', { in: { type: 'flyUp', duration: 1.4 }, loop: { type: 'float', amp: 0.015, period: 3 } }, '#ffffff'),
  decorAt(c, 'balloon', c.W * 0.93, c.H * 0.14, S(c) * 0.09, '#4cc3ff', { in: { type: 'flyUp', duration: 1.6, delay: 0.2 }, loop: { type: 'float', amp: 0.015, period: 3.6 } }, '#ffffff')
]
const stars = (c: BuildCtx): Layer[] =>
  [0, 1, 2].map((i) =>
    decorCenter(c, 'star', c.W * [0.08, 0.92, 0.85][i], c.H * [0.85, 0.82, 0.12][i], S(c) * [0.07, 0.05, 0.06][i], ['#ffd23f', '#ff7a59', '#4cc3ff'][i], 1, {
      in: { type: 'pop', delay: 0.4 + i * 0.15 },
      loop: { type: 'spin', period: 8 + i * 2 }
    })
  )

export const kidsFun: Template = {
  id: 'kids-fun',
  name: '童趣乐园',
  category: '儿童',
  description: '明快撞色、气球星星、圆角相框弹跳入场，适合儿童写真、生日派对',
  tags: ['儿童', '生日', '活泼', '卡通'],
  palette: K,
  fonts: { title: 'ZCOOLKuaiLe', body: 'ZCOOLKuaiLe', script: 'Pacifico' },
  grade: { exposure: 0.05, contrast: 1.05, saturation: 1.15, warmth: 0.08 },
  post: { vignette: 0, grain: 0, leak: 0 },
  background: { kind: 'pattern', pattern: 'dots', color: '#ffe58a', color2: '#ffd54f' },
  overlay: [{ type: 'bubbles', count: 16, colors: ['#ffffff'], opacity: 0.7 }],
  transitions: [
    { name: 'circleOpen', weight: 2 },
    { name: 'pushLeft', weight: 2 },
    { name: 'heart', weight: 1 },
    { name: 'mosaic', weight: 1.5 },
    { name: 'swirl', weight: 1 },
    { name: 'zoomThrough', weight: 1.5 },
    { name: 'pushUp', weight: 1 },
    { name: 'diamond', weight: 1 }
  ],
  music: 'childrens-march.mp3',
  pace: 'fast',
  intro: intro({
    id: 'k-intro',
    withPhoto: true,
    photoFrame: { shape: 'circle', border: { width: 0.014, color: '#ffffff' } },
    titleStyle: kidTitle(0.12),
    titleChar: { type: 'drop', delay: 0.4, stagger: 0.14, duration: 0.9 },
    subStyle: ts('Pacifico', 0.045, '#ff7a59'),
    dateStyle: ts('ZCOOLKuaiLe', 0.03, K.textSoft),
    titleAnim: { type: 'pop', delay: 0.5, duration: 0.8 },
    decor: (c) => [...balloons(c), ...stars(c)]
  }),
  outro: outro({
    id: 'k-outro',
    withPhoto: false,
    endStyle: kidTitle(0.08, '#ffffff', { lineHeight: 1.4 }),
    smallStyle: ts('ZCOOLKuaiLe', 0.035, K.text),
    decor: (c) => [...balloons(c), { type: 'particles', rect: { x: 0, y: 0, w: 1, h: 1 }, particles: { type: 'confetti', count: 60, colors: ['#ff7a59', '#4cc3ff', '#ffd23f', '#7ed957', '#ff9ff3'] } }]
  }),
  styles: [
    zoomPop({ id: 'k-pop', bg: { kind: 'template' }, ...kidFrame, weight: 3, decor: stars }),
    duo({ id: 'k-duo', ...kidFrame, anim: { type: 'pop', duration: 0.6 }, weight: 3 }),
    trio({ id: 'k-trio', ...kidFrame, anim: { type: 'drop', duration: 0.9, distance: 0.4 } }),
    grid4({ id: 'k-grid', ...kidFrame, radius: 0.1, weight: 2 }),
    polaroid({
      id: 'k-pola',
      caption: ts('ZCOOLKuaiLe', 0.045, K.text),
      tape: '#7ed957',
      weight: 2,
      decor: (c) => balloons(c)
    }),
    shapeFrame({ id: 'k-circle', shape: 'circle', ring: { color: '#ffffff', width: 0.01 }, caption: kidTitle(0.06, '#ffffff', { lineHeight: 1.4 }), weight: 1.5, decor: stars }),
    fullscreen({ id: 'k-full', weight: 1.5, caption: kidTitle(0.06) }),
    stack({ id: 'k-stack' })
  ],
  captions: ['今天也是快乐的一天', '我是最棒的小朋友', '和小伙伴一起玩耍', '吃饱饱才能长高高', '我的超能力是可爱', '笑一个吧', '探险出发！', '许个愿望吧'],
  defaults: { title: '快乐童年', subtitle: 'Happy Childhood', ending: '愿你永远\n天真可爱' },
  coverColors: ['#ffe58a', '#ff7a59']
}

// ---------------- 宝宝成长记 ----------------
const B = { bg: '#fdf1f3', primary: '#f4a7b9', accent: '#a7d8f4', text: '#7a5560', textSoft: '#b08b95' }
const babyCap = ts('ZCOOLKuaiLe', 0.045, B.text)

export const babyDiary: Template = {
  id: 'baby-diary',
  name: '宝宝成长记',
  category: '儿童',
  description: '粉蓝马卡龙色、拍立得与胶带、爱心飘升，记录宝宝的每一个瞬间',
  tags: ['宝宝', '百天', '周岁', '温馨'],
  palette: B,
  fonts: { title: 'ZCOOLKuaiLe', body: 'ZCOOLKuaiLe', script: 'Caveat' },
  grade: { exposure: 0.1, contrast: 0.95, saturation: 0.95, warmth: 0.12, fade: 0.04 },
  post: { vignette: 0, grain: 0.008, leak: 0.06 },
  background: { kind: 'pattern', pattern: 'grid', color: '#fdf1f3', color2: '#f8dfe5' },
  overlay: [{ type: 'hearts', count: 12, colors: ['#f4a7b9', '#ffd1dc', '#a7d8f4'], opacity: 0.7, speed: 0.7 }],
  transitions: [
    { name: 'fade', weight: 3 },
    { name: 'heart', weight: 2 },
    { name: 'circleOpen', weight: 1.5 },
    { name: 'blurFade', weight: 1.5 },
    { name: 'wipeRight', weight: 1 },
    { name: 'dreamy', weight: 1 }
  ],
  music: 'happy-lullaby.mp3',
  pace: 'slow',
  intro: intro({
    id: 'b-intro',
    withPhoto: true,
    photoFrame: { shape: 'heart' },
    titleStyle: ts('ZCOOLKuaiLe', 0.1, B.text, { letterSpacing: 0.1 }),
    subStyle: ts('Caveat', 0.06, B.primary, { weight: 700 }),
    dateStyle: ts('ZCOOLKuaiLe', 0.03, B.textSoft),
    titleAnim: { type: 'pop', delay: 0.6 },
    decor: (c) => [
      decorCenter(c, 'cloud', c.W * 0.12, c.H * 0.15, S(c) * 0.18, '#ffffff', 0.58, { loop: { type: 'float', amp: 0.01, period: 4 }, in: { type: 'slideRight', delay: 0.4 } }),
      decorCenter(c, 'cloud', c.W * 0.88, c.H * 0.22, S(c) * 0.14, '#ffffff', 0.58, { loop: { type: 'float', amp: 0.01, period: 5 }, in: { type: 'slideLeft', delay: 0.6 } })
    ]
  }),
  outro: outro({
    id: 'b-outro',
    withPhoto: false,
    endStyle: ts('ZCOOLKuaiLe', 0.07, B.text, { lineHeight: 1.5 }),
    smallStyle: ts('ZCOOLKuaiLe', 0.032, B.textSoft),
    decor: (c) => [decorCenter(c, 'heart', c.W / 2, c.H * 0.2, S(c) * 0.1, B.primary, 0.9, { in: { type: 'pop', delay: 0.2 }, loop: { type: 'pulse', amp: 0.08, period: 1.2 } })]
  }),
  styles: [
    polaroid({ id: 'b-pola', caption: ts('Caveat', 0.055, B.text, { weight: 700 }), tape: '#a7d8f4', weight: 3 }),
    polaroid({ id: 'b-pola2', name: '拍立得·粉', caption: babyCap, tape: '#f4a7b9', weight: 2 }),
    polaroidPair({ id: 'b-pair', weight: 2.5 }),
    shapeFrame({ id: 'b-heart', shape: 'heart', caption: babyCap, weight: 1.5 }),
    shapeFrame({ id: 'b-circle', shape: 'circle', ring: { color: B.primary, width: 0.008 }, caption: babyCap, weight: 1.5 }),
    duo({ id: 'b-duo', border: { width: 0.01, color: '#ffffff' }, radius: 0.06, shadow: { blur: 0.02, alpha: 0.2 } }),
    grid4({ id: 'b-grid', border: { width: 0.008, color: '#ffffff' }, radius: 0.06, weight: 1 }),
    blurFrame({ id: 'b-blur', border: { width: 0.012, color: '#ffffff' }, radius: 0.04, dim: 0.15 })
  ],
  captions: ['你好呀，小宝贝', '第一次对世界微笑', '慢慢长大吧', '你是爸爸妈妈的小太阳', '每天都比昨天更可爱', '抱抱就不哭啦', '奶香味的小天使'],
  defaults: { title: '宝贝成长记', subtitle: 'Hello, Little One', ending: '谢谢你\n来到我们身边' },
  coverColors: ['#fdf1f3', '#a7d8f4']
}

// ---------------- 旅行日记 ----------------
const T = { bg: '#efe6d6', primary: '#2f6f73', accent: '#e07a5f', text: '#3d3a33', textSoft: '#7d7464' }
const hand = (size: number, color = T.text, more = {}): ReturnType<typeof ts> => ts('LongCang', size, color, { lineHeight: 1.4, ...more })

export const travelDiary: Template = {
  id: 'travel-diary',
  name: '旅行日记',
  category: '旅行',
  description: '牛皮纸手账风，拍立得、胶带、邮戳与纸飞机，手写体记录旅途',
  tags: ['旅行', '手账', '文艺', 'vlog'],
  palette: T,
  fonts: { title: 'LongCang', body: 'LongCang', script: 'Caveat' },
  grade: { exposure: 0.02, contrast: 1.04, saturation: 1.02, warmth: 0.1, fade: 0.03 },
  post: { vignette: 0.22, grain: 0.03, leak: 0.08 },
  background: { kind: 'pattern', pattern: 'paper', color: '#efe6d6', color2: '#d9cbb2' },
  transitions: [
    { name: 'slideZoom', weight: 2.5 },
    { name: 'pushLeft', weight: 2 },
    { name: 'wipeLeft', weight: 1.5 },
    { name: 'flash', weight: 1.5 },
    { name: 'fade', weight: 1.5 },
    { name: 'pushRight', weight: 1 }
  ],
  music: 'apple-cider.mp3',
  pace: 'normal',
  intro: intro({
    id: 't-intro',
    titleStyle: hand(0.14, '#ffffff', { shadow: { color: 'rgba(0,0,0,0.5)', blur: 0.2 } }),
    titleChar: { type: 'typewriter', delay: 0.5, stagger: 0.2 },
    subStyle: ts('Caveat', 0.06, '#fff3dd', { weight: 700 }),
    dateStyle: ts('Montserrat', 0.026, '#ffffff', { letterSpacing: 0.4, weight: 600 }),
    overlay: 'rgba(20,30,30,0.35)',
    titleAnim: { type: 'reveal', delay: 0.4, duration: 1.4 },
    decor: (c) => [
      decorAt(c, 'plane', c.W * 0.8, c.H * 0.16, S(c) * 0.14, '#ffffff', { in: { type: 'flyLeft', duration: 1.6, delay: 0.3 }, loop: { type: 'float', amp: 0.01, period: 2.5 } }, '#d9e6e6'),
      decorCenter(c, 'stamp', c.W * 0.15, c.H * 0.8, S(c) * 0.2, 'rgba(255,255,255,0.85)', 1, { rotation: -14, in: { type: 'zoomOut', delay: 1.2, duration: 0.5, distance: 1.8 } })
    ]
  }),
  outro: outro({
    id: 't-outro',
    endStyle: hand(0.085, '#ffffff', { shadow: { color: 'rgba(0,0,0,0.5)', blur: 0.2 } }),
    smallStyle: ts('Montserrat', 0.028, '#f5ecdc', { letterSpacing: 0.3, weight: 500 }),
    decor: (c) => [decorAt(c, 'plane', c.W * 0.5, c.H * 0.1, S(c) * 0.1, '#ffffff', { in: { type: 'flyRight', duration: 1.4 } }, '#d9e6e6')]
  }),
  styles: [
    polaroid({
      id: 't-pola',
      caption: hand(0.05),
      tape: '#e07a5f',
      weight: 3,
      decor: (c) => [decorCenter(c, 'stamp', kind(c) === 'tall' ? c.W * 0.8 : c.W * 0.84, c.H * 0.2, S(c) * 0.18, 'rgba(47,111,115,0.7)', 1, { rotation: 12, in: { type: 'zoomOut', delay: 1, duration: 0.4, distance: 1.8 } })]
    }),
    polaroidPair({ id: 't-pair', weight: 2.5 }),
    stack({ id: 't-stack', weight: 2 }),
    filmStrip({ id: 't-film', weight: 1.5 }),
    fullscreen({ id: 't-full', weight: 2.5, caption: hand(0.065, '#ffffff', { shadow: { color: 'rgba(0,0,0,0.6)', blur: 0.2 } }) }),
    blurFrame({ id: 't-blur', side: 'left', border: { width: 0.01, color: '#fffaf0' }, caption: hand(0.065, '#ffffff', { shadow: { color: 'rgba(0,0,0,0.5)', blur: 0.2 } }), weight: 2 }),
    heroTwo({ id: 't-hero', border: { width: 0.006, color: '#fffaf0' } }),
    magazine({ id: 't-mag', caption: hand(0.075), accent: T.accent, weight: 1.2 })
  ],
  captions: ['去见想见的人，去看想看的风景', '在路上', '风景在远方，也在身旁', '把日子过成诗', '世界那么大', '今天的云很好看', '记住这一刻的阳光', '下一站，去哪儿'],
  defaults: { title: '旅行日记', subtitle: 'Travel Diary', ending: '世界很大\n我们一起去看看' },
  coverColors: ['#efe6d6', '#2f6f73']
}

// ---------------- 时尚大片 ----------------
const F = { bg: '#0b0b0b', primary: '#e8283c', accent: '#ffffff', text: '#ffffff', textSoft: '#bdbdbd' }
const bold = (size: number, color = '#ffffff', more = {}): ReturnType<typeof ts> => ts('Montserrat', size, color, { weight: 800, letterSpacing: 0.12, uppercase: true, ...more })

export const fashion: Template = {
  id: 'fashion',
  name: '时尚大片',
  category: '写真',
  description: '黑白高对比 + 红色点缀、粗体排版、故障与快切，适合个人写真和街拍',
  tags: ['写真', '时尚', '酷', '快节奏'],
  palette: F,
  fonts: { title: 'Montserrat', body: 'Sans' },
  grade: { exposure: 0, contrast: 1.18, saturation: 0.75, warmth: -0.05, splitShadow: '#2a3a4a', splitHighlight: '#ffe0d0', splitAmount: 0.06 },
  post: { vignette: 0.3, grain: 0.035, leak: 0 },
  background: { kind: 'color', color: '#0b0b0b' },
  transitions: [
    { name: 'cut', weight: 2 },
    { name: 'glitch', weight: 2 },
    { name: 'pushUp', weight: 1.5 },
    { name: 'crossZoom', weight: 1.5 },
    { name: 'blinds', weight: 1 },
    { name: 'flash', weight: 1 },
    { name: 'pixelize', weight: 0.8 }
  ],
  music: 'summer-sunday.mp3',
  pace: 'fast',
  intro: intro({
    id: 'f-intro',
    titleStyle: bold(0.16, '#ffffff', { letterSpacing: 0.25 }),
    titleChar: { type: 'zoom', delay: 0.3, stagger: 0.08, duration: 0.5 },
    subStyle: bold(0.03, '#e8283c', { letterSpacing: 0.6, weight: 600 }),
    dateStyle: ts('Montserrat', 0.022, '#bdbdbd', { letterSpacing: 0.5 }),
    overlay: 'rgba(0,0,0,0.45)',
    titleAnim: { type: 'spread', delay: 0.3, duration: 0.9 },
    decor: (c) => [{ type: 'shape', shape: 'rect', rect: { x: 0.5 - (S(c) * 0.12) / c.W / 2, y: 0.62, w: (S(c) * 0.12) / c.W, h: (S(c) * 0.008) / c.H }, color: '#e8283c', in: { type: 'spread', delay: 0.9 } }]
  }),
  outro: outro({
    id: 'f-outro',
    withPhoto: false,
    endStyle: bold(0.08, '#ffffff', { lineHeight: 1.3 }),
    smallStyle: ts('Montserrat', 0.026, '#bdbdbd', { letterSpacing: 0.4, weight: 500 }),
    bg: { kind: 'color', color: '#0b0b0b' }
  }),
  styles: [
    fullscreen({ id: 'f-full', weight: 3, caption: bold(0.07, '#ffffff') }),
    panes({ id: 'f-panes', count: 3, gap: 0.012, weight: 2 }),
    panes({ id: 'f-panes4', name: '四分屏', count: 4, gap: 0.008, weight: 1.2 }),
    magazine({ id: 'f-mag', panel: '#f2f2f2', caption: bold(0.075, '#111111', { lineHeight: 1.2 }), accent: '#e8283c', weight: 2.5 }),
    magazine({ id: 'f-mag-dark', name: '杂志·黑', caption: bold(0.075, '#ffffff', { lineHeight: 1.2 }), accent: '#e8283c', weight: 1.5 }),
    trio({ id: 'f-trio', anim: { type: 'flyDown', duration: 0.5 }, weight: 2 }),
    duo({ id: 'f-duo', anim: { type: 'flyUp', duration: 0.5 } }),
    grid4({ id: 'f-grid', anim: { type: 'flipX', duration: 0.45 }, energy: [0.6, 1] })
  ],
  captions: ['BE YOURSELF', 'NO RULES', 'STAY WILD', 'CONFIDENCE', 'ICONIC', 'MOOD', 'STYLE IS ATTITUDE', 'BOLD & FREE'],
  defaults: { title: 'STYLE', subtitle: 'PORTRAIT COLLECTION', ending: 'BE\nYOURSELF' },
  coverColors: ['#0b0b0b', '#e8283c']
}

// ---------------- 胶片回忆 ----------------
const M = { bg: '#2a2420', primary: '#d9b382', accent: '#c4704f', text: '#f3e6d0', textSoft: '#bfa98a' }

export const filmMemory: Template = {
  id: 'film-memory',
  name: '胶片回忆',
  category: '家庭',
  description: '复古胶片调色、颗粒与漏光、行书字幕，适合家庭纪念、老照片、周年',
  tags: ['家庭', '复古', '纪念', '胶片'],
  palette: M,
  fonts: { title: 'ZhiMangXing', body: 'Serif' },
  grade: { exposure: 0.02, contrast: 1.02, saturation: 0.85, warmth: 0.3, fade: 0.08, splitShadow: '#3b5a5a', splitHighlight: '#ffcc8f', splitAmount: 0.14 },
  post: { vignette: 0.5, grain: 0.05, leak: 0.25 },
  background: { kind: 'radial', colors: ['#3a312a', '#15110e'] },
  overlay: [{ type: 'goldDust', count: 30, colors: ['#ffe2b8'], opacity: 0.5 }],
  transitions: [
    { name: 'fade', weight: 3 },
    { name: 'fadeBlack', weight: 2 },
    { name: 'burn', weight: 2 },
    { name: 'blurFade', weight: 1.5 },
    { name: 'flash', weight: 1 }
  ],
  music: 'morning.mp3',
  pace: 'slow',
  intro: intro({
    id: 'm-intro',
    titleStyle: ts('ZhiMangXing', 0.15, M.text, { shadow: { color: 'rgba(0,0,0,0.6)', blur: 0.2 } }),
    subStyle: ts('Serif', 0.038, M.textSoft, { letterSpacing: 0.5 }),
    dateStyle: ts('PlayfairDisplay', 0.026, M.textSoft, { letterSpacing: 0.5, italic: true }),
    overlay: 'rgba(20,12,6,0.45)',
    titleAnim: { type: 'reveal', delay: 0.5, duration: 1.8 }
  }),
  outro: outro({
    id: 'm-outro',
    endStyle: ts('ZhiMangXing', 0.09, M.text, { lineHeight: 1.4 }),
    smallStyle: ts('Serif', 0.03, M.textSoft, { letterSpacing: 0.4 }),
    dim: 0.55
  }),
  styles: [
    fullscreen({ id: 'm-full', weight: 3, caption: ts('Serif', 0.045, M.text, { letterSpacing: 0.3 }) }),
    filmStrip({ id: 'm-film', film: '#1a1612', holes: '#d9c7a8', weight: 2 }),
    polaroid({ id: 'm-pola', card: '#f1e6d2', caption: ts('ZhiMangXing', 0.05, '#4a3b2c'), weight: 2 }),
    blurFrame({ id: 'm-blur', border: { width: 0.012, color: '#f1e6d2' }, shadow: { blur: 0.03, alpha: 0.5 }, dim: 0.5, weight: 2.5 }),
    blurFrame({ id: 'm-blur-side', side: 'right', border: { width: 0.01, color: '#f1e6d2' }, caption: ts('ZhiMangXing', 0.07, M.text, { lineHeight: 1.4 }), dim: 0.55, weight: 2 }),
    stack({ id: 'm-stack', card: '#f1e6d2' }),
    duo({ id: 'm-duo', border: { width: 0.008, color: '#f1e6d2' } })
  ],
  captions: ['那些温暖的日子', '时光慢一些', '家是最温暖的地方', '记得那年夏天', '平凡的日子也闪着光', '有你们在，就是最好', '岁月静好'],
  defaults: { title: '时光记忆', subtitle: '那些温暖的日子', ending: '时光会老\n爱不会' },
  coverColors: ['#2a2420', '#d9b382']
}

// ---------------- 青春毕业季 ----------------
const G = { bg: '#14284b', primary: '#f2c14e', accent: '#5ec2e8', text: '#ffffff', textSoft: '#b9c7e0' }

export const graduation: Template = {
  id: 'graduation',
  name: '青春不散场',
  category: '毕业',
  description: '藏青与金色、彩纸纷飞、学士帽与月桂，适合毕业照、班级纪念册',
  tags: ['毕业', '青春', '同学', '纪念'],
  palette: G,
  fonts: { title: 'ZCOOLKuaiLe', body: 'Sans', script: 'Montserrat' },
  grade: { exposure: 0.04, contrast: 1.06, saturation: 1.08 },
  post: { vignette: 0.25, grain: 0.01, leak: 0.06 },
  background: { kind: 'gradient', colors: ['#1d3a6b', '#0c1830'], angle: 90 },
  overlay: [{ type: 'confetti', count: 26, colors: ['#f2c14e', '#5ec2e8', '#ffffff', '#ff8fab'], opacity: 0.85, speed: 0.6 }],
  transitions: [
    { name: 'pushUp', weight: 2 },
    { name: 'circleOpen', weight: 1.5 },
    { name: 'flash', weight: 1.5 },
    { name: 'cube', weight: 1.5 },
    { name: 'zoomThrough', weight: 1.5 },
    { name: 'fade', weight: 1.5 },
    { name: 'clock', weight: 1 }
  ],
  music: 'spring.mp3',
  pace: 'normal',
  intro: intro({
    id: 'g-intro',
    withPhoto: false,
    titleStyle: ts('ZCOOLKuaiLe', 0.13, '#ffffff', { gradient: ['#ffffff', '#ffe29a'], shadow: { color: 'rgba(0,0,0,0.4)', blur: 0.1, dy: 0.05 } }),
    subStyle: ts('Montserrat', 0.04, '#f2c14e', { weight: 700, letterSpacing: 0.4, uppercase: true }),
    dateStyle: ts('Sans', 0.03, '#b9c7e0', { letterSpacing: 0.3 }),
    titleAnim: { type: 'pop', delay: 0.5 },
    decor: (c) => [
      decorCenter(c, 'laurel', c.W / 2, c.H * 0.44, S(c) * 0.62, 'rgba(242,193,78,0.35)', 1, { in: { type: 'zoomIn', duration: 1.2 } }),
      decorCenter(c, 'gradCap', c.W / 2, c.H * 0.2, S(c) * 0.16, '#0c1830', 0.78, { in: { type: 'drop', delay: 0.2, duration: 1.1 }, loop: { type: 'sway', amp: 0.08, period: 2.5 } }, '#f2c14e')
    ]
  }),
  outro: outro({
    id: 'g-outro',
    endStyle: ts('ZCOOLKuaiLe', 0.075, '#ffffff', { lineHeight: 1.5 }),
    smallStyle: ts('Sans', 0.03, '#b9c7e0', { letterSpacing: 0.3 }),
    decor: (c) => [decorCenter(c, 'gradCap', c.W / 2, c.H * 0.17, S(c) * 0.12, '#0c1830', 0.78, { in: { type: 'flyUp', duration: 1 } }, '#f2c14e')]
  }),
  styles: [
    fullscreen({ id: 'g-full', weight: 2.5, caption: ts('ZCOOLKuaiLe', 0.065, '#ffffff', { shadow: { color: 'rgba(0,0,0,0.5)', blur: 0.15 } }) }),
    heroTwo({ id: 'g-hero', border: { width: 0.006, color: '#f2c14e' }, weight: 2 }),
    trio({ id: 'g-trio', border: { width: 0.006, color: '#ffffff' }, weight: 2 }),
    duo({ id: 'g-duo', border: { width: 0.008, color: '#ffffff' } }),
    grid4({ id: 'g-grid', border: { width: 0.005, color: '#ffffff' }, weight: 1.5 }),
    blurFrame({ id: 'g-blur', side: 'left', border: { width: 0.008, color: '#f2c14e' }, caption: ts('ZCOOLKuaiLe', 0.065, '#ffffff', { lineHeight: 1.4 }), weight: 2 }),
    shapeFrame({
      id: 'g-hex',
      shape: 'hexagon',
      ring: { color: '#f2c14e', width: 0.006 },
      caption: ts('ZCOOLKuaiLe', 0.06, '#ffffff', { lineHeight: 1.4 }),
      decor: (c) => [decorCenter(c, 'laurel', kind(c) === 'tall' ? c.W / 2 : c.W * 0.36, c.H * 0.5, S(c) * 0.9, 'rgba(242,193,78,0.25)', 1, { in: { type: 'fade', duration: 1 } })]
    })
  ],
  captions: ['青春不散场', '我们的故事未完待续', '感谢遇见', '愿你前程似锦', '那年我们正青春', '一起走过的日子', '致我们终将逝去的青春'],
  defaults: { title: '青春不散场', subtitle: 'Class of 2026', ending: '愿你前程似锦\n归来仍是少年' },
  coverColors: ['#14284b', '#f2c14e']
}

// ---------------- 简约写真 ----------------
const N = { bg: '#f4f2ee', primary: '#1f1f1f', accent: '#b08d57', text: '#1f1f1f', textSoft: '#8a8580' }
const serifCap = ts('Serif', 0.05, N.text, { letterSpacing: 0.25, lineHeight: 1.6 })

export const minimal: Template = {
  id: 'minimal',
  name: '光影写真',
  category: '写真',
  description: '留白杂志风、细线条与衬线字体，节奏舒缓，适合个人写真与情侣照',
  tags: ['写真', '简约', '高级', '杂志'],
  palette: N,
  fonts: { title: 'Serif', body: 'Serif', script: 'PlayfairDisplay' },
  grade: { exposure: 0.03, contrast: 1.02, saturation: 0.88, warmth: 0.05, fade: 0.04 },
  post: { vignette: 0.08, grain: 0.012, leak: 0 },
  background: { kind: 'color', color: '#f4f2ee' },
  transitions: [
    { name: 'wipeLeft', weight: 2 },
    { name: 'fade', weight: 2.5 },
    { name: 'slideZoom', weight: 1.5 },
    { name: 'doorway', weight: 1 },
    { name: 'wipeUp', weight: 1 }
  ],
  music: 'clair-de-lune.mp3',
  pace: 'slow',
  intro: intro({
    id: 'n-intro',
    withPhoto: true,
    photoFrame: { shape: 'arch' },
    titleStyle: ts('Serif', 0.085, N.text, { letterSpacing: 0.5 }),
    subStyle: ts('PlayfairDisplay', 0.035, N.accent, { italic: true, letterSpacing: 0.2 }),
    dateStyle: ts('PlayfairDisplay', 0.022, N.textSoft, { letterSpacing: 0.6 }),
    titleAnim: { type: 'reveal', delay: 0.6, duration: 1.4 }
  }),
  outro: outro({
    id: 'n-outro',
    withPhoto: false,
    endStyle: ts('Serif', 0.065, N.text, { letterSpacing: 0.4, lineHeight: 1.7 }),
    smallStyle: ts('PlayfairDisplay', 0.026, N.textSoft, { letterSpacing: 0.4 }),
    decor: (c) => [{ type: 'shape', shape: 'rect', rect: { x: 0.5 - (S(c) * 0.1) / c.W / 2, y: 0.25, w: (S(c) * 0.1) / c.W, h: 1.5 / c.H }, color: N.accent, in: { type: 'spread', delay: 0.2, duration: 1 } }]
  }),
  styles: [
    magazine({ id: 'n-mag', caption: serifCap, accent: N.accent, weight: 3 }),
    blurFrame({ id: 'n-frame', name: '留白相框', bg: { kind: 'template' }, side: 'right', caption: serifCap, weight: 3, shadow: { blur: 0.03, alpha: 0.18 } }),
    blurFrame({ id: 'n-frame-c', name: '居中相框', bg: { kind: 'template' }, weight: 2, shadow: { blur: 0.03, alpha: 0.18 } }),
    shapeFrame({ id: 'n-arch', shape: 'arch', caption: serifCap, weight: 2 }),
    duo({ id: 'n-duo', anim: { type: 'fade', duration: 1.2 }, weight: 2.5 }),
    trio({ id: 'n-trio', anim: { type: 'slideUp', duration: 1, distance: 0.04 } }),
    fullscreen({ id: 'n-full', weight: 2 }),
    panes({ id: 'n-panes', count: 2, gap: 0.03, bg: { kind: 'template' } })
  ],
  captions: ['做自己的光', '温柔且坚定', '时光正好', '安静地美好', '在光里', '与自己和解', '慢下来，感受生活'],
  defaults: { title: '光影写真', subtitle: 'Portrait Series', ending: '做自己的光' },
  coverColors: ['#f4f2ee', '#b08d57']
}

