import { clamp, EASE, lerp, hash01 } from './math'
import type { AnimSpec, Layer, MotionType } from './types'

export interface LayerState {
  dx: number
  dy: number
  sx: number
  sy: number
  rot: number
  alpha: number
  reveal: number
}

function applyAnim(st: LayerState, spec: AnimSpec, p: number, W: number, H: number): void {
  const dist = spec.distance
  switch (spec.type) {
    case 'fade':
      st.alpha *= p
      break
    case 'slideUp':
      st.dy += (1 - p) * (dist ?? 0.06) * H
      st.alpha *= p
      break
    case 'slideDown':
      st.dy -= (1 - p) * (dist ?? 0.06) * H
      st.alpha *= p
      break
    case 'slideLeft':
      st.dx += (1 - p) * (dist ?? 0.06) * W
      st.alpha *= p
      break
    case 'slideRight':
      st.dx -= (1 - p) * (dist ?? 0.06) * W
      st.alpha *= p
      break
    case 'flyLeft':
      st.dx += (1 - p) * (dist ?? 1) * W
      break
    case 'flyRight':
      st.dx -= (1 - p) * (dist ?? 1) * W
      break
    case 'flyUp':
      st.dy += (1 - p) * (dist ?? 1) * H
      break
    case 'flyDown':
      st.dy -= (1 - p) * (dist ?? 1) * H
      break
    case 'zoomIn': {
      const s = lerp(dist ?? 0.6, 1, p)
      st.sx *= s
      st.sy *= s
      st.alpha *= clamp(p * 1.5)
      break
    }
    case 'zoomOut': {
      const s = lerp(dist ?? 1.35, 1, p)
      st.sx *= s
      st.sy *= s
      st.alpha *= clamp(p * 1.5)
      break
    }
    case 'pop': {
      st.sx *= Math.max(0, p)
      st.sy *= Math.max(0, p)
      st.alpha *= clamp(p * 3)
      break
    }
    case 'rotateIn': {
      st.rot += (1 - p) * -(dist ?? 0.6)
      const s = lerp(0.7, 1, p)
      st.sx *= s
      st.sy *= s
      st.alpha *= clamp(p * 2)
      break
    }
    case 'flipX':
      st.sx *= Math.max(0.001, p)
      st.alpha *= clamp(p * 4)
      break
    case 'reveal':
      st.reveal = Math.min(st.reveal, p)
      break
    case 'drop':
      st.dy -= (1 - p) * (dist ?? 0.3) * H
      st.alpha *= clamp(p * 4)
      break
    case 'spread': {
      st.sx *= lerp(1.25, 1, p)
      st.alpha *= p
      break
    }
  }
}

const DEFAULT_EASE: Partial<Record<AnimSpec['type'], keyof typeof EASE>> = {
  pop: 'outBack',
  drop: 'outBounce',
  flyLeft: 'outCubic',
  flyRight: 'outCubic',
  flyUp: 'outCubic',
  flyDown: 'outCubic',
  reveal: 'inOutQuad'
}

export function evalLayer(layer: Layer, lt: number, dur: number, W: number, H: number): LayerState {
  const st: LayerState = { dx: 0, dy: 0, sx: 1, sy: 1, rot: ((layer.rotation ?? 0) * Math.PI) / 180, alpha: layer.opacity ?? 1, reveal: 1 }
  if (layer.in && layer.in.type !== 'none') {
    const d = layer.in.duration ?? 0.7
    const raw = clamp((lt - (layer.in.delay ?? 0)) / d)
    const e = EASE[layer.in.ease ?? DEFAULT_EASE[layer.in.type] ?? 'outCubic']
    applyAnim(st, layer.in, e(raw), W, H)
  }
  if (layer.out && layer.out.type !== 'none') {
    const d = layer.out.duration ?? 0.5
    const startAt = dur - (layer.out.delay ?? 0) - d
    const raw = clamp((lt - startAt) / d)
    const e = EASE[layer.out.ease ?? 'inOutQuad']
    applyAnim(st, layer.out, 1 - e(raw), W, H)
  }
  if (layer.loop) {
    const per = layer.loop.period ?? 4
    const ph = Math.sin((lt / per) * Math.PI * 2)
    const amp = layer.loop.amp
    switch (layer.loop.type) {
      case 'float':
        st.dy += ph * (amp ?? 0.008) * H
        break
      case 'pulse': {
        const s = 1 + ph * (amp ?? 0.03)
        st.sx *= s
        st.sy *= s
        break
      }
      case 'sway':
        st.rot += ph * (amp ?? 0.05)
        break
      case 'spin':
        st.rot += (lt / per) * Math.PI * 2
        break
      case 'breathe':
        st.alpha *= 1 - (amp ?? 0.25) * (0.5 + 0.5 * ph)
        break
    }
  }
  return st
}

