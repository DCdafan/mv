// 音乐节拍分析（纯函数，可在 Worker 和单元测试里运行）
// 流程：STFT → 频谱通量（起音强度）→ 自相关估计速度 → 动态规划节拍追踪 → 小节重拍 → 能量曲线
import type { MusicAnalysis } from '@shared/types'

const N = 1024
const HOP = 512

function makeFFT(n: number): (re: Float32Array, im: Float32Array) => void {
  const levels = Math.log2(n)
  const rev = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    let r = 0
    for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b)
    rev[i] = r
  }
  const cos = new Float32Array(n / 2)
  const sin = new Float32Array(n / 2)
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n)
    sin[i] = -Math.sin((2 * Math.PI * i) / n)
  }
  return (re, im) => {
    for (let i = 0; i < n; i++) {
      const j = rev[i]
      if (j > i) {
        let t = re[i]
        re[i] = re[j]
        re[j] = t
        t = im[i]
        im[i] = im[j]
        im[j] = t
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1
      const step = n / size
      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < half; j++) {
          const k = j * step
          const a = i + j
          const b = a + half
          const tr = re[b] * cos[k] - im[b] * sin[k]
          const ti = re[b] * sin[k] + im[b] * cos[k]
          re[b] = re[a] - tr
          im[b] = im[a] - ti
          re[a] += tr
          im[a] += ti
        }
      }
    }
  }
}

function movingAverage(x: Float32Array, win: number): Float32Array {
  const out = new Float32Array(x.length)
  const h = Math.floor(win / 2)
  let sum = 0
  let lo = 0
  let hi = -1
  for (let i = 0; i < x.length; i++) {
    const a = Math.max(0, i - h)
    const b = Math.min(x.length - 1, i + h)
    while (hi < b) sum += x[++hi]
    while (lo < a) sum -= x[lo++]
    out[i] = sum / (hi - lo + 1)
  }
  return out
}

export interface OnsetResult {
  onset: Float32Array // 起音强度，已归一化
  low: Float32Array // 低频起音（判断重拍）
  fps: number
}

export function onsetEnvelope(samples: Float32Array, sr: number): OnsetResult {
  const fft = makeFFT(N)
  const frames = Math.max(1, Math.floor((samples.length - N) / HOP) + 1)
  const win = new Float32Array(N)
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
  const re = new Float32Array(N)
  const im = new Float32Array(N)
  const bins = N / 2
  const lowBins = Math.max(2, Math.round((200 * N) / sr))
  let prev = new Float32Array(bins)
  let cur = new Float32Array(bins)
  const flux = new Float32Array(frames)
  const low = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    const off = f * HOP
    for (let i = 0; i < N; i++) {
      re[i] = (samples[off + i] ?? 0) * win[i]
      im[i] = 0
    }
    fft(re, im)
    let s = 0
    let sl = 0
    for (let k = 1; k < bins; k++) {
      const m = Math.log1p(100 * Math.hypot(re[k], im[k]))
      cur[k] = m
      const d = m - prev[k]
      if (d > 0) {
        s += d
        if (k < lowBins) sl += d
      }
    }
    flux[f] = f === 0 ? 0 : s
    low[f] = f === 0 ? 0 : sl
    const t = prev
    prev = cur
    cur = t
  }
  const fps = sr / HOP
  const norm = (x: Float32Array): Float32Array => {
    const avg = movingAverage(x, Math.round(fps * 0.5))
    const out = new Float32Array(x.length)
    let mean = 0
    for (let i = 0; i < x.length; i++) {
      out[i] = Math.max(0, x[i] - avg[i])
      mean += out[i]
    }
    mean /= x.length || 1
    let v = 0
    for (let i = 0; i < x.length; i++) v += (out[i] - mean) ** 2
    const sd = Math.sqrt(v / (x.length || 1)) || 1
    for (let i = 0; i < x.length; i++) out[i] /= sd
    return out
  }
  return { onset: norm(flux), low: norm(low), fps }
}

/** 自相关估计速度，带 120 BPM 附近的先验，返回每拍的帧数 */
export function estimatePeriod(raw: Float32Array, fps: number): { period: number; bpm: number } {
  // 轻微平滑，避免周期不是整数帧时峰值错位导致倍频误判
  const onset = new Float32Array(raw.length)
  const k = [0.15, 0.5, 1, 0.5, 0.15]
  for (let i = 0; i < raw.length; i++) {
    let s = 0
    for (let j = -2; j <= 2; j++) s += (raw[i + j] ?? 0) * k[j + 2]
    onset[i] = s
  }
  const minLag = Math.floor((fps * 60) / 200)
  const maxLag = Math.ceil((fps * 60) / 55)
  const n = onset.length
  let best = minLag
  let bestScore = -Infinity
  const scores = new Float32Array(maxLag + 2)
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0
    for (let i = lag; i < n; i++) s += onset[i] * onset[i - lag]
    s /= n - lag || 1
    scores[lag] = s
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fps) / lag
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115) / 0.9, 2))
    const s = scores[lag] * prior
    if (s > bestScore) {
      bestScore = s
      best = lag
    }
  }
  // 抛物线插值细化
  const a = scores[best - 1] ?? scores[best]
  const b = scores[best]
  const c = scores[best + 1] ?? scores[best]
  const denom = a - 2 * b + c
  const shift = denom !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom)) : 0
  const period = best + shift
  return { period, bpm: (60 * fps) / period }
}

