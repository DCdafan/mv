import { useState } from 'react'
import { Download, FolderOpen, X, CheckCircle2, AlertCircle, Loader2, Film, Trash2 } from 'lucide-react'
import type { Aspect, ExportOptions, Project } from '@shared/types'
import { projectDuration } from '@shared/types'
import { Modal, Seg, Progress, fmtTime, Switch } from './common'
import { makeShortVersion } from '../arrange/highlight'
import { renderCover, defaultCoverTime } from './cover'
import { useApp } from '../store/app'

export type Quality = 'standard' | 'high' | 'ultra'
export const RESOLUTIONS = [
  { id: '720', label: '720p', short: 720 },
  { id: '1080', label: '1080p 高清', short: 1080 },
  { id: '1440', label: '2K', short: 1440 },
  { id: '2160', label: '4K 超清', short: 2160 }
]

export function exportSize(aspect: Aspect, short: number): [number, number] {
  const [a, b] = aspect.split(':').map(Number)
  const even = (n: number): number => Math.round(n / 2) * 2
  if (a >= b) return [even((short * a) / b), short]
  return [short, even((short * b) / a)]
}

export function bitrateFor(w: number, h: number, fps: number, q: Quality): number {
  const px = w * h
  const base = px <= 1280 * 720 ? 5 : px <= 1920 * 1080 ? 10 : px <= 2560 * 1440 ? 18 : 35
  const k = q === 'standard' ? 0.7 : q === 'high' ? 1 : 1.6
  return Math.round(base * k * (fps > 30 ? 1.4 : 1) * 1e6)
}

export function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').trim() || 'MV'
}

export function buildExportOptions(project: Project, short: number, fps: number, q: Quality, outPath: string): ExportOptions {
  const [w, h] = exportSize(project.aspect, short)
  return { width: w, height: h, fps, bitrate: bitrateFor(w, h, fps, q), outPath }
}

export function ExportDialog({ project, onClose }: { project: Project; onClose: () => void }): JSX.Element {
  const { settings, toast, setShowExports } = useApp()
  const [res, setRes] = useState('1080')
  const [fps, setFps] = useState(settings?.defaultFps ?? 30)
  const [q, setQ] = useState<Quality>(settings?.defaultQuality ?? 'high')
  const short = RESOLUTIONS.find((r) => r.id === res)!.short
  const [w, h] = exportSize(project.aspect, short)
  const dur = projectDuration(project)
  const br = bitrateFor(w, h, fps, q)
  const sizeMB = ((br + 192000) * dur) / 8 / 1e6

  const [withShort, setWithShort] = useState(false)
  const [shortAspect, setShortAspect] = useState<Aspect>('9:16')
  const [withCover, setWithCover] = useState(false)
  const [working, setWorking] = useState(false)

  const go = async (): Promise<void> => {
    const out = await window.mv.saveVideo(`${safeName(project.name)}_${short}p.mp4`)
    if (!out) return
    setWorking(true)
    try {
      const brand = settings?.brand ?? null
      const base = out.replace(/\.mp4$/i, '')
      await window.mv.enqueueExport({ project, brand, options: buildExportOptions(project, short, fps, q, out) })
      if (withShort) {
        const sp = makeShortVersion(project, { seconds: 15, aspect: shortAspect })
        await window.mv.enqueueExport({ project: sp, brand, options: buildExportOptions(sp, Math.min(short, 1080), fps, q, `${base}_精华版.mp4`) })
      }
      if (withCover) {
        const blob = await renderCover(project, brand, defaultCoverTime(project))
        await window.mv.writePng(`${base}_封面.png`, await blob.arrayBuffer())
      }
      toast(`已加入导出队列${withShort ? '（含精华版）' : ''}${withCover ? '，封面已保存' : ''}`, 'success')
      setShowExports(true)
      onClose()
    } catch (e) {
      toast('导出失败：' + (e as Error).message, 'error')
    } finally {
      setWorking(false)
    }
  }

  return (
    <Modal
      title={
        <span className="row">
          <Download size={17} /> 导出视频
        </span>
      }
      width={520}
      onClose={onClose}
      footer={
        <>
          <div className="muted small grow">
            约 {sizeMB < 1000 ? `${sizeMB.toFixed(0)} MB` : `${(sizeMB / 1000).toFixed(1)} GB`} · 时长 {fmtTime(dur)}
          </div>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" disabled={working} onClick={go}>
            {working ? <Loader2 size={15} className="spin" /> : <Download size={15} />} 开始导出
          </button>
        </>
      }
    >
      <div className="field">
        <label>分辨率</label>
        <Seg value={res} options={RESOLUTIONS.map((r) => ({ value: r.id, label: r.label }))} onChange={setRes} />
        <div className="muted tiny">
          输出尺寸 {w} × {h}（{project.aspect}）
        </div>
      </div>
      <div className="field">
        <label>帧率</label>
        <Seg
          value={String(fps)}
          options={[
            { value: '25', label: '25 fps' },
            { value: '30', label: '30 fps' },
            { value: '60', label: '60 fps 更流畅' }
          ]}
          onChange={(v) => setFps(Number(v))}
        />
      </div>
      <div className="field">
        <label>画质</label>
        <Seg
          value={q}
          options={[
            { value: 'standard', label: '标准（体积小）' },
            { value: 'high', label: '高' },
            { value: 'ultra', label: '极高（适合大屏）' }
          ]}
          onChange={setQ}
        />
        <div className="muted tiny">码率 {(br / 1e6).toFixed(1)} Mbps · H.264 硬件编码 · AAC 192kbps</div>
      </div>
      <div className="divider" />
      <div className="field">
        <label>同时导出</label>
        <div className="row" style={{ marginBottom: 8 }}>
          <Switch on={withShort} onChange={setWithShort} />
          <span className="grow">15 秒精华版（自动挑高光照片 + 音乐副歌，适合抖音、视频号）</span>
        </div>
        {withShort && (
          <div className="row" style={{ marginBottom: 8, paddingLeft: 42 }}>
            <span className="tiny muted">画幅</span>
            <Seg
              value={shortAspect}
              options={[
                { value: '9:16', label: '竖屏 9:16' },
                { value: '1:1', label: '方形 1:1' },
                { value: project.aspect, label: `同完整版 ${project.aspect}` }
              ].filter((o, i, arr) => arr.findIndex((x) => x.value === o.value) === i)}
              onChange={(v) => setShortAspect(v as Aspect)}
            />
          </div>
        )}
        <div className="row">
          <Switch on={withCover} onChange={setWithCover} />
          <span className="grow">封面图 PNG（片头标题画面）</span>
        </div>
      </div>
    </Modal>
  )
}

