import { describe, it, expect } from 'vitest'
import type { MusicAnalysis, PhotoAsset, Project } from '../src/shared/types'
import { projectDuration } from '../src/shared/types'
import { arrange, findChorus } from '../src/renderer/src/arrange/arranger'
import { makeShortVersion } from '../src/renderer/src/arrange/highlight'
import { TEMPLATES, getTemplate } from '../src/renderer/src/templates'
import { findStyle } from '../src/renderer/src/engine/renderer'
import { parseJson } from '../src/renderer/src/ai/ai'
import { buildAudioArgs } from '../src/main/audio'
import { overlayBox, overlayToLayer } from '../src/renderer/src/engine/overlays'
import { styleTextKeys } from '../src/renderer/src/templates/styles'

function photos(n: number, extra: (i: number) => Partial<PhotoAsset> = () => ({})): PhotoAsset[] {
  return Array.from({ length: n }, (_, i) => ({
    id: 'p' + i,
    path: `/x/${i}.jpg`,
    name: `${i}.jpg`,
    width: i % 3 === 1 ? 1024 : 1536,
    height: i % 3 === 1 ? 1536 : 1024,
    orientation: i % 3 === 1 ? 'portrait' : 'landscape',
    analysis: { sharpness: 0.8, brightness: 0.5, faces: [], hash: '0', score: 40 + i, focus: { x: 0.5, y: 0.45 }, flags: [] },
    ...extra(i)
  }))
}

function music(dur = 180): MusicAnalysis {
  const beats: number[] = []
  for (let t = 0.3; t < dur; t += 0.5) beats.push(t)
  // 60–90 秒是副歌（能量最高）
  const energy = Array.from({ length: Math.ceil(dur / 0.25) }, (_, i) => (i * 0.25 > 60 && i * 0.25 < 90 ? 0.95 : 0.35))
  return { duration: dur, bpm: 120, beats, downbeats: beats.filter((_, i) => i % 4 === 0), energy, energyStep: 0.25, waveform: [], confidence: 0.6 }
}

function project(ph: PhotoAsset[], tplId = 'wedding-white'): Project {
  const m = music()
  const { scenes, musicOffset } = arrange({ photos: ph, template: getTemplate(tplId), aspect: '16:9', music: m, pace: 'normal', durationMode: 'photos', seed: 3 })
  return {
    version: 1, id: 'x', name: 'x', createdAt: 0, updatedAt: 0, templateId: tplId, aspect: '16:9', photos: ph,
    music: { id: 'm', path: '/m.mp3', name: 'm', analysis: m }, musicOffset, scenes,
    meta: { title: 't', subtitle: 's', date: 'd', ending: 'e' },
    settings: { pace: 'normal', durationMode: 'photos', particles: true, musicVolume: 1, fadeOut: 3 }, seed: 3
  }
}

describe('AI 返回解析', () => {
  it('纯 JSON、代码块、前后带说明文字都能解析', () => {
    expect(parseJson<{ a: number }>('{"a":1}').a).toBe(1)
    expect(parseJson<{ a: number }>('```json\n{"a":2}\n```').a).toBe(2)
    expect(parseJson<{ a: number }>('好的，结果如下：{"a":3} 希望有帮助').a).toBe(3)
    expect(() => parseJson('没有 JSON')).toThrow()
  })
})

describe('音乐高潮', () => {
  it('找到能量最高的一段并对齐小节', () => {
    const m = music()
    const t = findChorus(m, 20)
    expect(t).toBeGreaterThanOrEqual(59)
    expect(t).toBeLessThanOrEqual(71)
    expect(m.downbeats).toContain(t)
  })
  it('指定音乐起点后编排从这里开始', () => {
    const { musicOffset } = arrange({ photos: photos(10), template: TEMPLATES[0], aspect: '16:9', music: music(), pace: 'normal', durationMode: 'photos', seed: 1, musicOffset: 42.3 })
    expect(musicOffset).toBe(42.3)
  })
})

describe('视频片段与 AI 结果参与编排', () => {
  it('视频只进单图版式，时长跟随视频长度', () => {
    const ph = photos(14, (i) => (i % 5 === 2 ? { media: 'video', duration: 4.2 } : {}))
    for (const tpl of TEMPLATES) {
      const p = project(ph, tpl.id)
      for (const s of p.scenes.filter((x) => x.kind === 'photo')) {
        const hasVideo = s.photos.some((id) => ph.find((x) => x.id === id)?.media === 'video')
        if (!hasVideo) continue
        expect(findStyle(tpl, s.styleId).slots.length).toBe(1)
        expect(s.duration).toBeGreaterThan(2.4)
        expect(s.duration).toBeLessThan(6.5)
      }
    }
  })
  it('AI 字幕优先于模板文案库', () => {
    const ph = photos(12, (i) => ({ ai: { caption: 'AI字幕' + i } }))
    const p = project(ph)
    const caps = p.scenes.map((s) => s.texts?.caption).filter(Boolean) as string[]
    expect(caps.length).toBeGreaterThan(0)
    expect(caps.every((c) => c.startsWith('AI字幕'))).toBe(true)
  })
})

