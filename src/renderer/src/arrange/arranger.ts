// 自动编排：把照片按方向分配到模板版式里，场景切换对齐音乐节拍，能量高的段落节奏更快
import type { Aspect, MusicAnalysis, Pace, PhotoAsset, Scene, TransitionRef } from '@shared/types'
import type { SceneStyle, SlotSpec, Template } from '../engine/types'
import { rng, pickWeighted, clamp } from '../engine/math'

export interface ArrangeInput {
  photos: PhotoAsset[]
  template: Template
  aspect: Aspect
  music: MusicAnalysis | null
  pace: Pace
  durationMode: 'photos' | 'music'
  seed: number
  /** 指定音乐起点（用户手动选了高潮段）；不传则自动跳过开头静音 */
  musicOffset?: number
}

export interface ArrangeResult {
  scenes: Scene[]
  musicOffset: number
}

const PER_PHOTO: Record<Pace, number> = { slow: 3.6, normal: 2.7, fast: 1.8 }

/** 节拍网格：音乐节拍 + 超出音乐长度后按周期外推（音乐会循环） */
export class BeatGrid {
  beats: number[]
  period: number
  constructor(music: MusicAnalysis | null, offset: number) {
    let beats = music?.beats?.length ? music.beats.map((b) => b - offset).filter((b) => b >= 0) : []
    if (beats.length < 8 || (music && music.confidence < 0.08)) {
      // 节拍不可靠时用固定网格
      const bpm = music?.bpm && music.bpm > 50 && music.bpm < 200 ? music.bpm : 96
      const p = 60 / bpm
      beats = []
      for (let t = 0; t < 3600; t += p) beats.push(t)
    }
    const gaps = beats.slice(1, 200).map((b, i) => b - beats[i]).sort((a, b) => a - b)
    this.period = gaps[Math.floor(gaps.length / 2)] || 0.6
    if (beats[0] > 0.05) beats.unshift(0)
    else beats[0] = 0
    this.beats = beats
  }
  at(i: number): number {
    if (i < this.beats.length) return this.beats[i]
    const last = this.beats[this.beats.length - 1]
    return last + (i - this.beats.length + 1) * this.period
  }
  /** 距离时间 t 最近的节拍序号 */
  indexNear(t: number): number {
    let lo = 0
    let hi = this.beats.length - 1
    if (t >= this.beats[hi]) return hi + Math.round((t - this.beats[hi]) / this.period)
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (this.beats[m] <= t) lo = m
      else hi = m
    }
    return t - this.beats[lo] < this.beats[hi] - t ? lo : hi
  }
}

function canvasOrient(aspect: Aspect): 'landscape' | 'portrait' | 'square' {
  return aspect === '9:16' ? 'portrait' : aspect === '1:1' ? 'square' : 'landscape'
}

export function slotAccepts(spec: SlotSpec, photo: PhotoAsset, aspect: Aspect): boolean {
  const co = canvasOrient(aspect)
  let need: 'landscape' | 'portrait' | 'any' = 'any'
  if (spec === 'landscape' || spec === 'portrait') need = spec
  else if (spec === 'match') need = co === 'square' ? 'any' : co
  else if (spec === 'cross') need = co === 'square' ? 'any' : co === 'landscape' ? 'portrait' : 'landscape'
  if (need === 'any' || photo.orientation === 'square') return true
  return photo.orientation === need
}

/** 在待排队列前几张里为版式挑照片，返回所用队列下标 */
function assign(style: SceneStyle, queue: PhotoAsset[], aspect: Aspect): number[] | null {
  const used: number[] = []
  const window = Math.min(queue.length, style.slots.length + 2)
  for (const spec of style.slots) {
    let found = -1
    for (let i = 0; i < window; i++) {
      if (used.includes(i)) continue
      const isVideo = queue[i].media === 'video'
      // 视频素材只放进单图版式
      if (isVideo && (style.slots.length > 1 || style.needsProduct)) continue
      if (slotAccepts(spec, queue[i], aspect) && (!style.needsProduct || queue[i].product?.price)) {
        found = i
        break
      }
    }
    if (found < 0) return null
    used.push(found)
  }
  // 必须用到队首那张，避免某张照片一直被跳过
  if (!used.includes(0)) return null
  return used
}

function energyAt(music: MusicAnalysis | null, t: number, offset: number): number {
  if (!music?.energy.length) return 0.5
  const i = Math.floor((t + offset) / music.energyStep)
  return music.energy[clamp(i, 0, music.energy.length - 1)] ?? 0.5
}

function findOffset(music: MusicAnalysis | null): number {
  if (!music?.energy.length) return 0
  // 跳过开头的静音
  const i = music.energy.findIndex((e) => e > 0.08)
  const t = Math.max(0, i * music.energyStep - 0.3)
  if (t < 1) return 0
  const b = music.beats.find((x) => x >= t)
  return b !== undefined ? b : t
}

