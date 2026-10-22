import { describe, it, expect } from 'vitest'
import type { MusicAnalysis, PhotoAsset, Aspect } from '../src/shared/types'
import { arrange, retime, slotAccepts } from '../src/renderer/src/arrange/arranger'
import { TEMPLATES } from '../src/renderer/src/templates'
import { findStyle } from '../src/renderer/src/engine/renderer'

function photos(n: number): PhotoAsset[] {
  return Array.from({ length: n }, (_, i) => {
    const portrait = i % 3 === 1 || i % 5 === 0
    return {
      id: 'p' + i,
      path: `/x/${i}.jpg`,
      name: `${i}.jpg`,
      width: portrait ? 1024 : 1536,
      height: portrait ? 1536 : 1024,
      orientation: portrait ? 'portrait' : 'landscape',
      analysis: { sharpness: 0.8, brightness: 0.5, faces: [], hash: '0', score: 50 + (i % 7) * 5, focus: { x: 0.5, y: 0.45 }, flags: [] }
    }
  })
}

function music(bpm: number, dur: number): MusicAnalysis {
  const p = 60 / bpm
  const beats: number[] = []
  for (let t = 0.2; t < dur; t += p) beats.push(t)
  return {
    duration: dur,
    bpm,
    beats,
    downbeats: beats.filter((_, i) => i % 4 === 0),
    energy: Array.from({ length: Math.ceil(dur / 0.25) }, (_, i) => 0.4 + 0.4 * Math.sin(i / 40)),
    energyStep: 0.25,
    waveform: [],
    confidence: 0.6
  }
}

describe('自动编排', () => {
  for (const tpl of TEMPLATES) {
    for (const aspect of ['16:9', '9:16', '1:1'] as Aspect[]) {
      it(`${tpl.name} ${aspect}`, () => {
        const ph = photos(37)
        const m = music(100, 240)
        const { scenes } = arrange({ photos: ph, template: tpl, aspect, music: m, pace: tpl.pace, durationMode: 'photos', seed: 42 })
        expect(scenes[0].kind).toBe('intro')
        expect(scenes[scenes.length - 1].kind).toBe('outro')
        // 每张照片在正片里恰好出现一次
        const used = scenes.filter((s) => s.kind === 'photo').flatMap((s) => s.photos)
        expect(used.sort()).toEqual(ph.map((p) => p.id).sort())
        // 场景首尾相接、时长为正、转场不超过场景时长
        for (let i = 0; i < scenes.length; i++) {
          const s = scenes[i]
          expect(s.duration).toBeGreaterThan(0.9)
          if (i > 0) expect(Math.abs(s.start - (scenes[i - 1].start + scenes[i - 1].duration))).toBeLessThan(1e-6)
          expect(s.transition.duration).toBeLessThan(s.duration)
          const st = findStyle(tpl, s.styleId)
          expect(st.id).toBe(s.styleId)
          expect(s.photos.length).toBe(st.slots.length)
        }
        // 场景切换点都在节拍上
        const beatSet = m.beats
        for (const s of scenes.slice(1)) {
          const near = Math.min(...beatSet.map((b) => Math.abs(b - s.start)))
          expect(near).toBeLessThan(0.02)
        }
      })
    }
  }

  it('方向匹配：横屏画布中 cross 槽位只接受竖图', () => {
    const [land, port] = [photos(3)[2], photos(3)[1]]
    expect(slotAccepts('cross', port, '16:9')).toBe(true)
    expect(slotAccepts('cross', land, '16:9')).toBe(false)
    expect(slotAccepts('match', land, '16:9')).toBe(true)
    expect(slotAccepts('cross', land, '1:1')).toBe(true)
  })

  it('按音乐长度模式：总时长接近音乐长度', () => {
    const m = music(110, 120)
    const { scenes } = arrange({ photos: photos(40), template: TEMPLATES[0], aspect: '16:9', music: m, pace: 'normal', durationMode: 'music', seed: 1 })
    const total = scenes[scenes.length - 1].start + scenes[scenes.length - 1].duration
    expect(total).toBeGreaterThan(95)
    expect(total).toBeLessThan(140)
  })

  it('retime 重新计算开始时间', () => {
    const { scenes } = arrange({ photos: photos(10), template: TEMPLATES[1], aspect: '16:9', music: null, pace: 'normal', durationMode: 'photos', seed: 3 })
    const removed = retime(scenes.filter((_, i) => i !== 2))
    expect(removed[2].start).toBeCloseTo(removed[1].start + removed[1].duration)
  })
})

describe('蛋糕店模板', () => {
  it('带品名的照片进产品版式，没有品名的照片不会进', () => {
    const ph = photos(16).map((p, i) => (i % 4 === 3 ? p : { ...p, product: { name: '蛋糕' + i, price: String(20 + i) } }))
    for (const id of ['bakery-sweet', 'bakery-promo', 'bakery-tea']) {
      const tpl = TEMPLATES.find((t) => t.id === id)!
      const { scenes } = arrange({ photos: ph, template: tpl, aspect: '9:16', music: music(110, 120), pace: tpl.pace, durationMode: 'photos', seed: 5 })
      let productScenes = 0
      for (const s of scenes.filter((x) => x.kind === 'photo')) {
        const st = findStyle(tpl, s.styleId)
        if (!st.needsProduct) continue
        productScenes++
        for (const pid of s.photos) expect(ph.find((p) => p.id === pid)!.product).toBeTruthy()
      }
      expect(productScenes).toBeGreaterThan(2)
    }
  })
})
