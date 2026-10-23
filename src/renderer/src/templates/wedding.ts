import type { BuildCtx, Layer, Template } from '../engine/types'
import { blurFrame, decorAt, decorCenter, duo, fullscreen, heroTwo, intro, magazine, outro, panes, polaroidPair, shapeFrame, text, trio, ts, zoomPop, stack, kind, pxc } from './styles'

const S = (c: BuildCtx): number => Math.min(c.W, c.H)

// ---------------- 纯白婚纱 ----------------
const W1 = { bg: '#f6efe7', primary: '#c9a27e', accent: '#e8b4b8', text: '#5b4636', textSoft: '#9a8573' }
const w1Cap = ts('ZCOOLXiaoWei', 0.05, W1.text, { lineHeight: 1.5, letterSpacing: 0.12 })
const w1CapLight = ts('ZCOOLXiaoWei', 0.048, '#ffffff', { lineHeight: 1.5, letterSpacing: 0.12, shadow: { color: 'rgba(0,0,0,0.45)', blur: 0.25 } })
const w1Script = (c: BuildCtx, word: string, cx: number, cy: number, size = 0.07): Layer =>
  text(undefined, word, pxc(c, cx, cy, c.W * 0.8, S(c) * size * 2), ts('GreatVibes', size, W1.primary), { type: 'fade', delay: 0.9, duration: 1.2 })

export const weddingWhite: Template = {
  id: 'wedding-white',
  name: '纯白誓言',
  category: '婚纱',
  description: '奶油白底色、花瓣飘落、柔光暖调，经典法式浪漫婚纱模板',
  tags: ['婚纱', '浪漫', '唯美', '花瓣'],
  palette: W1,
  fonts: { title: 'ZCOOLXiaoWei', body: 'ZCOOLXiaoWei', script: 'GreatVibes' },
  grade: { exposure: 0.08, contrast: 0.95, saturation: 0.92, warmth: 0.25, fade: 0.05, splitShadow: '#8a7a9a', splitHighlight: '#ffe2c4', splitAmount: 0.08 },
  post: { vignette: 0.18, grain: 0.015, leak: 0.12 },
  background: { kind: 'radial', colors: ['#fffaf4', '#efe3d6'] },
  overlay: [{ type: 'petals', count: 26, colors: ['#ffffff', '#ffe4ea', '#f8c9d1'], opacity: 0.9, speed: 0.8 }],
  transitions: [
    { name: 'fade', weight: 4 },
    { name: 'dreamy', weight: 2 },
    { name: 'blurFade', weight: 2 },
    { name: 'flash', weight: 1.5 },
    { name: 'heart', weight: 1 },
    { name: 'circleOpen', weight: 1 },
    { name: 'wipeLeft', weight: 1 }
  ],
  music: 'wedding-march.mp3',
  pace: 'normal',
  intro: intro({
    id: 'w1-intro',
    titleStyle: ts('ZCOOLXiaoWei', 0.11, '#ffffff', { letterSpacing: 0.25, shadow: { color: 'rgba(80,50,30,0.5)', blur: 0.3 } }),
    subStyle: ts('GreatVibes', 0.065, '#fff6ea', { shadow: { color: 'rgba(80,50,30,0.5)', blur: 0.3 } }),
    dateStyle: ts('PlayfairDisplay', 0.03, '#ffffff', { letterSpacing: 0.4 }),
    overlay: 'rgba(60,40,30,0.32)',
    titleChar: { type: 'blur', delay: 0.4, stagger: 0.16, duration: 0.9 },
    decor: (c) => [decorCenter(c, 'flourish', c.W / 2, c.H * 0.3, S(c) * 0.5, '#ffffff', 0.125, { in: { type: 'spread', delay: 0.3, duration: 1.2 } })]
  }),
  outro: outro({
    id: 'w1-outro',
    endStyle: ts('ZCOOLXiaoWei', 0.075, '#ffffff', { letterSpacing: 0.2, lineHeight: 1.5, shadow: { color: 'rgba(0,0,0,0.4)', blur: 0.3 } }),
    smallStyle: ts('ZCOOLXiaoWei', 0.032, '#fff4e6', { letterSpacing: 0.3 }),
    decor: (c) => [decorCenter(c, 'rings', c.W / 2, c.H * 0.2, S(c) * 0.16, '#fff3dc', 0.66, { in: { type: 'pop', delay: 0.2 } }, '#f7d9a8')]
  }),
  styles: [
    fullscreen({ id: 'w1-full', weight: 3 }),
    fullscreen({ id: 'w1-full-cap', name: '满屏字幕', weight: 1.5, caption: w1CapLight }),
    blurFrame({ id: 'w1-blur', border: { width: 0.012, color: '#ffffff' }, shadow: { blur: 0.03, alpha: 0.35 } }),
    blurFrame({ id: 'w1-blur-side', name: '相框+字幕', side: 'left', border: { width: 0.01, color: '#ffffff' }, shadow: { blur: 0.03, alpha: 0.3 }, caption: w1CapLight, weight: 2 }),
    shapeFrame({
      id: 'w1-arch',
      name: '拱门相框',
      shape: 'arch',
      ring: { color: W1.primary, width: 0.004 },
      caption: w1Cap,
      weight: 2,
      decor: (c) => [decorAt(c, 'leafBranch', kind(c) === 'tall' ? c.W * 0.5 : c.W * 0.36, c.H * 0.84, S(c) * 0.4, '#b9c4a6', { in: { type: 'fade', delay: 0.8 } })]
    }),
    shapeFrame({ id: 'w1-heart', name: '爱心相框', shape: 'heart', weight: 1, energy: [0.2, 1], decor: (c) => [w1Script(c, 'Forever Love', c.W / 2, c.H * 0.9, 0.06)] }),
    duo({ id: 'w1-duo', border: { width: 0.008, color: '#ffffff' }, shadow: { blur: 0.025, alpha: 0.25 } }),
    trio({ id: 'w1-trio', border: { width: 0.006, color: '#ffffff' }, shadow: { blur: 0.02, alpha: 0.25 } }),
    heroTwo({ id: 'w1-hero', border: { width: 0.006, color: '#ffffff' } }),
    polaroidPair({ id: 'w1-pola', weight: 1.2 }),
    magazine({ id: 'w1-mag', caption: ts('ZCOOLXiaoWei', 0.06, W1.text, { lineHeight: 1.6, letterSpacing: 0.15 }), accent: W1.primary, weight: 1.5 }),
    zoomPop({ id: 'w1-pop', border: { width: 0.01, color: '#ffffff' }, shadow: { blur: 0.03, alpha: 0.3 }, energy: [0.5, 1] })
  ],
  captions: ['遇见你，是最美的意外', '从此，你的余生都是我', '愿得一心人，白首不相离', '我的世界因你而温柔', '最好的时光，是和你在一起', '你是我所有的少女情怀', '牵着你的手，走过四季', '执子之手，共度此生'],
  defaults: { title: '我们结婚啦', subtitle: 'Our Wedding Day', ending: '余生请多指教' },
  coverColors: ['#f6efe7', '#e8b4b8']
}