let sceneSeq = 0
export const newSceneId = (): string => 's' + Date.now().toString(36) + (sceneSeq++).toString(36)

export function pickTransition(tpl: Template, r: () => number, prev: string | null, beatPeriod: number, energy: number): TransitionRef {
  const options = tpl.transitions.filter((t) => t.name !== prev || tpl.transitions.length === 1)
  const choice = pickWeighted(options, (t) => t.weight, r())
  if (choice.name === 'cut') return { name: 'cut', duration: 0 }
  const beats = choice.beats ?? (energy > 0.7 ? 1 : 2)
  return { name: choice.name, duration: clamp(beats * beatPeriod, 0.35, 1.3) }
}

export function arrange(input: ArrangeInput): ArrangeResult {
  const { template: tpl, aspect, music } = input
  const r = rng(input.seed)
  const photos = input.photos.filter((p) => !p.excluded)
  const musicOffset = input.musicOffset ?? findOffset(music)
  const grid = new BeatGrid(music, musicOffset)
  const P = grid.period
  const pace = input.pace
  let perPhoto = PER_PHOTO[pace]
  const introSec = pace === 'fast' ? 3.6 : pace === 'slow' ? 5.5 : 4.6
  const outroSec = pace === 'fast' ? 4.5 : 5.5
  if (input.durationMode === 'music' && music) {
    const avail = music.duration - musicOffset - introSec - outroSec
    if (photos.length) perPhoto = clamp((avail / photos.length) * 1.05, 1.1, 6)
  }

  const scenes: Scene[] = []
  let beatIdx = 0
  const pushScene = (s: Omit<Scene, 'start' | 'duration' | 'id' | 'seed'>, targetSec: number, minBeats = 2): void => {
    const start = grid.at(beatIdx)
    // 时长取整到 2 拍（快歌）或 1 拍，尽量落在小节线上
    const unit = P < 0.45 ? 2 : 1
    let nb = Math.max(minBeats, Math.round(targetSec / P / unit) * unit)
    if (music?.downbeats?.length) {
      const target = start + nb * P
      const db = music.downbeats.map((d) => d - musicOffset).find((d) => Math.abs(d - target) < P * 1.01 && d > start + P * minBeats * 0.9)
      if (db !== undefined) nb = Math.max(minBeats, grid.indexNear(db) - beatIdx)
    }
    const end = grid.at(beatIdx + nb)
    beatIdx += nb
    const duration = end - start
    const transition = { ...s.transition, duration: Math.min(s.transition.duration, duration * 0.6) }
    scenes.push({ ...s, transition, id: newSceneId(), start, duration, seed: Math.floor(r() * 1e9) })
  }

  // ---- 片头：选一张分数高、方向和画布一致的照片 ----
  const byScore = [...photos].sort((a, b) => (b.analysis?.score ?? 50) - (a.analysis?.score ?? 50))
  const introPhoto = tpl.intro.slots.length ? byScore.find((p) => slotAccepts(tpl.intro.slots[0], p, aspect)) ?? byScore[0] : undefined
  pushScene({ kind: 'intro', styleId: tpl.intro.id, photos: introPhoto ? [introPhoto.id] : [], transition: { name: 'fade', duration: 0.8 } }, introSec, 4)

  // ---- 正片 ----
  const queue = [...photos]
  const recent: string[] = []
  let prevTrans: string | null = 'fade'
  let captionIdx = Math.floor(r() * Math.max(1, tpl.captions.length))
  const styles = tpl.styles.filter((s) => !s.aspects || s.aspects.includes(aspect))
  while (queue.length) {
    const t = grid.at(beatIdx)
    const energy = energyAt(music, t, musicOffset)
    const remaining = queue.length
    const cands: { style: SceneStyle; idx: number[] }[] = []
    for (const st of styles) {
      if (st.slots.length > remaining) continue
      const idx = assign(st, queue, aspect)
      if (idx) cands.push({ style: st, idx })
    }
    let chosen: { style: SceneStyle; idx: number[] }
    if (cands.length) {
      chosen = pickWeighted(
        cands,
        (c) => {
          let w = c.style.weight ?? 1
          const [e0, e1] = c.style.energy ?? [0, 1]
          if (energy < e0 - 0.05 || energy > e1 + 0.05) w *= 0.3
          // 带品名的照片优先放进产品版式（蛋糕店模板）
          if (c.style.needsProduct) w *= 1.8
          // AI 标记的高光照片和视频片段优先用单图大画面
          const head = queue[c.idx[0]]
          if ((head.ai?.highlight || head.media === 'video') && c.style.slots.length === 1) w *= 2.5
          if (recent[recent.length - 1] === c.style.id) w *= 0.08
          else if (recent.includes(c.style.id)) w *= 0.45
          // 多图版式在照片多、节奏快时更常出现
          if (c.style.slots.length > 1) w *= pace === 'fast' ? 1.3 : pace === 'slow' ? 0.8 : 1
          return w
        },
        r()
      )
    } else {
      // 没有完全匹配的版式：用单图版式兜底
      const single = styles.find((s) => s.slots.length === 1 && s.slots[0] === 'any') ?? styles.find((s) => s.slots.length === 1) ?? styles[0]
      chosen = { style: single, idx: [0] }
    }
    const picked = chosen.idx.map((i) => queue[i])
    for (const i of [...chosen.idx].sort((a, b) => b - a)) queue.splice(i, 1)
    recent.push(chosen.style.id)
    if (recent.length > 3) recent.shift()

    const n = chosen.style.slots.length
    const energyFactor = 1.15 - energy * 0.35
    let target = perPhoto * (n === 1 ? 1 : n * (chosen.style.durationFactor ?? 0.75)) * energyFactor
    const lead = picked[0]
    if (lead.media === 'video') target = clamp(lead.duration ?? perPhoto, 2, perPhoto * 3)
    else if (lead.ai?.highlight && n === 1) target *= 1.25
    const trans = pickTransition(tpl, r, prevTrans, P, energy)
    prevTrans = trans.name
    const texts: Record<string, string> = {}
    if (chosen.style.captionKey) {
      // AI 写的字幕优先，否则用模板文案库
      const aiCaption = picked.find((p) => p.ai?.caption)?.ai?.caption
      if (aiCaption) texts.caption = aiCaption
      else if (tpl.captions.length && r() < 0.75) {
        texts.caption = tpl.captions[captionIdx % tpl.captions.length]
        captionIdx++
      }
    }
    pushScene({ kind: 'photo', styleId: chosen.style.id, photos: picked.map((p) => p.id), transition: trans, texts }, Math.max(1.2, target), n > 1 ? 4 : 2)
  }
  // 最后一个正片场景用柔和转场进片尾
  if (scenes.length > 1) scenes[scenes.length - 1].transition = { name: 'fade', duration: clamp(P * 2, 0.6, 1.2) }

  // ---- 片尾 ----
  const outroPhoto = tpl.outro.slots.length ? byScore[1] ?? byScore[0] : undefined
  pushScene({ kind: 'outro', styleId: tpl.outro.id, photos: outroPhoto ? [outroPhoto.id] : [], transition: { name: 'fade', duration: 0.8 } }, outroSec, 4)

  return { scenes, musicOffset }
}

