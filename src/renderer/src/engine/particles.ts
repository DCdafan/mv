import type { ParticleConfig, ParticleType } from './types'
import { hash01, parseColor } from './math'

// 图集：4x4 格，每格 128px
export const CELL = {
  petal: 0,
  heart: 1,
  star: 2,
  sparkle: 3,
  softdot: 4,
  ring: 5,
  snow: 6,
  confetti: 7,
  leaf: 8,
  bokeh: 9,
  glow: 10,
  circle: 11
}

export function buildParticleAtlas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const ctx = c.getContext('2d')!
  const cell = (i: number, draw: (g: CanvasRenderingContext2D) => void): void => {
    ctx.save()
    ctx.translate((i % 4) * 128 + 64, Math.floor(i / 4) * 128 + 64)
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#fff'
    draw(ctx)
    ctx.restore()
  }
  cell(CELL.petal, (g) => {
    g.beginPath()
    g.moveTo(0, -52)
    g.bezierCurveTo(40, -40, 44, 20, 0, 54)
    g.bezierCurveTo(-44, 20, -40, -40, 0, -52)
    const gr = g.createLinearGradient(0, -52, 0, 54)
    gr.addColorStop(0, 'rgba(255,255,255,0.75)')
    gr.addColorStop(1, 'rgba(255,255,255,1)')
    g.fillStyle = gr
    g.fill()
  })
  cell(CELL.heart, (g) => {
    g.beginPath()
    g.moveTo(0, 46)
    g.bezierCurveTo(-70, 0, -40, -60, 0, -24)
    g.bezierCurveTo(40, -60, 70, 0, 0, 46)
    g.fill()
  })
  cell(CELL.star, (g) => {
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 22 : 54
      const a = (i * Math.PI) / 5 - Math.PI / 2
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
  })
  cell(CELL.sparkle, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30)
    gr.addColorStop(0, 'rgba(255,255,255,1)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(-64, -64, 128, 128)
    g.fillStyle = '#fff'
    g.beginPath()
    g.moveTo(0, -60)
    g.quadraticCurveTo(4, -4, 60, 0)
    g.quadraticCurveTo(4, 4, 0, 60)
    g.quadraticCurveTo(-4, 4, -60, 0)
    g.quadraticCurveTo(-4, -4, 0, -60)
    g.fill()
  })
  cell(CELL.softdot, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 60)
    gr.addColorStop(0, 'rgba(255,255,255,1)')
    gr.addColorStop(0.4, 'rgba(255,255,255,0.6)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(-64, -64, 128, 128)
  })
  cell(CELL.ring, (g) => {
    g.lineWidth = 4
    g.globalAlpha = 0.9
    g.beginPath()
    g.arc(0, 0, 54, 0, Math.PI * 2)
    g.stroke()
    const gr = g.createRadialGradient(0, 0, 30, 0, 0, 54)
    gr.addColorStop(0, 'rgba(255,255,255,0.02)')
    gr.addColorStop(1, 'rgba(255,255,255,0.35)')
    g.fillStyle = gr
    g.fill()
    g.globalAlpha = 1
    g.beginPath()
    g.ellipse(-20, -22, 12, 7, -0.7, 0, Math.PI * 2)
    g.fill()
  })
  cell(CELL.snow, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 56)
    gr.addColorStop(0, 'rgba(255,255,255,1)')
    gr.addColorStop(0.55, 'rgba(255,255,255,0.9)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.beginPath()
    g.arc(0, 0, 56, 0, Math.PI * 2)
    g.fill()
  })
  cell(CELL.confetti, (g) => g.fillRect(-26, -44, 52, 88))
  cell(CELL.leaf, (g) => {
    g.beginPath()
    g.moveTo(0, -56)
    g.quadraticCurveTo(46, 0, 0, 56)
    g.quadraticCurveTo(-46, 0, 0, -56)
    g.fill()
    g.globalCompositeOperation = 'destination-out'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(0, -50)
    g.lineTo(0, 50)
    g.stroke()
  })
  cell(CELL.bokeh, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 58)
    gr.addColorStop(0, 'rgba(255,255,255,0.55)')
    gr.addColorStop(0.82, 'rgba(255,255,255,0.7)')
    gr.addColorStop(0.92, 'rgba(255,255,255,0.95)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.beginPath()
    g.arc(0, 0, 58, 0, Math.PI * 2)
    g.fill()
  })
  cell(CELL.glow, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 62)
    gr.addColorStop(0, 'rgba(255,255,255,1)')
    gr.addColorStop(0.15, 'rgba(255,255,255,0.8)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(-64, -64, 128, 128)
  })
  cell(CELL.circle, (g) => {
    g.beginPath()
    g.arc(0, 0, 58, 0, Math.PI * 2)
    g.fill()
  })
  return c
}

const ADDITIVE: Set<ParticleType> = new Set(['bokeh', 'goldDust', 'fireflies', 'sparkles', 'stars'])

const DEFAULT_SIZE: Record<ParticleType, [number, number]> = {
  petals: [0.018, 0.035],
  snow: [0.006, 0.018],
  hearts: [0.015, 0.035],
  stars: [0.006, 0.016],
  bokeh: [0.04, 0.12],
  bubbles: [0.02, 0.06],
  confetti: [0.008, 0.016],
  sparkles: [0.015, 0.04],
  goldDust: [0.003, 0.008],
  leaves: [0.02, 0.04],
  fireflies: [0.01, 0.025]
}

/**
 * 计算某一时刻所有粒子的实例数据（确定性：同样的时间得到同样的画面）。
 * 每个粒子 11 个 float：x, y, size, rot, r, g, b, a, cell, scaleX, 预留
 */
