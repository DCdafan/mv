import { useEffect, useRef, useState } from 'react'
import type { BrandSettings, Overlay, Project } from '@shared/types'
import { projectDuration, ASPECT_SIZE } from '@shared/types'
import { Renderer } from '../engine/renderer'
import { getTemplate } from '../templates'
import { usePlayback, useApp } from '../store/app'
import { overlayBox } from '../engine/overlays'
import { decodeMusic, getAudioContext } from '../analysis/music'

/** 用 Web Audio 播放音乐，并以音频时钟驱动画面 */
class AudioClock {
  private src: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  private voice: AudioBufferSourceNode | null = null
  private extra: AudioNode[] = []
  private startedAt = 0
  private startT = 0
  private perfStart = 0
  playing = false

  async start(project: Project, t: number): Promise<void> {
    this.stop()
    this.startT = t
    this.perfStart = performance.now()
    this.playing = true
    this.startVoice(project, t)
    if (!project.music) return
    try {
      const buf = await decodeMusic(project.music.path)
      if (!this.playing) return
      const ctx = getAudioContext()
      await ctx.resume()
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const gain = ctx.createGain()
      const vol = project.settings.musicVolume
      const total = projectDuration(project)
      const fade = Math.min(project.settings.fadeOut, total / 3)
      const now = ctx.currentTime
      // 补偿解码耗时，保持和画面同步
      const elapsed = (performance.now() - this.perfStart) / 1000
      const t0 = t + elapsed
      gain.gain.setValueAtTime(vol, now)
      const fadeStart = total - fade
      if (t0 < fadeStart) {
        gain.gain.setValueAtTime(vol, now + (fadeStart - t0))
        gain.gain.linearRampToValueAtTime(0.0001, now + (total - t0))
      } else {
        const remain = Math.max(0.05, total - t0)
        gain.gain.setValueAtTime(vol * Math.max(0, remain / fade), now)
        gain.gain.linearRampToValueAtTime(0.0001, now + remain)
      }
      // 旁白期间压低背景音乐（与导出时的混音一致）
      const duck = ctx.createGain()
      const vo = project.voiceover
      if (vo) {
        const s0 = vo.start - t0
        const e0 = vo.start + vo.duration - t0
        duck.gain.setValueAtTime(s0 <= 0 && e0 > 0 ? vo.duck : 1, now)
        if (s0 > 0) duck.gain.setValueAtTime(vo.duck, now + s0)
        if (e0 > 0) duck.gain.setValueAtTime(1, now + e0)
      }
      this.extra.push(duck)
      src.connect(gain).connect(duck).connect(ctx.destination)
      src.start(0, (project.musicOffset + t0) % buf.duration)
      this.src = src
      this.gain = gain
      this.startedAt = now
      this.startT = t0
    } catch (e) {
      console.warn('音乐播放失败', e)
    }
  }

  /** 旁白：和音乐同一个时钟 */
  private async startVoice(project: Project, t: number): Promise<void> {
    const vo = project.voiceover
    if (!vo || !this.playing) return
    try {
      const buf = await decodeMusic(vo.path)
      if (!this.playing) return
      const ctx = getAudioContext()
      await ctx.resume()
      const now = ctx.currentTime
      const elapsed = (performance.now() - this.perfStart) / 1000
      const t0 = t + elapsed
      const offset = t0 - vo.start
      if (offset >= buf.duration) return
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = ctx.createGain()
      g.gain.value = vo.volume
      src.connect(g).connect(ctx.destination)
      if (offset >= 0) src.start(now, offset)
      else src.start(now - offset)
      this.voice = src
      this.extra.push(g)
    } catch (e) {
      console.warn('旁白播放失败', e)
    }
  }

  time(): number {
    if (this.src) return this.startT + (getAudioContext().currentTime - this.startedAt)
    return this.startT + (performance.now() - this.perfStart) / 1000
  }

  stop(): void {
    this.playing = false
    try {
      this.src?.stop()
    } catch {
      /* 已停止 */
    }
    try {
      this.voice?.stop()
    } catch {
      /* 已停止 */
    }
    this.voice?.disconnect()
    this.voice = null
    for (const n of this.extra) n.disconnect()
    this.extra = []
    this.src?.disconnect()
    this.gain?.disconnect()
    this.src = null
    this.gain = null
  }
}

export const clock = new AudioClock()

