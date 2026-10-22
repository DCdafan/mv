import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import { readdirSync } from 'fs'
import { analyzeSamples } from '../src/renderer/src/analysis/beat'

const SR = 22050

function clickTrack(bpm: number, seconds: number, accentEvery = 4): Float32Array {
  const out = new Float32Array(SR * seconds)
  const period = 60 / bpm
  let k = 0
  for (let t = 0.5; t < seconds; t += period, k++) {
    const start = Math.floor(t * SR)
    const amp = k % accentEvery === 0 ? 1 : 0.5
    const freq = k % accentEvery === 0 ? 80 : 1200
    for (let i = 0; i < 2000 && start + i < out.length; i++) {
      out[start + i] += amp * Math.exp(-i / 300) * Math.sin((2 * Math.PI * freq * i) / SR)
    }
  }
  // 加一点噪声
  for (let i = 0; i < out.length; i++) out[i] += (Math.random() - 0.5) * 0.01
  return out
}

describe('节拍分析', () => {
  for (const bpm of [80, 100, 120, 140]) {
    it(`合成节拍 ${bpm} BPM`, () => {
      const r = analyzeSamples(clickTrack(bpm, 30), SR)
      expect(Math.abs(r.bpm - bpm)).toBeLessThan(bpm * 0.04)
      // 检测到的节拍与真实节拍对齐（误差 < 50ms）
      const period = 60 / bpm
      const mid = r.beats.filter((b) => b > 2 && b < 28)
      const errs = mid.map((b) => {
        const k = Math.round((b - 0.5) / period)
        return Math.abs(b - (0.5 + k * period))
      })
      const avg = errs.reduce((a, b) => a + b, 0) / errs.length
      expect(avg).toBeLessThan(0.05)
      expect(r.confidence).toBeGreaterThan(0.3)
    })
  }

  it('重拍落在重音上', () => {
    const r = analyzeSamples(clickTrack(120, 30), SR)
    const period = 0.5
    const hits = r.downbeats.filter((d) => d > 2 && d < 28).map((d) => Math.round((d - 0.5) / period) % 4)
    const zero = hits.filter((h) => h === 0).length
    expect(zero / hits.length).toBeGreaterThan(0.8)
  })

  it('内置曲库都能分析', () => {
    const dir = 'resources/music'
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.mp3'))) {
      const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', `${dir}/${f}`, '-t', '90', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
      const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
      const t0 = performance.now()
      const r = analyzeSamples(samples, SR)
      const ms = performance.now() - t0
      console.log(`${f.padEnd(22)} bpm=${r.bpm.toFixed(1).padStart(6)} conf=${r.confidence.toFixed(2)} beats=${r.beats.length} ${ms.toFixed(0)}ms`)
      expect(r.bpm).toBeGreaterThan(50)
      expect(r.bpm).toBeLessThan(210)
      expect(r.beats.length).toBeGreaterThan(20)
      expect(r.energy.length).toBeGreaterThan(10)
    }
  })
})