/**
 * 计算照片在矩形里的显示区域（cover 填充 + 推拉摇移）。
 * 返回图像 uv 空间的 [x, y, w, h]。
 */
export function photoUvRect(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
  focus: { x: number; y: number },
  motion: MotionType,
  strength: number,
  p: number
): [number, number, number, number] {
  const ia = imgW / imgH
  const ra = boxW / Math.max(1, boxH)
  let vw = 1
  let vh = 1
  if (ia > ra) vw = ra / ia
  else vh = ia / ra
  const k = 0.16 * strength
  let z = 1
  const pe = p
  switch (motion) {
    case 'zoomIn':
      z = 1 + k * pe
      break
    case 'zoomOut':
      z = 1 + k * (1 - pe)
      break
    case 'panLeft':
    case 'panRight':
    case 'panUp':
    case 'panDown':
      z = 1 + k * 0.6
      break
    case 'none':
      z = 1
      break
  }
  const ww = vw / z
  const wh = vh / z
  const sx = (1 - ww) / 2
  const sy = (1 - wh) / 2
  let cx: number
  let cy: number
  if (motion === 'panLeft' || motion === 'panRight') {
    const range = Math.min(sx, 0.18 * strength + 0.02)
    const c = clamp(focus.x, 0.5 - sx + range, 0.5 + sx - range)
    const from = motion === 'panLeft' ? c - range : c + range
    const to = motion === 'panLeft' ? c + range : c - range
    cx = lerp(from, to, pe)
    cy = focus.y
  } else if (motion === 'panUp' || motion === 'panDown') {
    const range = Math.min(sy, 0.22 * strength + 0.02)
    const c = clamp(focus.y, 0.5 - sy + range, 0.5 + sy - range)
    const from = motion === 'panUp' ? c + range : c - range
    const to = motion === 'panUp' ? c - range : c + range
    cy = lerp(from, to, pe)
    cx = focus.x
  } else {
    // 推近时视窗中心从画面中心移向兴趣点，拉远则反过来
    const mix = motion === 'zoomIn' ? pe : motion === 'zoomOut' ? 1 - pe : 1
    cx = lerp(0.5, focus.x, mix)
    cy = lerp(0.5, focus.y, mix)
  }
  cx = clamp(cx, ww / 2, 1 - ww / 2)
  cy = clamp(cy, wh / 2, 1 - wh / 2)
  return [cx - ww / 2, cy - wh / 2, ww, wh]
}

/** 'auto' 运镜：根据照片与画框比例和种子挑一种 */
export function resolveMotion(motion: MotionType | undefined, imgW: number, imgH: number, boxW: number, boxH: number, seed: number): MotionType {
  if (motion && motion !== 'auto') return motion
  const ia = imgW / imgH
  const ra = boxW / Math.max(1, boxH)
  const r = hash01(seed)
  if (ia < ra * 0.75) return r < 0.5 ? 'panUp' : 'panDown'
  if (ia > ra * 1.4) return r < 0.5 ? 'panLeft' : 'panRight'
  if (r < 0.4) return 'zoomIn'
  if (r < 0.7) return 'zoomOut'
  return r < 0.85 ? 'panLeft' : 'panRight'
}