/** Ellis 动态规划节拍追踪 */
export function trackBeats(onset: Float32Array, period: number, tightness = 100): number[] {
  const n = onset.length
  if (n === 0) return []
  const score = new Float32Array(n)
  const back = new Int32Array(n).fill(-1)
  const lo = Math.round(period / 2)
  const hi = Math.round(period * 2)
  for (let t = 0; t < n; t++) {
    let best = 0
    let bi = -1
    for (let tau = t - hi; tau <= t - lo; tau++) {
      if (tau < 0) continue
      const d = Math.log((t - tau) / period)
      const s = score[tau] - tightness * d * d
      if (bi < 0 || s > best) {
        best = s
        bi = tau
      }
    }
    score[t] = onset[t] + (bi >= 0 ? Math.max(0, best) : 0)
    back[t] = bi >= 0 && best > 0 ? bi : -1
  }
  // 从最后一个周期内得分最高处回溯
  let end = n - 1
  let m = -Infinity
  for (let t = Math.max(0, n - Math.round(period)); t < n; t++) {
    if (score[t] > m) {
      m = score[t]
      end = t
    }
  }
  const beats: number[] = []
  for (let t = end; t >= 0; t = back[t]) {
    beats.push(t)
    if (back[t] < 0) break
  }
  beats.reverse()
  // 开头没追到的部分按周期向前补齐
  let first = beats[0] ?? 0
  while (first - period >= 0) {
    first -= period
    beats.unshift(Math.round(first))
  }
  return beats
}

export function analyzeSamples(samples: Float32Array, sr: number): MusicAnalysis {
  const duration = samples.length / sr
  const { onset, low, fps } = onsetEnvelope(samples, sr)
  const { period, bpm } = estimatePeriod(onset, fps)
  const beatFrames = trackBeats(onset, period)
  const beats = beatFrames.map((f) => f / fps).filter((t) => t < duration)

  // 节拍可信度：拍点上的起音强度对比两拍中间（反拍）的强度
  let onBeat = 0
  let offBeat = 0
  const half = Math.round(period / 2)
  for (const f of beatFrames) {
    onBeat += Math.max(onset[f] ?? 0, onset[f + 1] ?? 0, onset[f - 1] ?? 0)
    offBeat += Math.max(onset[f + half] ?? 0, onset[f + half + 1] ?? 0, onset[f + half - 1] ?? 0)
  }
  const confidence = Math.max(0, Math.min(1, (onBeat - offBeat) / (onBeat + offBeat || 1)))

  // 重拍：4/4 拍，挑低频起音最强的相位
  let phase = 0
  let bestPhase = -Infinity
  for (let k = 0; k < 4; k++) {
    let s = 0
    for (let i = k; i < beatFrames.length; i += 4) s += (low[beatFrames[i]] ?? 0) + 0.5 * (onset[beatFrames[i]] ?? 0)
    if (s > bestPhase) {
      bestPhase = s
      phase = k
    }
  }
  const downbeats = beats.filter((_, i) => i % 4 === phase)

  // 能量曲线（0.25 秒一格，2 秒平滑，按 95 分位归一化）
  const step = 0.25
  const cells = Math.max(1, Math.ceil(duration / step))
  const rms = new Float32Array(cells)
  const per = Math.floor(sr * step)
  for (let c = 0; c < cells; c++) {
    let s = 0
    const a = c * per
    const b = Math.min(samples.length, a + per)
    for (let i = a; i < b; i++) s += samples[i] * samples[i]
    rms[c] = Math.sqrt(s / Math.max(1, b - a))
  }
  const smooth = movingAverage(rms, Math.round(2 / step))
  const sorted = [...smooth].sort((x, y) => x - y)
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1
  const energy = [...smooth].map((v) => Math.round(Math.min(1, v / p95) * 1000) / 1000)

  // 波形（界面绘制）
  const buckets = Math.min(2400, Math.max(200, Math.round(duration * 12)))
  const waveform: number[] = []
  const bsz = samples.length / buckets
  let wmax = 1e-6
  for (let i = 0; i < buckets; i++) {
    let m2 = 0
    const a = Math.floor(i * bsz)
    const b = Math.floor((i + 1) * bsz)
    for (let j = a; j < b; j += 4) m2 = Math.max(m2, Math.abs(samples[j]))
    waveform.push(m2)
    wmax = Math.max(wmax, m2)
  }

  return {
    duration,
    bpm: Math.round(bpm * 10) / 10,
    beats: beats.map((t) => Math.round(t * 1000) / 1000),
    downbeats: downbeats.map((t) => Math.round(t * 1000) / 1000),
    energy,
    energyStep: step,
    waveform: waveform.map((v) => Math.round((v / wmax) * 1000) / 1000),
    confidence: Math.round(confidence * 100) / 100
  }
}
