import { useMemo, useState } from 'react'
import { Images, LayoutTemplate, Music, Diamond, Eye, EyeOff, Check, Shuffle, Locate, ImagePlus, Loader2 } from 'lucide-react'
import type { Project, MusicTrack } from '@shared/types'
import { useApp, rearrange, usePlayback } from '../store/app'
import { FLAG_LABEL, importPhotos, type ImportProgress } from '../analysis/photo'
import { thumbUrl, Seg, fmtTime } from './common'
import { TemplateCard, MusicList, ImportStatus, ProductLabel } from './Wizard'
import { TEMPLATES } from '../templates'
import { TRANSITIONS, transitionLabel } from '../engine/transitions'
import { pickTransition, arrange, retime } from '../arrange/arranger'
import { getTemplate } from '../templates'
import { rng } from '../engine/math'

type Tab = 'photos' | 'templates' | 'music' | 'transitions'

export function LeftPanel({ project }: { project: Project }): JSX.Element {
  const [tab, setTab] = useState<Tab>('photos')
  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: 'photos', label: '照片', icon: <Images size={16} /> },
    { id: 'templates', label: '模板', icon: <LayoutTemplate size={16} /> },
    { id: 'music', label: '音乐', icon: <Music size={16} /> },
    { id: 'transitions', label: '转场', icon: <Diamond size={16} /> }
  ]
  return (
    <div className="panel">
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {tab === 'photos' && <PhotoLibrary project={project} />}
        {tab === 'templates' && <TemplatesTab project={project} />}
        {tab === 'music' && <MusicTab project={project} />}
        {tab === 'transitions' && <TransitionsTab project={project} />}
      </div>
    </div>
  )
}

