import { useEffect, useState } from 'react'
import { ChevronLeft, Undo2, Redo2, Shuffle, Download, Play, Pause, SkipBack, SkipForward, Film, Loader2, Maximize2, ImageDown } from 'lucide-react'
import { ASPECT_SIZE } from '@shared/types'
import { Renderer } from '../engine/renderer'
import { loadAllFonts } from '../engine/text'
import { projectDuration } from '@shared/types'
import { useApp, usePlayback, rearrange } from '../store/app'
import { Player } from './Player'
import { LeftPanel } from './LeftPanel'
import { Inspector } from './Inspector'
import { Timeline } from './Timeline'
import { ExportDialog } from './Export'
import { fmtTime } from './common'
import { getTemplate } from '../templates'
import { retime } from '../arrange/arranger'

export function Editor(): JSX.Element | null {
  const { project, settings, past, future, undo, redo, closeProject, commit, toast, exports, setShowExports, selectedSceneId, selectScene } = useApp()
  const { playing, time } = usePlayback()
  const [showExport, setShowExport] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editName, setEditName] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)

  /** 按导出分辨率渲染当前画面，存为 PNG 封面 */
  const exportCover = async (): Promise<void> => {
    const proj = useApp.getState().project
    if (!proj) return
    setCoverBusy(true)
    try {
      const [w, h] = ASPECT_SIZE[proj.aspect]
      const canvas = document.createElement('canvas')
      const r = new Renderer(canvas, { maxTextureSize: 4096, useOriginals: true, preserveDrawingBuffer: true })
      r.setSize(w, h)
      r.setProject(proj, getTemplate(proj.templateId), settings?.brand ?? null)
      await loadAllFonts()
      const t = Math.max(0.7, usePlayback.getState().time)
      await r.prepare(t, t + 0.1)
      r.render(t)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
      r.dispose()
      if (!blob) throw new Error('生成图片失败')
      const out = await window.mv.saveImage(`${proj.name.replace(/[\\/:*?"<>|]/g, '_')}_封面.png`, await blob.arrayBuffer())
      if (out) toast('封面已保存', 'success')
    } catch (e) {
      toast('导出封面失败：' + (e as Error).message, 'error')
    } finally {
      setCoverBusy(false)
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const mod = e.metaKey || e.ctrlKey
      const pb = usePlayback.getState()
      const proj = useApp.getState().project
      if (!proj) return
      if (e.code === 'Space') {
        e.preventDefault()
        pb.setPlaying(!pb.playing)
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const dir = e.key === 'ArrowLeft' ? -1 : 1
        if (e.shiftKey) {
          // 跳到上一个 / 下一个场景
          const i = proj.scenes.findIndex((s) => pb.time >= s.start && pb.time < s.start + s.duration)
          const j = Math.max(0, Math.min(proj.scenes.length - 1, i + dir))
          usePlayback.setState({ time: proj.scenes[j].start + 0.01, playing: false })
          selectScene(proj.scenes[j].id)
        } else usePlayback.setState({ time: Math.max(0, Math.min(projectDuration(proj), pb.time + dir)), playing: false })
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && useApp.getState().selectedSceneId) {
        const s = proj.scenes.find((x) => x.id === useApp.getState().selectedSceneId)
        if (s?.kind === 'photo') {
          commit((p) => ({ ...p, scenes: retime(p.scenes.filter((x) => x.id !== s.id)) }))
          selectScene(null)
        }
      } else if (e.key === 'Home') usePlayback.setState({ time: 0 })
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // 打开项目时停在片头标题出现的位置（0 秒是黑场淡入）
  useEffect(() => {
    const first = useApp.getState().project?.scenes[0]
    usePlayback.setState({ time: first ? Math.min(2.5, first.duration * 0.6) : 0, playing: false })
  }, [project?.id])

  if (!project) return null
  const total = projectDuration(project)
  const active = exports.filter((j) => j.status === 'rendering' || j.status === 'muxing' || j.status === 'queued')
  const tpl = getTemplate(project.templateId)

  const shuffle = async (): Promise<void> => {
    setBusy(true)
    try {
      const next = await rearrange(project, { seed: Math.floor(Math.random() * 1e9) })
      commit(() => next)
      usePlayback.setState({ time: 0, playing: false })
      selectScene(null)
      toast('已换一种编排方式（可撤销）')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="topbar drag">
        <button className="btn ghost sm no-drag" onClick={closeProject}>
          <ChevronLeft size={16} /> 首页
        </button>
        <div className="no-drag" style={{ minWidth: 0 }}>
          {editName ? (
            <input
              className="input"
              autoFocus
              defaultValue={project.name}
              style={{ height: 28, width: 260 }}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== project.name) commit((p) => ({ ...p, name: v }))
                setEditName(false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <div onDoubleClick={() => setEditName(true)} title="双击重命名" style={{ fontWeight: 600, cursor: 'text' }}>
              {project.name} <span className="muted small" style={{ fontWeight: 400 }}>· {tpl.name} · {project.aspect}</span>
            </div>
          )}
        </div>
        <div className="grow" />
        <button className="btn sm icon no-drag" disabled={!past.length} onClick={undo} title="撤销 ⌘Z">
          <Undo2 size={15} />
        </button>
        <button className="btn sm icon no-drag" disabled={!future.length} onClick={redo} title="重做 ⇧⌘Z">
          <Redo2 size={15} />
        </button>
        <button className="btn sm no-drag" disabled={busy} onClick={shuffle} title="同一模板换一种编排">
          {busy ? <Loader2 size={14} className="spin" /> : <Shuffle size={14} />} 换一换
        </button>
        <button className="btn sm no-drag" onClick={() => setShowExports(true)} title="导出队列">
          <Film size={14} /> {active.length ? `导出中 ${active.length}` : '队列'}
        </button>
        <button className="btn primary sm no-drag" onClick={() => setShowExport(true)}>
          <Download size={14} /> 导出视频
        </button>
      </div>
      <div className="editor">
        <LeftPanel project={project} />
        <div className="stage">
          <Player project={project} brand={settings?.brand ?? null} />
          <div className="transport">
            <button className="btn sm icon ghost" onClick={() => usePlayback.setState({ time: 0, playing: false })} title="回到开头">
              <SkipBack size={15} />
            </button>
            <button className="btn icon primary" style={{ borderRadius: '50%', width: 34, height: 34 }} onClick={() => usePlayback.getState().setPlaying(!playing)} title="播放 / 暂停（空格）">
              {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
            </button>
            <button
              className="btn sm icon ghost"
              title="下一个场景（⇧→）"
              onClick={() => {
                const next = project.scenes.find((s) => s.start > time + 0.05)
                if (next) usePlayback.setState({ time: next.start + 0.01, playing: false })
              }}
            >
              <SkipForward size={15} />
            </button>
            <span className="timecode">
              {fmtTime(time, true)} / {fmtTime(total, true)}
            </span>
            <input type="range" className="grow" min={0} max={total} step={0.01} value={Math.min(time, total)} onChange={(e) => usePlayback.setState({ time: Number(e.target.value), playing: false })} />
            {selectedSceneId && (
              <button className="btn sm ghost" onClick={() => selectScene(null)}>
                取消选中
              </button>
            )}
            <button className="btn sm icon ghost" title="把当前画面导出为封面图（PNG）" disabled={coverBusy} onClick={exportCover}>
              {coverBusy ? <Loader2 size={14} className="spin" /> : <ImageDown size={14} />}
            </button>
            <button
              className="btn sm icon ghost"
              title="全屏预览"
              onClick={() => {
                const c = document.querySelector('.stage-canvas canvas') as HTMLCanvasElement | null
                c?.requestFullscreen?.()
              }}
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
        <Inspector project={project} />
        <Timeline project={project} />
      </div>
      {showExport && <ExportDialog project={project} onClose={() => setShowExport(false)} />}
    </>
  )
}
