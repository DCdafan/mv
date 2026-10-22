import { useState } from 'react'
import { ChevronLeft, FolderOpen, Play, Loader2, CheckCircle2, AlertCircle, Layers, Users } from 'lucide-react'
import type { Aspect, MusicTrack, Pace } from '@shared/types'
import { useApp, createProject, todayString } from '../store/app'
import { Seg, Switch, Progress } from './common'
import { TEMPLATES, getTemplate } from '../templates'
import { importPhotos } from '../analysis/photo'
import { autoExclude, sortPhotos, AspectPicker } from './Wizard'
import { RESOLUTIONS, buildExportOptions, safeName, type Quality } from './Export'

interface Client {
  name: string
  path: string
  photos: string[]
  checked: boolean
  status: 'idle' | 'analyzing' | 'arranging' | 'queued' | 'error'
  progress: number
  projectId?: string
  error?: string
}

export function Batch(): JSX.Element {
  const { setView, builtinMusic, settings, exports, refreshProjects, toast, setShowExports } = useApp()
  const [root, setRoot] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id)
  const [musicId, setMusicId] = useState<string>('auto')
  const [aspect, setAspect] = useState<Aspect>('16:9')
  const [pace, setPace] = useState<Pace | 'auto'>('auto')
  const [res, setRes] = useState('1080')
  const [q, setQ] = useState<Quality>('high')
  const [titleFromFolder, setTitleFromFolder] = useState(true)
  const [autoEx, setAutoEx] = useState(true)
  const [outDir, setOutDir] = useState(settings?.outputDir ?? '')
  const [running, setRunning] = useState(false)

  const pick = async (): Promise<void> => {
    const d = await window.mv.openFolder('选择客户照片总目录（每个子文件夹是一位客户）')
    if (!d) return
    setRoot(d)
    const list = await window.mv.listClientFolders(d)
    setClients(list.map((c) => ({ ...c, checked: true, status: 'idle', progress: 0 })))
    if (!list.length) toast('这个目录下没有找到含照片的子文件夹', 'error')
  }

  const patch = (path: string, p: Partial<Client>): void => setClients((cs) => cs.map((c) => (c.path === path ? { ...c, ...p } : c)))

  const start = async (): Promise<void> => {
    if (!outDir) {
      toast('请选择导出文件夹', 'error')
      return
    }
    setRunning(true)
    const tpl = getTemplate(templateId)
    const music: MusicTrack | null = musicId === 'none' ? null : musicId === 'auto' ? builtinMusic.find((m) => m.path.endsWith(tpl.music)) ?? null : builtinMusic.find((m) => m.id === musicId) ?? null
    const short = RESOLUTIONS.find((r) => r.id === res)!.short
    let ok = 0
    for (const c of clients.filter((x) => x.checked && x.status !== 'queued')) {
      try {
        patch(c.path, { status: 'analyzing', progress: 0, error: undefined })
        const photos = await importPhotos(c.photos, (p) => patch(c.path, { progress: p.done / Math.max(1, p.total) }))
        patch(c.path, { status: 'arranging' })
        const list = autoExclude(sortPhotos(photos, 'name'), autoEx)
        const project = await createProject({
          name: c.name,
          photos: list,
          templateId,
          music,
          aspect,
          pace: pace === 'auto' ? tpl.pace : pace,
          durationMode: 'photos',
          meta: { ...tpl.defaults, title: titleFromFolder ? c.name : tpl.defaults.title, date: todayString() }
        })
        project.cover = list.find((p) => !p.excluded)?.thumb
        await window.mv.saveProject(project)
        const sep = outDir.includes('\\') ? '\\' : '/'
        await window.mv.enqueueExport({
          project,
          brand: settings?.brand ?? null,
          options: buildExportOptions(project, short, settings?.defaultFps ?? 30, q, `${outDir}${sep}${safeName(c.name)}.mp4`)
        })
        patch(c.path, { status: 'queued', projectId: project.id })
        ok++
      } catch (e) {
        patch(c.path, { status: 'error', error: (e as Error).message })
      }
    }
    setRunning(false)
    refreshProjects()
    toast(`已为 ${ok} 位客户生成 MV 并加入导出队列`, 'success')
    setShowExports(true)
  }

  const checked = clients.filter((c) => c.checked)
  const total = checked.reduce((s, c) => s + c.photos.length, 0)

  return (
    <>
      <div className="topbar drag">
        <button className="btn ghost sm no-drag" onClick={() => setView('home')} disabled={running}>
          <ChevronLeft size={16} /> 首页
        </button>
        <b>批量出片</b>
        <span className="muted small">一个子文件夹 = 一位客户，自动分析、编排并排队导出</span>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', minHeight: 0 }}>
        <div style={{ padding: 24, overflow: 'auto' }}>
          <div className="row" style={{ marginBottom: 16 }}>
            <button className="btn" onClick={pick} disabled={running}>
              <FolderOpen size={15} /> 选择客户总目录
            </button>
            {root && <span className="muted small grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{root}</span>}
          </div>
          {!root ? (
            <div className="empty" style={{ padding: 60 }}>
              <Users size={36} style={{ color: 'var(--accent)', marginBottom: 12 }} />
              <div style={{ fontSize: 15, marginBottom: 8, color: 'var(--text)' }}>选择一个总目录</div>
              <div className="small">
                目录结构示例：客户照片/张三李四/*.jpg、客户照片/王五/*.jpg
                <br />
                每个子文件夹会生成一个独立的 MV 项目，并按顺序导出
              </div>
            </div>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              <div className="row small muted" style={{ marginBottom: 4 }}>
                <span className="grow">
                  共 {clients.length} 位客户，已选 {checked.length} 位，{total} 张照片
                </span>
                <button className="btn sm ghost" onClick={() => setClients(clients.map((c) => ({ ...c, checked: !checked.length || checked.length < clients.length })))}>
                  全选 / 取消
                </button>
              </div>
              {clients.map((c) => {
                const job = c.projectId ? exports.find((j) => j.projectId === c.projectId) : undefined
                return (
                  <div key={c.path} className="list-item" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
                    <input type="checkbox" checked={c.checked} disabled={running} onChange={(e) => patch(c.path, { checked: e.target.checked })} />
                    <div style={{ width: 200 }}>
                      <b>{c.name}</b>
                      <div className="tiny muted">{c.photos.length} 张照片</div>
                    </div>
                    <div className="grow">
                      {c.status === 'analyzing' && <Progress value={c.progress} />}
                      {job && (job.status === 'rendering' || job.status === 'muxing') && <Progress value={job.progress} />}
                    </div>
                    <div style={{ width: 150, textAlign: 'right' }} className="small">
                      {c.status === 'idle' && <span className="muted">待处理</span>}
                      {c.status === 'analyzing' && (
                        <span className="row" style={{ justifyContent: 'flex-end' }}>
                          <Loader2 size={13} className="spin" /> 分析照片 {Math.round(c.progress * 100)}%
                        </span>
                      )}
                      {c.status === 'arranging' && <span>智能编排…</span>}
                      {c.status === 'error' && (
                        <span style={{ color: 'var(--err)' }} title={c.error}>
                          <AlertCircle size={13} /> 失败
                        </span>
                      )}
                      {c.status === 'queued' &&
                        (job?.status === 'done' ? (
                          <span style={{ color: 'var(--ok)' }} className="row">
                            <CheckCircle2 size={13} /> 已导出
                          </span>
                        ) : job?.status === 'rendering' ? (
                          <span>导出 {Math.round(job.progress * 100)}%</span>
                        ) : job?.status === 'error' ? (
                          <span style={{ color: 'var(--err)' }}>导出失败</span>
                        ) : (
                          <span className="muted">排队导出</span>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="panel right" style={{ overflow: 'auto' }}>
          <div className="panel-body">
            <div className="panel-title">
              <Layers size={16} /> 统一设置
            </div>
            <div className="field">
              <label>模板</label>
              <select className="select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.category} · {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>音乐</label>
              <select className="select" value={musicId} onChange={(e) => setMusicId(e.target.value)}>
                <option value="auto">模板推荐音乐</option>
                {builtinMusic.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value="none">不使用音乐</option>
              </select>
            </div>
            <div className="field">
              <label>画幅</label>
              <AspectPicker value={aspect} onChange={setAspect} />
            </div>
            <div className="field">
              <label>节奏</label>
              <Seg
                value={pace}
                options={[
                  { value: 'auto', label: '模板默认' },
                  { value: 'slow', label: '舒缓' },
                  { value: 'normal', label: '适中' },
                  { value: 'fast', label: '动感' }
                ]}
                onChange={setPace}
              />
            </div>
            <div className="field">
              <label>分辨率</label>
              <Seg value={res} options={RESOLUTIONS.map((r) => ({ value: r.id, label: r.label.split(' ')[0] }))} onChange={setRes} />
            </div>
            <div className="field">
              <label>画质</label>
              <Seg
                value={q}
                options={[
                  { value: 'standard', label: '标准' },
                  { value: 'high', label: '高' },
                  { value: 'ultra', label: '极高' }
                ]}
                onChange={setQ}
              />
            </div>
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="grow">片头标题使用文件夹名</span>
              <Switch on={titleFromFolder} onChange={setTitleFromFolder} />
            </div>
            <div className="row" style={{ marginBottom: 14 }}>
              <span className="grow">自动剔除模糊 / 闭眼 / 重复</span>
              <Switch on={autoEx} onChange={setAutoEx} />
            </div>
            <div className="field">
              <label>导出到</label>
              <div className="row">
                <input className="input" value={outDir} readOnly />
                <button
                  className="btn"
                  onClick={async () => {
                    const d = await window.mv.openFolder('选择导出文件夹')
                    if (d) setOutDir(d)
                  }}
                >
                  选择
                </button>
              </div>
            </div>
            <button className="btn primary lg" style={{ width: '100%', marginTop: 8 }} disabled={running || !checked.length} onClick={start}>
              {running ? <Loader2 size={16} className="spin" /> : <Play size={16} />} {running ? '正在处理…' : `开始批量出片（${checked.length} 位客户）`}
            </button>
            <div className="muted tiny" style={{ marginTop: 10 }}>
              生成的项目会保存在首页「最近项目」里，可以随时打开单独精修后重新导出。
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