describe('15 秒精华版', () => {
  it('时长、画幅、优先高光照片', () => {
    const ph = photos(30, (i) => (i === 3 || i === 7 ? { ai: { highlight: true } } : {}))
    const full = project(ph)
    const short = makeShortVersion(full, { seconds: 15, aspect: '9:16' })
    expect(short.aspect).toBe('9:16')
    expect(projectDuration(short)).toBeLessThan(17)
    expect(projectDuration(short)).toBeGreaterThan(9)
    const used = new Set(short.scenes.filter((s) => s.kind === 'photo').flatMap((s) => s.photos))
    expect(used.has('p3') && used.has('p7')).toBe(true)
    // 音乐从副歌附近开始
    expect(short.musicOffset).toBeGreaterThan(50)
  })
})

describe('导出混音参数', () => {
  const base = (): Project => ({ ...project(photos(6)), music: null })
  it('没有音乐也没有旁白：只输出视频', () => {
    expect(buildAudioArgs(base())).toEqual(['-map', '0:v'])
  })
  it('音乐 + 旁白：旁白延迟、音乐压低、混音', () => {
    const p = project(photos(6))
    p.music!.path = 'package.json' // 只要文件存在
    p.voiceover = { path: 'tsconfig.json', start: 2.5, duration: 6, volume: 1, duck: 0.3 }
    const args = buildAudioArgs(p).join(' ')
    expect(args).toContain('adelay=2500|2500')
    expect(args).toContain("volume=0.3:enable='between(t,2.500,8.500)'")
    expect(args).toContain('amix=inputs=2')
  })
})

describe('贴纸和文字', () => {
  it('贴纸按图案比例算高度，文字转成文字图层', () => {
    const s = { id: 'a', kind: 'sticker' as const, decor: 'heart', x: 0.5, y: 0.5, w: 0.2, rotation: 10, color: '#f00', anim: 'pop' as const }
    const b = overlayBox(s, 1920, 1080)
    expect(b.x).toBeCloseTo(0.4)
    expect(b.h).toBeCloseTo((0.2 * 1920 * (460 / 512)) / 1080, 3)
    const t = overlayToLayer({ ...s, kind: 'text', text: '你好', size: 0.08 }, 1920, 1080)
    expect(t.type).toBe('text')
  })
  it('蛋糕店产品卡有品名、价格、卖点三个可编辑文字', () => {
    const tpl = getTemplate('bakery-sweet')
    const keys = styleTextKeys(findStyle(tpl, 'bs-card'), tpl.palette, tpl.fonts).map((k) => k.key)
    expect(keys).toEqual(expect.arrayContaining(['product@0', 'price@0', 'desc@0', 'tag']))
  })
})

describe('重新编排保留手动编辑', () => {
  it('贴纸、文字、样式按首张照片带到新场景', async () => {
    const { carryEdits } = await import('../src/renderer/src/store/app')
    const p = project(photos(12))
    const target = p.scenes.find((s) => s.kind === 'photo')!
    target.overlays = [{ id: 'o1', kind: 'sticker', decor: 'heart', x: 0.3, y: 0.3, w: 0.1, rotation: 0, color: '#f00', anim: 'pop' }]
    target.texts = { caption: '我改过的字幕' }
    p.scenes[0].overlays = [{ id: 'o2', kind: 'text', text: '片头贴字', x: 0.5, y: 0.2, w: 0.5, rotation: 0, color: '#fff', anim: 'fade' }]
    const again = arrange({ photos: p.photos, template: getTemplate(p.templateId), aspect: '16:9', music: p.music!.analysis!, pace: 'fast', durationMode: 'photos', seed: 99 })
    const merged = carryEdits(p.scenes, again.scenes, false)
    const t2 = merged.find((s) => s.photos[0] === target.photos[0] && s.kind === 'photo')!
    expect(t2.overlays?.[0].id).toBe('o1')
    expect(t2.texts?.caption).toBe('我改过的字幕')
    expect(merged[0].overlays?.[0].id).toBe('o2')
  })
})
