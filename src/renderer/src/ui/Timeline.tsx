import { useEffect, useMemo, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, Diamond } from 'lucide-react'
import type { Project } from '@shared/types'
import { projectDuration } from '@shared/types'
import { useApp, usePlayback } from '../store/app'
import { getTemplate } from '../templates'
import { findStyle } from '../engine/renderer'
import { transitionLabel } from '../engine/transitions'
import { thumbUrl, fmtTime } from './common'
import { retime } from '../arrange/arranger'

const RULER = 22
const TRACK_Y = RULER + 8
const TRACK_H = 92
const WAVE_H = 40

export function Timeline({ project }: { project: Project }): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const waveRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(800)
  const [zoom, setZoom] = useState(1)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const { selectedSceneId, selectScene, commit } = useApp()
  const time = usePlayback((s) => s.time)
  const total = projectDuration(project)
  const tpl = getTemplate(project.templateId)
  const photoMap = useMemo(() => new Map(project.photos.map((p) => [p.id, p])), [project.photos])

  useEffect(() => {
    const el = scrollRef.current!
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pps = Math.max(8, ((width - 40) / Math.max(total, 1)) * zoom) // 每秒像素
  const contentW = Math.max(width, total * pps + 40)

  // 波形与节拍刻度
  useEffect(() => {
    const c = waveRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = contentW * dpr
    c.height = WAVE_H * dpr
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    g.clearRect(0, 0, contentW, WAVE_H)
    const a = project.music?.analysis
    if (!a) return
    const wf = a.waveform
    const secPer = a.duration / wf.length
    g.fillStyle = 'rgba(255,138,91,0.35)'
    for (let x = 0; x < total * pps; x += 2) {
      const t = (x / pps + project.musicOffset) % a.duration
      const v = wf[Math.floor(t / secPer)] ?? 0
      const h = Math.max(1, v * (WAVE_H - 6))
      g.fillRect(x + 20, (WAVE_H - h) / 2, 1.5, h)
    }
    g.fillStyle = 'rgba(255,255,255,0.18)'
    for (const b of a.beats) {
      const t = b - project.musicOffset
      if (t < 0 || t > total) continue
      g.fillRect(20 + t * pps, WAVE_H - 5, 1, 5)
    }
    g.fillStyle = 'rgba(255,210,122,0.7)'
    for (const b of a.downbeats) {
      const t = b - project.musicOffset
      if (t < 0 || t > total) continue
      g.fillRect(20 + t * pps, WAVE_H - 9, 1.5, 9)
    }
  }, [project.music, project.musicOffset, pps, contentW, total])

  // 播放时让播放头保持可见
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !usePlayback.getState().playing) return
    const x = 20 + time * pps
    if (x > el.scrollLeft + el.clientWidth - 60 || x < el.scrollLeft) el.scrollLeft = x - 80
  }, [time, pps])

  const seekFromEvent = (e: React.MouseEvent): void => {
    const el = scrollRef.current!
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left + el.scrollLeft - 20
    usePlayback.setState({ time: Math.max(0, Math.min(total, x / pps)), playing: false })
  }

  const startScrub = (e: React.MouseEvent): void => {
    seekFromEvent(e)
    const move = (ev: MouseEvent): void => seekFromEvent(ev as unknown as React.MouseEvent)
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const moveScene = (id: string, toIndex: number): void => {
    commit((p) => {
      const scenes = [...p.scenes]
      const from = scenes.findIndex((s) => s.id === id)
      if (from < 0) return p
      const [s] = scenes.splice(from, 1)
      let to = toIndex > from ? toIndex - 1 : toIndex
      // 片头片尾固定位置
      to = Math.max(1, Math.min(scenes.length - 1, to))
      scenes.splice(to, 0, s)
      return { ...p, scenes: retime(scenes) }
    })
  }

  const ticks: number[] = []
  const step = pps > 60 ? 1 : pps > 25 ? 2 : pps > 12 ? 5 : 10
  for (let t = 0; t <= total; t += step) ticks.push(t)

  return (
    <div className="timeline">
      <div className="row" style={{ height: 34, padding: '0 12px', borderBottom: '1px solid var(--line)', flex: 'none' }}>
        <b>时间线</b>
        <span className="muted small">
          {project.scenes.length} 个场景 · {fmtTime(total)}
          {project.music?.analysis && ` · ${Math.round(project.music.analysis.bpm)} BPM`}
        </span>
        <span className="muted tiny">拖动场景可调整顺序，拖入照片可替换</span>
        <div className="grow" />
        <button className="btn sm icon ghost" onClick={() => setZoom((z) => Math.max(1, z / 1.5))} title="缩小">
          <ZoomOut size={14} />
        </button>
        <input type="range" min={1} max={8} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: 100 }} />
        <button className="btn sm icon ghost" onClick={() => setZoom((z) => Math.min(8, z * 1.5))} title="放大">
          <ZoomIn size={14} />
        </button>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
        <div style={{ width: contentW, height: '100%', position: 'relative' }}>
          {/* 刻度尺 */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: contentW, height: RULER, cursor: 'pointer' }} onMouseDown={startScrub}>
            {ticks.map((t) => (
              <div key={t} style={{ position: 'absolute', left: 20 + t * pps, top: 0, height: RULER, borderLeft: '1px solid var(--line-2)', paddingLeft: 3, fontSize: 10, color: 'var(--muted)' }}>
                {fmtTime(t)}
              </div>
            ))}
          </div>
          {/* 场景块 */}
          {project.scenes.map((s, i) => {
            const st = findStyle(tpl, s.styleId)
            const x = 20 + s.start * pps
            const w = Math.max(6, s.duration * pps - 2)
            const sel = s.id === selectedSceneId
            const fixed = s.kind !== 'photo'
            const thumbs = s.photos.map((id) => (id ? photoMap.get(id)?.thumb : undefined))
            return (
              <div
                key={s.id}
                draggable={!fixed}
                onDragStart={(e) => {
                  setDragId(s.id)
                  e.dataTransfer.setData('application/x-mv-scene', s.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => {
                  setDragId(null)
                  setDropAt(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (e.dataTransfer.types.includes('application/x-mv-scene')) {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    setDropAt(e.clientX < r.left + r.width / 2 ? i : i + 1)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const sid = e.dataTransfer.getData('application/x-mv-scene')
                  const pid = e.dataTransfer.getData('application/x-mv-photo')
                  if (sid && dropAt !== null) moveScene(sid, dropAt)
                  else if (pid && s.photos.length) {
                    commit((p) => ({ ...p, scenes: p.scenes.map((x) => (x.id === s.id ? { ...x, photos: [pid, ...x.photos.slice(1)] } : x)) }))
                  }
                  setDropAt(null)
                }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return
                  selectScene(s.id)
                  if (!usePlayback.getState().playing) usePlayback.setState({ time: s.start + Math.min(s.duration * 0.5, 1.5) })
                }}
                title={`${s.kind === 'intro' ? '片头' : s.kind === 'outro' ? '片尾' : st.name} · ${s.duration.toFixed(1)} 秒`}
                style={{
                  position: 'absolute',
                  left: x,
                  top: TRACK_Y,
                  width: w,
                  height: TRACK_H,
                  borderRadius: 7,
                  overflow: 'hidden',
                  cursor: fixed ? 'pointer' : 'grab',
                  border: `2px solid ${sel ? 'var(--accent)' : 'var(--line-2)'}`,
                  background: fixed ? 'linear-gradient(135deg,#3a2b4a,#2a2f45)' : 'var(--panel-2)',
                  opacity: dragId === s.id ? 0.4 : 1,
                  display: 'flex'
                }}
              >
                {thumbs.length ? (
                  thumbs.map((t, k) => <div key={k} style={{ flex: 1, backgroundImage: thumbUrl(t), backgroundSize: 'cover', backgroundPosition: 'center', borderRight: k < thumbs.length - 1 ? '1px solid #000' : 0 }} />)
                ) : (
                  <div style={{ flex: 1 }} />
                )}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 6px 4px', background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.kind === 'intro' ? '片头' : s.kind === 'outro' ? '片尾' : `${i}. ${st.name}`}
                  <span style={{ opacity: 0.6, marginLeft: 4 }}>{s.duration.toFixed(1)}s</span>
                </div>
              </div>
            )
          })}
          {/* 转场标记 */}
          {project.scenes.slice(0, -1).map((s) => (
            <div
              key={'tr' + s.id}
              title={`转场：${transitionLabel(s.transition.name)}`}
              onMouseDown={() => selectScene(s.id)}
              style={{ position: 'absolute', left: 20 + (s.start + s.duration) * pps - 9, top: TRACK_Y + TRACK_H / 2 - 9, width: 18, height: 18, borderRadius: 5, background: s.transition.name === 'cut' ? 'var(--panel-3)' : 'var(--accent)', color: '#1b1208', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.5)', zIndex: 2 }}
            >
              <Diamond size={10} />
            </div>
          ))}
          {/* 拖放插入位置 */}
          {dropAt !== null && project.scenes[Math.min(dropAt, project.scenes.length - 1)] && (
            <div style={{ position: 'absolute', left: 20 + (dropAt >= project.scenes.length ? total : project.scenes[dropAt].start) * pps - 2, top: TRACK_Y - 4, width: 4, height: TRACK_H + 8, background: 'var(--accent)', borderRadius: 2, zIndex: 3 }} />
          )}
          {/* 音乐波形 */}
          <canvas ref={waveRef} onMouseDown={startScrub} style={{ position: 'absolute', left: 0, top: TRACK_Y + TRACK_H + 8, width: contentW, height: WAVE_H, cursor: 'pointer' }} />
          {!project.music && (
            <div className="muted tiny" style={{ position: 'absolute', left: 24, top: TRACK_Y + TRACK_H + 20 }}>
              未添加音乐
            </div>
          )}
          {/* 播放头 */}
          <div style={{ position: 'absolute', left: 20 + time * pps - 1, top: 0, bottom: 0, width: 2, background: '#fff', zIndex: 4, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: 0, left: -5, width: 12, height: 10, background: '#fff', clipPath: 'polygon(0 0,100% 0,50% 100%)' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
