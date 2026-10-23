// 全局滤镜：覆盖模板自带的调色
import type { Grade } from './types'

export interface FilterDef {
  id: string
  label: string
  grade: Partial<Grade> | null // null 表示使用模板调色
}

export const FILTERS: FilterDef[] = [
  { id: 'template', label: '模板默认', grade: null },
  { id: 'natural', label: '原片', grade: {} },
  { id: 'fresh', label: '清新', grade: { exposure: 0.08, contrast: 0.95, saturation: 0.92, warmth: -0.08, fade: 0.04, splitShadow: '#7fa8b8', splitHighlight: '#f2fff4', splitAmount: 0.06 } },
  { id: 'warm', label: '暖阳', grade: { exposure: 0.04, saturation: 1.05, warmth: 0.35, splitShadow: '#8a6a5a', splitHighlight: '#ffd9a0', splitAmount: 0.1 } },
  { id: 'japan', label: '日系', grade: { exposure: 0.12, contrast: 0.88, saturation: 0.82, warmth: -0.04, tint: 0.05, fade: 0.08 } },
  { id: 'film', label: '胶片', grade: { contrast: 1.05, saturation: 0.85, warmth: 0.2, fade: 0.1, splitShadow: '#2f5d62', splitHighlight: '#ffbd80', splitAmount: 0.14 } },
  { id: 'vivid', label: '鲜艳', grade: { contrast: 1.1, saturation: 1.3, exposure: 0.02 } },
  { id: 'cool', label: '冷调', grade: { warmth: -0.3, saturation: 0.9, contrast: 1.04, splitShadow: '#2a3d6b', splitHighlight: '#dff1ff', splitAmount: 0.1 } },
  { id: 'mono', label: '黑白', grade: { mono: 1, contrast: 1.15, exposure: 0.02 } }
]

export const FILTER_MAP = new Map(FILTERS.map((f) => [f.id, f]))

export type BeatFx = 'auto' | 'none' | 'pulse' | 'flash' | 'both'

export const BEAT_FX_LABEL: Record<BeatFx, string> = { auto: '模板默认', none: '关闭', pulse: '缩放脉冲', flash: '闪光', both: '脉冲+闪光' }