// ---------------- 星空之约 ----------------
const W2 = { bg: '#0d1330', primary: '#e8c77d', accent: '#9fb5ff', text: '#f6e7c1', textSoft: '#aab3d6' }
const goldText = (size: number, more = {}): ReturnType<typeof ts> => ts('ZCOOLXiaoWei', size, '#f6e7c1', { gradient: ['#fff3cf', '#d9ad5c'], letterSpacing: 0.15, shadow: { color: 'rgba(255,200,120,0.45)', blur: 0.4 }, ...more })

export const weddingStar: Template = {
  id: 'wedding-star',
  name: '星空之约',
  category: '婚纱',
  description: '深蓝夜空、星光与金色光斑，适合夜景、礼服和浪漫氛围',
  tags: ['婚纱', '夜景', '星空', '高级'],
  palette: W2,
  fonts: { title: 'ZCOOLXiaoWei', body: 'ZCOOLXiaoWei', script: 'GreatVibes' },
  grade: { exposure: 0, contrast: 1.08, saturation: 0.95, warmth: -0.05, splitShadow: '#3a4a8a', splitHighlight: '#ffd9a0', splitAmount: 0.12 },
  post: { vignette: 0.45, grain: 0.012, leak: 0 },
  background: { kind: 'gradient', colors: ['#1c2554', '#070a1a'], angle: 90 },
  overlay: [
    { type: 'stars', count: 70, colors: ['#ffffff', '#fff2c8'], opacity: 0.9 },
    { type: 'bokeh', count: 14, colors: ['#ffd88a', '#9fb5ff', '#ffb3c6'], opacity: 0.35 }
  ],
  transitions: [
    { name: 'fade', weight: 3 },
    { name: 'flash', weight: 2 },
    { name: 'crossZoom', weight: 1.5 },
    { name: 'circleOpen', weight: 1.5 },
    { name: 'ripple', weight: 1 },
    { name: 'blurFade', weight: 1.5 }
  ],
  music: 'clair-de-lune.mp3',
  pace: 'slow',
  intro: intro({
    id: 'w2-intro',
    withPhoto: true,
    photoFrame: { shape: 'circle', border: { width: 0.006, color: '#e8c77d' } },
    titleStyle: goldText(0.1, { letterSpacing: 0.3 }),
    titleChar: { type: 'fade', delay: 0.5, stagger: 0.22, duration: 1 },
    subStyle: ts('GreatVibes', 0.055, '#e8d6a8'),
    dateStyle: ts('PlayfairDisplay', 0.026, '#aab3d6', { letterSpacing: 0.5 }),
    decor: (c) => [{ type: 'particles', rect: { x: 0, y: 0, w: 1, h: 1 }, particles: { type: 'sparkles', count: 18, colors: ['#ffe8b0'], opacity: 1 } }]
  }),
  outro: outro({
    id: 'w2-outro',
    withPhoto: false,
    endStyle: goldText(0.07, { lineHeight: 1.6 }),
    smallStyle: ts('ZCOOLXiaoWei', 0.03, '#aab3d6', { letterSpacing: 0.3 }),
    decor: (c) => [decorCenter(c, 'heartLine', c.W / 2, c.H * 0.2, S(c) * 0.12, '#e8c77d', 0.9, { in: { type: 'pop', delay: 0.3 }, loop: { type: 'pulse', amp: 0.06, period: 1.6 } })]
  }),
  styles: [
    fullscreen({ id: 'w2-full', weight: 3 }),
    blurFrame({ id: 'w2-blur', border: { width: 0.005, color: '#e8c77d' }, shadow: { blur: 0.04, alpha: 0.6 }, dim: 0.5 }),
    blurFrame({ id: 'w2-blur-side', side: 'right', border: { width: 0.005, color: '#e8c77d' }, caption: goldText(0.05, { lineHeight: 1.6 }), dim: 0.55, weight: 2 }),
    shapeFrame({ id: 'w2-circle', name: '圆形相框', shape: 'circle', ring: { color: '#e8c77d', width: 0.004 }, caption: goldText(0.048, { lineHeight: 1.6 }), weight: 2 }),
    duo({ id: 'w2-duo', border: { width: 0.004, color: '#e8c77d' }, shadow: { blur: 0.03, alpha: 0.5 } }),
    trio({ id: 'w2-trio', border: { width: 0.003, color: '#e8c77d' } }),
    panes({ id: 'w2-panes', count: 3 }),
    heroTwo({ id: 'w2-hero', border: { width: 0.003, color: '#e8c77d' } }),
    zoomPop({ id: 'w2-pop', border: { width: 0.005, color: '#e8c77d' }, shadow: { blur: 0.04, alpha: 0.6 } })
  ],
  captions: ['你是我穷极一生的浪漫', '星河滚烫，你是人间理想', '今晚的月色真美', '把星光揉碎，都给你', '想和你看遍每一场星空', '月亮不会奔向你，但我会', '你是我藏在心底的星辰'],
  defaults: { title: '星光与你', subtitle: 'You are my starlight', ending: '愿有岁月可回首\n且以深情共白头' },
  coverColors: ['#0d1330', '#e8c77d']
}