export function simulateParticles(
  cfg: ParticleConfig,
  t: number,
  W: number,
  H: number,
  opacity: number,
  out: Float32Array,
  offset: number
): number {
  const S = Math.min(W, H)
  const [s0, s1] = cfg.size ?? DEFAULT_SIZE[cfg.type]
  const speed = cfg.speed ?? 1
  const baseA = (cfg.opacity ?? 0.85) * opacity
  const seed = (cfg.seed ?? 7) * 7919
  const colors = cfg.colors.map(parseColor)
  const additive = ADDITIVE.has(cfg.type)
  let n = 0
  for (let i = 0; i < cfg.count; i++) {
    const r = (k: number): number => hash01(seed + i * 131 + k * 17)
    let size = (s0 + (s1 - s0) * r(1)) * S
    const m = size * 2
    let x = 0
    let y = 0
    let rot = 0
    let a = baseA
    let cell = CELL.softdot
    let sx = 1
    switch (cfg.type) {
      case 'petals':
      case 'leaves':
      case 'snow':
      case 'confetti': {
        const fallV = (cfg.type === 'snow' ? 0.05 : cfg.type === 'confetti' ? 0.14 : 0.07) * (0.6 + r(2) * 0.8) * H * speed
        const span = H + 2 * m
        y = ((r(3) * span + fallV * t) % span) - m
        const sway = (cfg.type === 'snow' ? 0.02 : 0.045) * W
        x = r(4) * W + Math.sin(t * (0.4 + r(5) * 0.8) + r(6) * 6.28) * sway + t * W * 0.015 * (r(7) - 0.35) * speed
        x = ((x % (W + 2 * m)) + W + 2 * m) % (W + 2 * m) - m
        rot = r(8) * 6.28 + t * (r(9) - 0.5) * (cfg.type === 'confetti' ? 6 : 1.6)
        if (cfg.type === 'petals') {
          cell = CELL.petal
          sx = 0.45 + 0.55 * Math.abs(Math.cos(t * (0.8 + r(10) * 1.5) + r(11) * 6))
        } else if (cfg.type === 'leaves') {
          cell = CELL.leaf
          sx = 0.5 + 0.5 * Math.abs(Math.cos(t * (0.6 + r(10)) + r(11) * 6))
        } else if (cfg.type === 'confetti') {
          cell = r(12) > 0.6 ? CELL.circle : CELL.confetti
          if (cell === CELL.circle) size *= 0.6
          sx = Math.cos(t * (3 + r(10) * 4) + r(11) * 6)
        } else {
          cell = CELL.snow
          rot = 0
          a *= 0.5 + 0.5 * r(10)
        }
        break
      }
      case 'hearts':
      case 'bubbles': {
        const v = (cfg.type === 'hearts' ? 0.06 : 0.07) * (0.6 + r(2) * 0.8) * H * speed
        const span = H + 2 * m
        y = H + m - ((r(3) * span + v * t) % span)
        x = r(4) * W + Math.sin(t * (0.7 + r(5)) + r(6) * 6.28) * 0.03 * W
        rot = cfg.type === 'hearts' ? Math.sin(t * (0.8 + r(7)) + r(8) * 6) * 0.35 : 0
        cell = cfg.type === 'hearts' ? CELL.heart : CELL.ring
        const top = y / H
        a *= Math.min(1, top * 2.5)
        break
      }
      case 'stars': {
        x = r(2) * W
        y = r(3) * H
        cell = r(4) > 0.7 ? CELL.sparkle : CELL.glow
        const tw = 0.5 + 0.5 * Math.sin(t * (1 + r(5) * 3) + r(6) * 6.28)
        a *= 0.25 + 0.75 * tw
        size *= cell === CELL.sparkle ? 1.6 + tw * 0.6 : 1.2
        break
      }
      case 'sparkles': {
        const period = (2 + r(2) * 3) / speed
        const cyc = t / period + r(3)
        const k = Math.floor(cyc)
        const f = cyc - k
        x = hash01(seed + i * 977 + k * 31) * W
        y = hash01(seed + i * 613 + k * 57) * H
        const life = Math.pow(Math.sin(Math.PI * f), 2)
        a *= life
        size *= 0.4 + life * 0.8
        rot = t * 0.5 + r(4) * 3
        cell = CELL.sparkle
        break
      }
      case 'bokeh':
      case 'goldDust':
      case 'fireflies': {
        const drift = cfg.type === 'bokeh' ? 0.012 : cfg.type === 'goldDust' ? 0.02 : 0.03
        const span = H + 2 * m
        y = ((r(3) * span - drift * H * t * speed) % span + span) % span - m
        x = r(2) * W + Math.sin(t * 0.25 * (0.5 + r(4)) + r(5) * 6.28) * 0.06 * W
        y += Math.cos(t * 0.3 * (0.5 + r(6)) + r(7) * 6.28) * 0.03 * H
        const br = 0.5 + 0.5 * Math.sin(t * (0.6 + r(8) * 1.5) + r(9) * 6.28)
        a *= cfg.type === 'bokeh' ? 0.35 + 0.4 * br : 0.2 + 0.8 * br
        cell = cfg.type === 'bokeh' ? CELL.bokeh : CELL.glow
        if (cfg.type === 'fireflies') size *= 1.5
        break
      }
    }
    const col = colors[Math.floor(r(20) * colors.length) % colors.length] ?? [1, 1, 1, 1]
    const fa = a * col[3]
    const o = offset + n * 11
    out[o] = x
    out[o + 1] = y
    out[o + 2] = size
    out[o + 3] = rot
    out[o + 4] = col[0] * fa
    out[o + 5] = col[1] * fa
    out[o + 6] = col[2] * fa
    out[o + 7] = additive ? 0 : fa
    out[o + 8] = cell
    out[o + 9] = sx
    out[o + 10] = 0
    n++
  }
  return n
}
