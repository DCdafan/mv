import { useEffect, useRef, useState } from 'react'
import type { BrandSettings, Project } from '@shared/types'
import { projectDuration, ASPECT_SIZE } from '@shared/types'
import { Renderer } from '../engine/renderer'
import { getTemplate } from '../templates'
import { usePlayback } from '../store/app'
import { decodeMusic, getAudioContext } from '../analysis/music'

/** 用 Web Audio 播放音乐，并以音频时钟驱动画面 */
class AudioClock {
  private src: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  private startedAt = 0
  private startT = 0
  private perfStart = 0
  playing = false

  async start(project: Project, t: number): Promise<void> {
    this.stop()
    this.startT = t
    this.perfStart = performance.now()
    this.playing = true
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
      src.connect(gain).connect(ctx.destination)
      src.start(0, (project.musicOffset + t0) % buf.duration)
      this.src = src
      this.gain = gain
      this.startedAt = now
      this.startT = t0
    } catch (e) {
      console.warn('音乐播放失败', e)
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
    if (!playing) {
      clock.stop()
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
      <canvas ref={canvasRef} style={{ width: box[0], height: box[1] }} />
    </div>
  )
}