// ---------------- 中式喜嫁 ----------------
const R = { bg: '#8f1414', primary: '#e9c47a', accent: '#ffdf9e', text: '#ffe7b0', textSoft: '#f3c98b' }
const redGold = (size: number, more = {}): ReturnType<typeof ts> => ts('MaShanZheng', size, R.text, { gradient: ['#fff1c9', '#e2ae55'], shadow: { color: 'rgba(60,0,0,0.5)', blur: 0.2 }, ...more })
const goldBorder = { width: 0.008, color: '#e9c47a' }
const corners = (c: BuildCtx): Layer[] => {
  const w = S(c) * 0.14
  const m = S(c) * 0.03
  const mk = (x: number, y: number, rot: number): Layer => ({ ...decorAt(c, 'corner', x, y - w / 2, w, '#e9c47a'), rotation: rot, in: { type: 'fade', delay: 0.4, duration: 0.8 } }) as Layer
  return [mk(m + w / 2, m + w / 2, 0), mk(c.W - m - w / 2, m + w / 2, 90), mk(c.W - m - w / 2, c.H - m - w / 2, 180), mk(m + w / 2, c.H - m - w / 2, 270)]
}

export const chineseRed: Template = {
  id: 'chinese-red',
  name: '中式喜嫁',
  category: '中式',
  description: '正红与鎏金、囍字灯笼祥云、水墨转场，适合秀禾服、中式婚礼',
  tags: ['中式', '婚礼', '秀禾', '喜庆'],
  palette: R,
  fonts: { title: 'MaShanZheng', body: 'ZCOOLXiaoWei' },
  grade: { exposure: 0.03, contrast: 1.05, saturation: 1.05, warmth: 0.18 },
  post: { vignette: 0.35, grain: 0.01, leak: 0.05 },
  background: { kind: 'radial', colors: ['#b51f1f', '#5e0a0a'] },
  overlay: [{ type: 'goldDust', count: 60, colors: ['#ffd98a', '#fff1c9'], opacity: 0.9 }],
  transitions: [
    { name: 'ink', weight: 3 },
    { name: 'fade', weight: 2 },
    { name: 'burn', weight: 1.5 },
    { name: 'flash', weight: 1.5 },
    { name: 'doorway', weight: 1.5 },
    { name: 'pushLeft', weight: 1 }
  ],
  music: 'spring.mp3',
  pace: 'normal',
  intro: intro({
    id: 'r-intro',
    withPhoto: false,
    titleStyle: redGold(0.14, { letterSpacing: 0.3 }),
    subStyle: ts('ZCOOLXiaoWei', 0.045, R.textSoft, { letterSpacing: 0.4 }),
    dateStyle: ts('ZCOOLXiaoWei', 0.03, R.textSoft, { letterSpacing: 0.3 }),
    titleAnim: { type: 'zoomOut', delay: 0.6, duration: 1.2, distance: 1.6 },
    decor: (c) => [
      decorCenter(c, 'xi', c.W / 2, c.H * 0.22, S(c) * 0.26, '#f0c66e', 1, { in: { type: 'pop', delay: 0.1, duration: 0.9 }, opacity: 0.95 }),
      decorAt(c, 'lantern', c.W * 0.12, 0, S(c) * 0.14, '#d62a1e', { in: { type: 'drop', delay: 0.3, duration: 1.2 }, loop: { type: 'sway', amp: 0.06, period: 3 } }, '#f0c66e'),
      decorAt(c, 'lantern', c.W * 0.88, 0, S(c) * 0.14, '#d62a1e', { in: { type: 'drop', delay: 0.5, duration: 1.2 }, loop: { type: 'sway', amp: 0.06, period: 3.4 } }, '#f0c66e'),
      decorCenter(c, 'auspiciousCloud', c.W * 0.2, c.H * 0.86, S(c) * 0.3, 'rgba(240,198,110,0.55)', 0.5, { in: { type: 'slideRight', delay: 0.8 } }),
      decorCenter(c, 'auspiciousCloud', c.W * 0.8, c.H * 0.86, S(c) * 0.3, 'rgba(240,198,110,0.55)', 0.5, { in: { type: 'slideLeft', delay: 0.8 } })
    ]
  }),
  outro: outro({
    id: 'r-outro',
    withPhoto: false,
    endStyle: redGold(0.085, { lineHeight: 1.5, letterSpacing: 0.25 }),
    smallStyle: ts('ZCOOLXiaoWei', 0.032, R.textSoft, { letterSpacing: 0.3 }),
    decor: (c) => [decorCenter(c, 'xi', c.W / 2, c.H * 0.16, S(c) * 0.16, '#f0c66e', 1, { in: { type: 'pop', delay: 0.2 } }), ...corners(c)]
  }),
  styles: [
    fullscreen({ id: 'r-full', weight: 2.5, decor: corners }),
    blurFrame({ id: 'r-frame', name: '鎏金相框', bg: { kind: 'template' }, border: goldBorder, shadow: { blur: 0.03, alpha: 0.5 }, decor: corners, weight: 3 }),
    blurFrame({ id: 'r-frame-side', name: '相框+诗句', side: 'right', bg: { kind: 'template' }, border: goldBorder, caption: redGold(0.065, { lineHeight: 1.5 }), weight: 2 }),
    shapeFrame({
      id: 'r-fan',
      name: '团扇',
      shape: 'circle',
      ring: { color: '#e9c47a', width: 0.006 },
      caption: redGold(0.06, { lineHeight: 1.5 }),
      weight: 2.5,
      decor: (c) => [decorCenter(c, 'auspiciousCloud', kind(c) === 'tall' ? c.W * 0.5 : c.W * 0.36, c.H * 0.9, S(c) * 0.3, 'rgba(240,198,110,0.6)', 0.5, { in: { type: 'fade', delay: 0.6 } })]
    }),
    duo({ id: 'r-duo', border: goldBorder, shadow: { blur: 0.03, alpha: 0.45 }, decor: (c) => [decorCenter(c, 'xi', c.W / 2, c.H / 2, S(c) * 0.08, '#f0c66e', 1, { in: { type: 'pop', delay: 0.6 } })] }),
    trio({ id: 'r-trio', border: goldBorder }),
    heroTwo({ id: 'r-hero', border: goldBorder }),
    stack({ id: 'r-stack', card: '#f7e3b5' })
  ],
  captions: ['执子之手，与子偕老', '两情相悦，白首成约', '一生一世一双人', '琴瑟和鸣，岁岁长安', '红妆十里，只为嫁你', '良缘天定，佳偶天成', '愿得一人心，白首不相离'],
  defaults: { title: '百年好合', subtitle: '喜结良缘 · 永结同心', ending: '执子之手\n与子偕老' },
  coverColors: ['#8f1414', '#e9c47a']
}