/** 编辑后（删除、排序、改时长）重新计算每个场景的开始时间 */
export function retime(scenes: Scene[]): Scene[] {
  let t = 0
  return scenes.map((s) => {
    const n = { ...s, start: t }
    t += s.duration
    return n
  })
}

/**
 * 找音乐里最热闹的一段（副歌）：在能量曲线上滑动窗口，取平均能量最高的起点，
 * 再对齐到最近的小节第一拍。返回秒。
 */
export function findChorus(music: MusicAnalysis, length: number): number {
  const e = music.energy
  const step = music.energyStep
  const win = Math.max(1, Math.round(Math.min(length, music.duration * 0.8) / step))
  if (e.length <= win) return 0
  let sum = 0
  for (let i = 0; i < win; i++) sum += e[i]
  let best = sum
  let bestI = 0
  for (let i = win; i < e.length; i++) {
    sum += e[i] - e[i - win]
    if (sum > best + 1e-6) {
      best = sum
      bestI = i - win + 1
    }
  }
  const t = bestI * step
  const db = music.downbeats.filter((d) => d <= t + 0.05)
  return db.length ? db[db.length - 1] : t
}

/**
 * 重新编排后保留用户的手动编辑：贴纸 / 文字、改过的文字内容和样式。
 * 新旧场景按「首张照片」对应，片头片尾按类型对应。换模板时不保留模板文字的样式（字号位置可能不同）。
 */
export function carryEdits(old: Scene[], fresh: Scene[], templateChanged: boolean): Scene[] {
  const key = (s: Scene): string => (s.kind === 'photo' ? 'p:' + (s.photos[0] ?? '') : s.kind)
  const map = new Map(old.map((s) => [key(s), s]))
  return fresh.map((s) => {
    const o = map.get(key(s))
    if (!o) return s
    const n = { ...s }
    if (o.overlays?.length) n.overlays = o.overlays
    if (o.texts && Object.keys(o.texts).length) n.texts = { ...s.texts, ...o.texts }
    if (o.textStyle && !templateChanged) n.textStyle = o.textStyle
    if (o.focus) n.focus = o.focus
    return n
  })
}