const STATUS: Record<string, string> = { queued: '排队中', rendering: '渲染中', muxing: '合成音频', done: '完成', error: '失败', canceled: '已取消' }

export function ExportQueue(): JSX.Element | null {
  const { exports, showExports, setShowExports } = useApp()
  if (!showExports) return null
  return (
    <div style={{ position: 'fixed', right: 16, top: 60, width: 380, maxHeight: 'calc(100vh - 90px)', zIndex: 90, display: 'flex', flexDirection: 'column' }} className="modal">
      <div className="modal-head" style={{ padding: '12px 16px' }}>
        <Film size={16} />
        <div className="grow">导出队列</div>
        <button className="btn sm ghost" onClick={() => window.mv.clearFinishedExports()}>
          <Trash2 size={13} /> 清除已完成
        </button>
        <button className="btn sm ghost icon" onClick={() => setShowExports(false)}>
          <X size={15} />
        </button>
      </div>
      <div style={{ overflow: 'auto', padding: 10 }}>
        {exports.length === 0 && <div className="muted small" style={{ padding: 20, textAlign: 'center' }}>暂无导出任务</div>}
        {[...exports].reverse().map((j) => (
          <div key={j.id} style={{ padding: 10, borderRadius: 8, background: 'var(--panel-2)', marginBottom: 8 }}>
            <div className="row" style={{ marginBottom: 6 }}>
              {j.status === 'done' ? (
                <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} />
              ) : j.status === 'error' ? (
                <AlertCircle size={15} style={{ color: 'var(--err)' }} />
              ) : j.status === 'rendering' || j.status === 'muxing' ? (
                <Loader2 size={15} className="spin" style={{ color: 'var(--accent)' }} />
              ) : (
                <Film size={15} className="muted" />
              )}
              <b className="grow" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {j.projectName}
              </b>
              <span className="tiny muted">
                {j.options.width}×{j.options.height} · {j.options.fps}fps
              </span>
            </div>
            {(j.status === 'rendering' || j.status === 'muxing' || j.status === 'queued') && <Progress value={j.progress} />}
            <div className="row tiny" style={{ marginTop: 6 }}>
              <span className="grow muted">
                {STATUS[j.status]}
                {j.status === 'rendering' && ` ${Math.round(j.progress * 100)}%${j.fpsActual ? ` · ${j.fpsActual.toFixed(0)} 帧/秒` : ''}`}
                {j.status === 'done' && j.finishedAt && j.startedAt && ` · 用时 ${fmtTime((j.finishedAt - j.startedAt) / 1000)}`}
                {j.status === 'error' && ` · ${j.error}`}
              </span>
              {j.status === 'done' && (
                <>
                  <button className="btn sm" onClick={() => window.mv.openPath(j.options.outPath)}>
                    播放
                  </button>
                  <button className="btn sm icon" title="在文件夹中显示" onClick={() => window.mv.reveal(j.options.outPath)}>
                    <FolderOpen size={13} />
                  </button>
                </>
              )}
              {(j.status === 'queued' || j.status === 'rendering') && (
                <button className="btn sm" onClick={() => window.mv.cancelExport(j.id)}>
                  取消
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