export function Player({ project, brand }: { project: Project; brand: BrandSettings | null }): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const [box, setBox] = useState<[number, number]>([640, 360])
  const playing = usePlayback((s) => s.playing)
  const projectRef = useRef(project)
  projectRef.current = project

  // 初始化渲染器
  useEffect(() => {
    const r = new Renderer(canvasRef.current!, { maxTextureSize: 2048, useOriginals: false })
    rendererRef.current = r
    r.onNeedsRedraw = () => {
      if (!usePlayback.getState().playing) requestAnimationFrame(() => r.render(usePlayback.getState().time))
    }
    return () => {
      clock.stop()
      r.dispose()
      rendererRef.current = null
    }
  }, [])

  // 适配容器尺寸，保持画幅比例
  useEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(() => {
      const [aw, ah] = ASPECT_SIZE[projectRef.current.aspect]
      const W = el.clientWidth - 36
      const H = el.clientHeight - 36
      const k = Math.min(W / aw, H / ah)
      setBox([Math.max(100, Math.floor(aw * k)), Math.max(60, Math.floor(ah * k))])
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [project.aspect])

  useEffect(() => {
    const r = rendererRef.current
    if (!r) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const maxW = project.aspect === '9:16' ? 1080 : 1920
    const k = Math.min(dpr, maxW / box[0])
    r.setSize(box[0] * k, box[1] * k)
    r.setProject(project, getTemplate(project.templateId), brand)
    if (!usePlayback.getState().playing) r.render(usePlayback.getState().time)
  }, [project, brand, box])

  // 暂停时跟随时间重画
  useEffect(
    () =>
      usePlayback.subscribe((s, prev) => {
        if (!s.playing && s.time !== prev.time) rendererRef.current?.render(s.time)
      }),
    []
  )

  // 播放循环
  useEffect(() => {
    const r0 = rendererRef.current
    if (r0) r0.playing = playing
    if (!playing) {
      clock.stop()
      r0?.photos.pauseAll()
      r0?.render(usePlayback.getState().time)
      return
    }
    const total = projectDuration(projectRef.current)
    let t0 = usePlayback.getState().time
    if (t0 >= total - 0.05) t0 = 0
    clock.start(projectRef.current, t0)
    let raf = 0
    const tick = (): void => {
      const t = clock.time()
      const tot = projectDuration(projectRef.current)
      if (t >= tot) {
        usePlayback.setState({ playing: false, time: tot })
        rendererRef.current?.render(tot - 0.001)
        return
      }
      rendererRef.current?.render(t)
      usePlayback.setState({ time: t })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clock.stop()
    }
  }, [playing])

  return (
    <div className="stage-canvas" ref={wrapRef}>
      <div style={{ position: 'relative', width: box[0], height: box[1] }}>
        <canvas ref={canvasRef} style={{ width: box[0], height: box[1] }} />
        {!playing && <OverlayHandles project={project} w={box[0]} h={box[1]} />}
      </div>
    </div>
  )
}

/** 画面上的贴纸 / 文字选择框：点击选中、拖动移动、拖右下角缩放 */
function OverlayHandles({ project, w, h }: { project: Project; w: number; h: number }): JSX.Element | null {
  const time = usePlayback((s) => s.time)
  const selectedOverlayId = useApp((s) => s.selectedOverlayId)
  const { commit, selectOverlay } = useApp()
  const scene = project.scenes.find((s) => time >= s.start && time < s.start + s.duration)
  if (!scene?.overlays?.length) return null
  const [aw, ah] = ASPECT_SIZE[project.aspect]
  const update = (id: string, patch: Partial<Overlay>): void =>
    commit((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === scene.id ? { ...s, overlays: (s.overlays ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o)) } : s)) }), { merge: 'drag-' + id })
  const startDrag = (e: React.MouseEvent, o: Overlay, mode: 'move' | 'scale'): void => {
    e.stopPropagation()
    e.preventDefault()
    selectOverlay(scene.id, o.id)
    const sx = e.clientX
    const sy = e.clientY
    const o0 = { ...o }
    const move = (ev: MouseEvent): void => {
      const dx = (ev.clientX - sx) / w
      const dy = (ev.clientY - sy) / h
      if (mode === 'move') update(o.id, { x: Math.max(0, Math.min(1, o0.x + dx)), y: Math.max(0, Math.min(1, o0.y + dy)) })
      else {
        const k = Math.max(0.2, 1 + (dx * 2) / Math.max(0.05, o0.w))
        update(o.id, { w: Math.min(1.2, Math.max(0.03, o0.w * k)), size: o0.size ? Math.min(0.25, Math.max(0.015, o0.size * k)) : o0.size })
      }
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  return (
    <div style={{ position: 'absolute', inset: 0 }} onMouseDown={() => selectOverlay(useApp.getState().selectedSceneId, null)}>
      {scene.overlays.map((o) => {
        const b = overlayBox(o, aw, ah)
        const sel = o.id === selectedOverlayId
        return (
          <div
            key={o.id}
            onMouseDown={(e) => startDrag(e, o, 'move')}
            title="拖动移动，右下角缩放"
            style={{
              position: 'absolute',
              left: b.x * w,
              top: b.y * h,
              width: b.w * w,
              height: b.h * h,
              transform: `rotate(${o.rotation}deg)`,
              border: sel ? '1.5px solid var(--accent)' : '1px dashed rgba(255,255,255,0.35)',
              borderRadius: 4,
              cursor: 'move'
            }}
          >
            {sel && (
              <div
                onMouseDown={(e) => startDrag(e, o, 'scale')}
                style={{ position: 'absolute', right: -6, bottom: -6, width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', border: '2px solid #fff', cursor: 'nwse-resize' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