function PhotoLibrary({ project }: { project: Project }): JSX.Element {
  const [filter, setFilter] = useState<'all' | 'unused' | 'issues'>('all')
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const { commit, selectScene, toast } = useApp()
  const usedSet = useMemo(() => new Set(project.scenes.filter((s) => s.kind === 'photo').flatMap((s) => s.photos)), [project.scenes])
  const list = project.photos.filter((p) => (filter === 'unused' ? !usedSet.has(p.id) : filter === 'issues' ? p.analysis?.flags.length : true))

  const addMore = async (mode: 'files' | 'folder'): Promise<void> => {
    const paths = await window.mv.openPhotos(mode)
    if (!paths.length) return
    setProgress({ done: 0, total: paths.length })
    const fresh = await importPhotos(paths, setProgress, project.photos)
    setProgress(null)
    if (!fresh.length) return
    // 新照片编排成场景，插在片尾之前
    const tpl = getTemplate(project.templateId)
    const { scenes } = arrange({ photos: fresh, template: tpl, aspect: project.aspect, music: project.music?.analysis ?? null, pace: project.settings.pace, durationMode: 'photos', seed: Date.now() % 1e9 })
    const newScenes = scenes.filter((s) => s.kind === 'photo')
    commit((p) => {
      const outro = p.scenes[p.scenes.length - 1]
      const body = p.scenes.slice(0, -1)
      return { ...p, photos: [...p.photos, ...fresh], scenes: retime([...body, ...newScenes, outro]) }
    })
    toast(`已添加 ${fresh.length} 张照片，新增 ${newScenes.length} 个场景`, 'success')
  }

  const toggleExclude = (id: string): void => {
    const photo = project.photos.find((p) => p.id === id)!
    if (!photo.excluded && usedSet.has(id)) {
      // 从 MV 中移除：单图场景直接删除，多图场景用未使用的照片替补
      commit((p) => {
        const unused = p.photos.filter((x) => !x.excluded && x.id !== id && !usedSet.has(x.id))
        const scenes = p.scenes.flatMap((s) => {
          if (s.kind !== 'photo' || !s.photos.includes(id)) return [s]
          if (s.photos.length === 1) return []
          const sub = unused.shift()
          if (!sub) return [{ ...s, photos: s.photos.map((x) => (x === id ? s.photos.find((y) => y !== id) ?? x : x)) }]
          return [{ ...s, photos: s.photos.map((x) => (x === id ? sub.id : x)) }]
        })
        return { ...p, photos: p.photos.map((x) => (x.id === id ? { ...x, excluded: true } : x)), scenes: retime(scenes) }
      })
      return
    }
    commit((p) => ({ ...p, photos: p.photos.map((x) => (x.id === id ? { ...x, excluded: !x.excluded } : x)) }))
  }

  const locate = (id: string): void => {
    const s = project.scenes.find((x) => x.kind === 'photo' && x.photos.includes(id))
    if (s) {
      selectScene(s.id)
      usePlayback.setState({ time: s.start + Math.min(1.5, s.duration / 2), playing: false })
    }
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn sm grow" onClick={() => addMore('files')}>
          <ImagePlus size={14} /> 添加照片
        </button>
        <button className="btn sm" onClick={() => addMore('folder')}>
          文件夹
        </button>
      </div>
      <ImportStatus progress={progress} />
      <div className="row" style={{ marginBottom: 10 }}>
        <Seg
          value={filter}
          options={[
            { value: 'all', label: `全部 ${project.photos.length}` },
            { value: 'unused', label: '未使用' },
            { value: 'issues', label: '有问题' }
          ]}
          onChange={setFilter}
        />
      </div>
      <div className="photo-grid">
        {list.map((p) => (
          <div
            key={p.id}
            className={'ph' + (p.excluded ? ' excluded' : '')}
            style={{ backgroundImage: thumbUrl(p.thumb) }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-mv-photo', p.id)
              e.dataTransfer.effectAllowed = 'copy'
            }}
            onDoubleClick={() => locate(p.id)}
            title={`${p.name}\n评分 ${p.analysis?.score ?? '-'}${p.analysis?.faces.length ? ` · ${p.analysis.faces.length} 张人脸` : ''}\n拖到场景上替换照片，双击定位`}
          >
            {usedSet.has(p.id) && (
              <div className="used">
                <Check size={11} />
              </div>
            )}
            <div className="flags">
              {p.analysis?.flags.map((f) => (
                <span key={f} className="badge warn">
                  {FLAG_LABEL[f]}
                </span>
              ))}
            </div>
            <ProductLabel p={p} />
            <div className="hover-ops">
              <button className="btn sm icon" title={p.excluded ? '恢复使用' : '不使用这张'} onClick={() => toggleExclude(p.id)}>
                {p.excluded ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              {usedSet.has(p.id) && (
                <button className="btn sm icon" title="定位到场景" onClick={() => locate(p.id)}>
                  <Locate size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function useRearrange(): [boolean, (patch: Parameters<typeof rearrange>[1], msg?: string) => Promise<void>] {
  const [busy, setBusy] = useState(false)
  const { commit, toast } = useApp()
  const run = async (patch: Parameters<typeof rearrange>[1], msg?: string): Promise<void> => {
    const cur = useApp.getState().project
    if (!cur) return
    setBusy(true)
    try {
      const next = await rearrange(cur, patch)
      commit(() => next)
      usePlayback.setState({ time: 0, playing: false })
      if (msg) toast(msg, 'success')
    } catch (e) {
      toast('操作失败：' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return [busy, run]
}

function TemplatesTab({ project }: { project: Project }): JSX.Element {
  const [busy, run] = useRearrange()
  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>
        点击切换模板，照片和文字会保留并重新编排 {busy && <Loader2 size={12} className="spin" />}
      </div>
      <div className="col" style={{ gap: 10 }}>
        {TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            id={t.id}
            on={t.id === project.templateId}
            compact
            photos={project.photos}
            aspect="16:9"
            onClick={() => t.id !== project.templateId && run({ templateId: t.id }, `已切换为「${t.name}」`)}
          />
        ))}
      </div>
    </>
  )
}

function MusicTab({ project }: { project: Project }): JSX.Element {
  const [busy, run] = useRearrange()
  const { commit } = useApp()
  const a = project.music?.analysis
  return (
    <>
      {project.music && (
        <div style={{ padding: 12, borderRadius: 10, background: 'var(--panel-2)', marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <Music size={16} style={{ color: 'var(--accent)' }} />
            <b className="grow">{project.music.name}</b>
          </div>
          {a && (
            <div className="row tiny muted" style={{ gap: 10 }}>
              <span>{Math.round(a.bpm)} BPM</span>
              <span>时长 {fmtTime(a.duration)}</span>
              <span>节拍可信度 {Math.round(a.confidence * 100)}%</span>
            </div>
          )}
          <div className="field" style={{ marginTop: 12, marginBottom: 6 }}>
            <label>音量 {Math.round(project.settings.musicVolume * 100)}%</label>
            <input type="range" min={0} max={1.5} step={0.05} value={project.settings.musicVolume} onChange={(e) => commit((p) => ({ ...p, settings: { ...p.settings, musicVolume: Number(e.target.value) } }), { merge: 'vol' })} />
          </div>
          <div className="field" style={{ marginBottom: 6 }}>
            <label>结尾淡出 {project.settings.fadeOut.toFixed(1)} 秒</label>
            <input type="range" min={0} max={8} step={0.5} value={project.settings.fadeOut} onChange={(e) => commit((p) => ({ ...p, settings: { ...p.settings, fadeOut: Number(e.target.value) } }), { merge: 'fade' })} />
          </div>
          {a && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label>从第 {fmtTime(project.musicOffset)} 秒开始播放</label>
              <input type="range" min={0} max={Math.max(0, a.duration - 10)} step={0.5} value={project.musicOffset} onChange={(e) => commit((p) => ({ ...p, musicOffset: Number(e.target.value) }), { merge: 'offset' })} />
              <div className="tiny muted">修改起点后建议点「重新卡点」</div>
            </div>
          )}
          <button className="btn sm" style={{ marginTop: 10, width: '100%' }} disabled={busy} onClick={() => run({}, '已按节拍重新编排')}>
            {busy ? <Loader2 size={13} className="spin" /> : <Shuffle size={13} />} 重新卡点
          </button>
        </div>
      )}
      <div className="panel-title small">更换音乐</div>
      <MusicList
        value={project.music}
        recommended={getTemplate(project.templateId).music}
        onChange={(m: MusicTrack | null) => {
          if (m?.id === project.music?.id) return
          run({ music: m }, m ? `已更换为「${m.name}」并重新卡点` : '已移除音乐')
        }}
      />
    </>
  )
}

function TransitionsTab({ project }: { project: Project }): JSX.Element {
  const { selectedSceneId, commit, toast } = useApp()
  const sel = project.scenes.find((s) => s.id === selectedSceneId)
  const groups = ['基础', '推拉', '形状', '特效', '3D'] as const
  const apply = (name: string, all = false): void => {
    commit((p) => ({
      ...p,
      scenes: p.scenes.map((s, i) =>
        i < p.scenes.length - 1 && (all || s.id === selectedSceneId) ? { ...s, transition: { name, duration: name === 'cut' ? 0 : Math.min(s.transition.duration || 0.8, s.duration * 0.6) || 0.8 } } : s
      )
    }))
  }
  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>
        {sel ? `点击应用到「场景 ${project.scenes.indexOf(sel)}」之后的转场` : '先在时间线上选中一个场景'}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button
          className="btn sm grow"
          onClick={() => {
            const tpl = getTemplate(project.templateId)
            const r = rng(Date.now() % 1e9)
            const P = project.music?.analysis ? 60 / project.music.analysis.bpm : 0.6
            commit((p) => {
              let prev: string | null = null
              return {
                ...p,
                scenes: p.scenes.map((s, i) => {
                  if (i === 0 || i >= p.scenes.length - 2) return s
                  const t = pickTransition(tpl, r, prev, P, 0.5)
                  prev = t.name
                  return { ...s, transition: { ...t, duration: Math.min(t.duration, s.duration * 0.6) } }
                })
              }
            })
            toast('已随机更换转场')
          }}
        >
          <Shuffle size={13} /> 随机转场
        </button>
        {sel && (
          <button className="btn sm" onClick={() => apply(sel.transition.name, true)}>
            统一为当前
          </button>
        )}
      </div>
      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 12 }}>
          <div className="tiny muted" style={{ marginBottom: 6 }}>
            {g}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {(g === '基础' ? [{ name: 'cut', label: '硬切' }, ...TRANSITIONS.filter((t) => t.group === g)] : TRANSITIONS.filter((t) => t.group === g)).map((t) => (
              <button key={t.name} className={'btn sm' + (sel?.transition.name === t.name ? ' primary' : '')} disabled={!sel || sel.kind === 'outro'} onClick={() => apply(t.name)}>
                {transitionLabel(t.name)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
