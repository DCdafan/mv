// 场景里自由添加的文字和贴纸 → 引擎图层
import type { Overlay } from '@shared/types'
import type { AnimSpec, FontKey, Layer, LoopSpec } from './types'
import { DECORS } from './decor'

export const OVERLAY_ANIM_LABEL: Record<Overlay['anim'], string> = {
  none: '无',
  pop: '弹出',
  fade: '淡入',
  drop: '掉落',
  float: '漂浮',
  spin: '旋转',
  pulse: '心跳'
}

function anim(a: Overlay['anim']): { in?: AnimSpec; loop?: LoopSpec } {
  switch (a) {
    case 'pop':
      return { in: { type: 'pop', delay: 0.2, duration: 0.6 } }
    case 'fade':
      return { in: { type: 'fade', delay: 0.2, duration: 0.8 } }
    case 'drop':
      return { in: { type: 'drop', delay: 0.2, duration: 1 } }
    case 'float':
      return { in: { type: 'fade', duration: 0.5 }, loop: { type: 'float', amp: 0.012, period: 3 } }
    case 'spin':
      return { in: { type: 'pop', duration: 0.5 }, loop: { type: 'spin', period: 6 } }
    case 'pulse':
      return { in: { type: 'pop', duration: 0.5 }, loop: { type: 'pulse', amp: 0.06, period: 1.2 } }
  }
  return {}
}

/** 贴纸的高度（相对画布高） */
export function overlayHeight(o: Overlay, W: number, H: number): number {
  if (o.kind === 'sticker') {
    const def = DECORS[o.decor ?? 'star']
    return def ? (o.w * W * (def.h / def.w)) / H : o.w
  }
  return ((o.size ?? 0.06) * Math.min(W, H) * 1.5) / H
}

/** 叠加元素在画布上的范围（归一化，供编辑器点选和拖动） */
export function overlayBox(o: Overlay, W: number, H: number): { x: number; y: number; w: number; h: number } {
  const h = overlayHeight(o, W, H)
  return { x: o.x - o.w / 2, y: o.y - h / 2, w: o.w, h }
}

export function overlayToLayer(o: Overlay, W: number, H: number): Layer {
  const box = overlayBox(o, W, H)
  const a = anim(o.anim)
  if (o.kind === 'sticker') {
    return { type: 'decor', decor: o.decor ?? 'star', color: o.color, color2: o.color2, rect: { ...box, h: 0 }, rotation: o.rotation, ...a }
  }
  return {
    type: 'text',
    text: o.text ?? '',
    rect: box,
    rotation: o.rotation,
    style: {
      font: (o.font as FontKey) ?? 'ZCOOLKuaiLe',
      size: o.size ?? 0.06,
      color: o.color,
      stroke: o.color2 ? { color: o.color2, width: 0.08 } : undefined,
      shadow: { color: 'rgba(0,0,0,0.35)', blur: 0.12, dy: 0.04 },
      lineHeight: 1.3
    },
    ...a
  }
}

let seq = 0
export const newOverlayId = (): string => 'o' + Date.now().toString(36) + (seq++).toString(36)
