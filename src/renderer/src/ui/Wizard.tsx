import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, ImagePlus, Music, Play, Pause, Upload, Wand2, Check, Loader2, Sparkles } from 'lucide-react'
import type { Aspect, MusicTrack, Pace, PhotoAsset, CustomTemplate } from '@shared/types'
import { Modal, Seg, Switch, Progress, thumbUrl, AspectIcon, fmtTime } from './common'
import { importPhotos, FLAG_LABEL, type ImportProgress } from '../analysis/photo'
import { TEMPLATES, CATEGORIES, getTemplate } from '../templates'
import { templateThumb } from './preview'
import { useApp, createProject, todayString, presetMusic } from '../store/app'
import { analyzeMusic } from '../analysis/music'
import { fileUrl } from '../engine/textures'

export function sortPhotos(list: PhotoAsset[], by: 'name' | 'time'): PhotoAsset[] {
  const arr = [...list]
  if (by === 'time') arr.sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0) || a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
  else arr.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
  return arr
}

/** 自动剔除：模糊、闭眼、重复 */
export function autoExclude(list: PhotoAsset[], on: boolean): PhotoAsset[] {
  return list.map((p) => ({ ...p, excluded: on ? !!p.analysis?.flags.some((f) => f === 'blur' || f === 'eyesClosed' || f === 'duplicate') : false }))
}

export function ProductLabel({ p }: { p: PhotoAsset }): JSX.Element | null {
  if (p.media === 'video') {
    return (
      <div style={{ position: 'absolute', left: 4, top: 4, padding: '1px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(0,0,0,0.65)' }}>
        ▶ {fmtTime(p.duration ?? 0)}
      </div>
    )
  }
  if (!p.product) return null
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '3px 22px 8px 5px', fontSize: 10, background: 'linear-gradient(rgba(0,0,0,0.65), transparent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {p.product.name}
      {p.product.price && <span style={{ color: 'var(--accent-2)', marginLeft: 4 }}>¥{p.product.price}</span>}
    </div>
  )
}

export function PhotoDrop({ onPaths, compact }: { onPaths: (paths: string[]) => void; compact?: boolean }): JSX.Element {
  const [over, setOver] = useState(false)
  return (
    <div
      className={'drop-zone' + (over ? ' over' : '')}
      style={compact ? { padding: 18 } : undefined}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault()
        setOver(false)
        const paths = [...e.dataTransfer.files].map((f) => window.mv.pathForFile(f)).filter(Boolean)
        if (paths.length) onPaths(await window.mv.expandDropped(paths))
      }}
    >
      {!compact && <ImagePlus size={40} style={{ color: 'var(--accent)', marginBottom: 10 }} />}
      <div style={{ fontSize: compact ? 13 : 15, marginBottom: 6 }}>拖入照片或文件夹</div>
      <div className="muted small" style={{ marginBottom: 14 }}>
        支持 JPG / PNG / WebP / HEIC，会自动识别模糊、闭眼、重复的照片
      </div>
      {!compact && (
        <div className="muted tiny" style={{ marginBottom: 14 }}>
          蛋糕店小贴士：把照片命名为「品名-价格」，如 <b>草莓奶油蛋糕-168.jpg</b>，MV 里会自动显示品名和价格
        </div>
      )}
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn" onClick={async () => onPaths(await window.mv.openPhotos('files'))}>
          <ImagePlus size={15} /> 选择照片
        </button>
        <button className="btn" onClick={async () => onPaths(await window.mv.openPhotos('folder'))}>
          <FolderOpen size={15} /> 选择文件夹
        </button>
      </div>
    </div>
  )
}

export function MusicList({ value, onChange, recommended }: { value: MusicTrack | null; onChange: (m: MusicTrack | null) => void; recommended?: string }): JSX.Element {
  const builtin = useApp((s) => s.builtinMusic)
  const [custom, setCustom] = useState<MusicTrack[]>(value && !value.builtin ? [value] : [])
  const [playing, setPlaying] = useState<string | null>(null)
  const [bpm, setBpm] = useState<Record<string, number>>({})
  const audio = useRef<HTMLAudioElement | null>(null)
  useEffect(() => () => audio.current?.pause(), [])
  const list = useMemo(() => {
    const all = [...custom, ...builtin]
    if (recommended) all.sort((a, b) => Number(b.path.endsWith(recommended)) - Number(a.path.endsWith(recommended)))
    return all
  }, [builtin, custom, recommended])
  const toggle = (m: MusicTrack): void => {
    if (playing === m.id) {
      audio.current?.pause()
      setPlaying(null)
      return
    }
    audio.current?.pause()
    audio.current = new Audio(fileUrl(m.path))
    audio.current.volume = 0.8
    audio.current.play()
    setPlaying(m.id)
  }
  const select = (m: MusicTrack): void => {
    onChange(m)
    analyzeMusic(m.path).then((a) => setBpm((b) => ({ ...b, [m.id]: a.bpm })))
  }
  return (
    <div className="col" style={{ gap: 4 }}>
      {list.map((m) => (
        <div key={m.id} className={'list-item' + (value?.id === m.id ? ' on' : '')} onClick={() => select(m)}>
          <button
            className="btn sm icon"
            onClick={(e) => {
              e.stopPropagation()
              toggle(m)
            }}
          >
            {playing === m.id ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <Music size={15} className="muted" />
          <div className="grow">{m.name}</div>
          {recommended && m.path.endsWith(recommended) && <span className="badge accent">模板推荐</span>}
          {bpm[m.id] && <span className="badge">{Math.round(bpm[m.id])} BPM</span>}
          {!m.builtin && <span className="badge">本地</span>}
          {value?.id === m.id && <Check size={16} style={{ color: 'var(--accent)' }} />}
        </div>
      ))}
      <div className="list-item" onClick={() => onChange(null)} style={{ opacity: 0.8 }}>
        <div style={{ width: 26 }} />
        <div className="grow muted">不使用音乐</div>
        {!value && <Check size={16} style={{ color: 'var(--accent)' }} />}
      </div>
      <button
        className="btn"
        style={{ marginTop: 8 }}
        onClick={async () => {
          const p = await window.mv.openMusic()
          if (!p) return
          const m: MusicTrack = { id: 'local:' + p, path: p, name: p.split(/[\\/]/).pop() || p }
          setCustom((c) => [m, ...c.filter((x) => x.id !== m.id)])
          select(m)
        }}
      >
        <Upload size={15} /> 导入本地音乐
      </button>
      <div className="muted tiny" style={{ marginTop: 6 }}>内置曲库均为公有领域 / CC0 授权，可免费商用</div>
    </div>
  )
}

export function TemplateGrid({ value, onChange, photos, aspect = '16:9', presetId, onPreset }: { value: string; onChange: (id: string) => void; photos: PhotoAsset[]; aspect?: Aspect; presetId?: string | null; onPreset?: (c: CustomTemplate) => void }): JSX.Element {
  const custom = useApp((s) => s.settings?.customTemplates ?? [])
  const [cat, setCat] = useState<string>(custom.length && onPreset ? '我的' : '全部')
  const list = TEMPLATES.filter((t) => cat === '全部' || t.category === cat)
  if (cat === '我的' && onPreset) {
    return (
      <>
        <div className="chips">
          {['我的', ...CATEGORIES].map((c) => (
            <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="tpl-grid">
          {custom.map((c) => (
            <TemplateCard key={c.id} id={c.baseTemplateId} label={c.name} on={presetId === c.id} onClick={() => onPreset(c)} photos={photos} aspect={aspect} />
          ))}
        </div>
      </>
    )
  }
  return (
    <>
      <div className="chips">
        {(custom.length && onPreset ? ['我的', ...CATEGORIES] : CATEGORIES).map((c) => (
          <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="tpl-grid">
        {list.map((t) => (
          <TemplateCard key={t.id} id={t.id} on={!presetId && value === t.id} onClick={() => onChange(t.id)} photos={photos} aspect={aspect} />
        ))}
      </div>
    </>
  )
}

export function TemplateCard({ id, on, onClick, photos, aspect, compact, label, onDelete }: { id: string; on: boolean; onClick: () => void; photos: PhotoAsset[]; aspect: Aspect; compact?: boolean; label?: string; onDelete?: () => void }): JSX.Element {
  const t = getTemplate(id)
  const [img, setImg] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    templateThumb(id, photos, aspect === '9:16' || aspect === '1:1' ? '16:9' : aspect).then((u) => alive && setImg(u))
    return () => {
      alive = false
    }
  }, [id, photos, aspect])
  return (
    <div className={'tpl' + (on ? ' on' : '')} onClick={onClick}>
      <div className="thumb" style={{ backgroundImage: img ? `url(${img})` : `linear-gradient(135deg, ${t.coverColors[0]}, ${t.coverColors[1]})` }}>
        {!img && <Loader2 size={18} className="spin" style={{ position: 'absolute', right: 8, bottom: 8, opacity: 0.6 }} />}
        {on && (
          <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent)', borderRadius: '50%', width: 22, height: 22, display: 'grid', placeItems: 'center', color: '#1b1208' }}>
            <Check size={14} />
          </div>
        )}
      </div>
      <div className="info">
        <div className="row">
          <b className="grow">{label ?? t.name}</b>
          {label ? <span className="badge accent">我的</span> : <span className="badge">{t.category}</span>}
          {onDelete && (
            <button
              className="btn sm ghost icon"
              title="删除这个模板"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              ×
            </button>
          )}
        </div>
        {!compact && <p>{label ? `基于「${t.name}」` : t.description}</p>}
      </div>
    </div>
  )
}

export function AspectPicker({ value, onChange }: { value: Aspect; onChange: (a: Aspect) => void }): JSX.Element {
  const opts: { a: Aspect; label: string; sub: string }[] = [
    { a: '16:9', label: '横屏 16:9', sub: '电视 / 电脑' },
    { a: '9:16', label: '竖屏 9:16', sub: '抖音 / 视频号' },
    { a: '1:1', label: '方形 1:1', sub: '朋友圈' },
    { a: '4:3', label: '4:3', sub: '投影 / 平板' }
  ]
  return (
    <div className="aspect-cards">
      {opts.map((o) => (
        <div key={o.a} className={'aspect-card' + (value === o.a ? ' on' : '')} onClick={() => onChange(o.a)}>
          <AspectIcon aspect={o.a} size={26} />
          <div>{o.label}</div>
          <div className="muted tiny">{o.sub}</div>
        </div>
      ))}
    </div>
  )
}

export function ImportStatus({ progress }: { progress: ImportProgress | null }): JSX.Element | null {
  if (!progress) return null
  return (
    <div className="col" style={{ gap: 6, margin: '12px 0' }}>
      <div className="row small">
        <Loader2 size={14} className="spin" />
        <span className="grow">
          正在分析照片 {progress.done}/{progress.total}（人脸、清晰度、重复检测）
        </span>
      </div>
      <Progress value={progress.done / Math.max(1, progress.total)} />
    </div>
  )
}

const STEPS = ['导入照片', '选择模板', '选择音乐', '完善信息']

export function Wizard({ onClose }: { onClose: () => void }): JSX.Element {
  const [step, setStep] = useState(0)
  const [photos, setPhotos] = useState<PhotoAsset[]>([])
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [autoEx, setAutoEx] = useState(true)
  const [sortBy, setSortBy] = useState<'name' | 'time'>('name')
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id)
  const builtin = useApp((s) => s.builtinMusic)
  const [music, setMusic] = useState<MusicTrack | null>(null)
  const [musicTouched, setMusicTouched] = useState(false)
  const [aspect, setAspect] = useState<Aspect>('16:9')
  const tpl = getTemplate(templateId)
  const [pace, setPace] = useState<Pace>(tpl.pace)
  const [durationMode, setDurationMode] = useState<'photos' | 'music'>('photos')
  const [meta, setMeta] = useState({ ...tpl.defaults, date: todayString() })
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [preset, setPreset] = useState<CustomTemplate | null>(null)
  const { toast, openProject, refreshProjects } = useApp()

  // 选模板时带出推荐音乐、节奏、画幅和默认文案
  useEffect(() => {
    const t = getTemplate(templateId)
    if (t.defaultAspect) setAspect(t.defaultAspect)
    if (!musicTouched) setMusic(builtin.find((m) => m.path.endsWith(t.music)) ?? builtin[0] ?? null)
    setPace(t.pace)
    setMeta((m) => ({ ...m, title: t.defaults.title, subtitle: t.defaults.subtitle, ending: t.defaults.ending }))
  }, [templateId, builtin])

  const addPaths = async (paths: string[]): Promise<void> => {
    if (!paths.length) return
    setProgress({ done: 0, total: paths.length })
    const fresh = await importPhotos(paths, setProgress, photos)
    setProgress(null)
    const all = sortPhotos([...photos, ...fresh], sortBy)
    setPhotos(autoExclude(all, autoEx))
    // 大部分照片带价格（蛋糕店商品图）时，默认选蛋糕店模板
    if (all.filter((p) => p.product?.price).length >= all.length / 2 && getTemplate(templateId).industry !== 'bakery') setTemplateId('bakery-sweet')
    if (!name && paths[0]) {
      const parts = paths[0].split(/[\\/]/)
      setName(parts[parts.length - 2] || '我的MV')
    }
  }

  const used = photos.filter((p) => !p.excluded)
  const flagged = photos.filter((p) => p.analysis?.flags.length)

  const generate = async (): Promise<void> => {
    try {
      setBusy(music ? '正在分析音乐节拍…' : '正在智能编排…')
      const p = await createProject({ name: name || meta.title || '我的MV', photos, templateId, music, aspect, pace, durationMode, meta })
      setBusy('正在保存项目…')
      p.cover = used[0]?.thumb
      if (preset) p.settings = { ...p.settings, filter: preset.filter, beatFx: preset.beatFx, particles: preset.particles ?? p.settings.particles, parallax: preset.parallax }
      await window.mv.saveProject(p)
      await refreshProjects()
      onClose()
      await openProject(p.id)
      toast(`已生成 ${p.scenes.length} 个场景，可以继续精修`, 'success')
    } catch (e) {
      console.error(e)
      toast('生成失败：' + (e as Error).message, 'error')
      setBusy(null)
    }
  }

  const canNext = step === 0 ? used.length >= 1 && !progress : true

  return (
    <Modal
      title={
        <div className="row" style={{ gap: 16 }}>
          <span>新建 MV</span>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div key={s} className="row" style={{ gap: 6 }}>
                {i > 0 && <div className="step-sep" />}
                <div className={'step' + (i === step ? ' on' : i < step ? ' done' : '')}>
                  <i>{i < step ? <Check size={11} /> : i + 1}</i>
                  {s}
                </div>
              </div>
            ))}
          </div>
        </div>
      }
      width={980}
      height={680}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <div className="muted small grow">
            {photos.length > 0 && (
              <>
                已导入 {photos.length} 张，使用 {used.length} 张{flagged.length > 0 && `，${flagged.length} 张有问题`}
              </>
            )}
          </div>
          {step > 0 && (
            <button className="btn" disabled={!!busy} onClick={() => setStep(step - 1)}>
              上一步
            </button>
          )}
          {step < 3 ? (
            <button className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
              下一步
            </button>
          ) : (
            <button className="btn primary" disabled={!!busy || !used.length} onClick={generate}>
              {busy ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />} {busy ?? '一键生成 MV'}
            </button>
          )}
        </>
      }
    >
      {step === 0 && (
        <div>
          {photos.length === 0 ? (
            <PhotoDrop onPaths={addPaths} />
          ) : (
            <>
              <div className="row" style={{ marginBottom: 12 }}>
                <PhotoDrop onPaths={addPaths} compact />
              </div>
              <div className="row" style={{ marginBottom: 12, gap: 16 }}>
                <div className="row">
                  <Switch
                    on={autoEx}
                    onChange={(v) => {
                      setAutoEx(v)
                      setPhotos(autoExclude(photos, v))
                    }}
                  />
                  <span>自动剔除模糊 / 闭眼 / 重复照片</span>
                </div>
                <div className="grow" />
                <span className="muted small">排序</span>
                <Seg
                  value={sortBy}
                  options={[
                    { value: 'name', label: '文件名' },
                    { value: 'time', label: '拍摄时间' }
                  ]}
                  onChange={(v) => {
                    setSortBy(v)
                    setPhotos(sortPhotos(photos, v))
                  }}
                />
              </div>
            </>
          )}
          <ImportStatus progress={progress} />
          {photos.length > 0 && (
            <div className="photo-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }}>
              {photos.map((p) => (
                <div
                  key={p.id}
                  className={'ph' + (p.excluded ? ' excluded' : '')}
                  style={{ backgroundImage: thumbUrl(p.thumb) }}
                  title={`${p.name}\n评分 ${p.analysis?.score ?? '-'}${p.analysis?.faces.length ? `，${p.analysis.faces.length} 张人脸` : ''}\n点击切换是否使用`}
                  onClick={() => setPhotos(photos.map((x) => (x.id === p.id ? { ...x, excluded: !x.excluded } : x)))}
                >
                  <div className="flags">
                    {p.analysis?.flags.map((f) => (
                      <span key={f} className="badge warn">
                        {FLAG_LABEL[f]}
                      </span>
                    ))}
                  </div>
                  <ProductLabel p={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {step === 1 && (
        <>
          <WizardAIRecommend photos={photos} onApply={(tid, m) => {
            setPreset(null)
            setTemplateId(tid)
            if (m) {
              setMusic(m)
              setMusicTouched(true)
            }
          }} />
          <TemplateGrid
            value={templateId}
            onChange={(id) => {
              setPreset(null)
              setTemplateId(id)
            }}
            photos={photos}
            aspect={aspect}
            presetId={preset?.id}
            onPreset={(c) => {
              setPreset(c)
              setTemplateId(c.baseTemplateId)
              const m = presetMusic(c)
              if (m !== undefined) {
                setMusic(m)
                setMusicTouched(true)
              }
              if (c.aspect) setTimeout(() => setAspect(c.aspect!), 0)
              if (c.pace) setTimeout(() => setPace(c.pace!), 0)
              if (c.meta) setTimeout(() => setMeta((x) => ({ ...x, ...c.meta })), 0)
            }}
          />
        </>
      )}
      {step === 2 && (
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          <div className="panel-title">
            <Music size={16} /> 背景音乐 <span className="muted small">会自动识别节拍，画面切换踩在鼓点上</span>
          </div>
          <MusicList
            value={music}
            recommended={tpl.music}
            onChange={(m) => {
              setMusic(m)
              setMusicTouched(true)
            }}
          />
        </div>
      )}
      {step === 3 && (
        <div className="row" style={{ alignItems: 'flex-start', gap: 28 }}>
          <div className="grow">
            <div className="field">
              <label>项目名称</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：张先生 & 李女士 婚纱照" />
            </div>
            <div className="field">
              <label>片头标题</label>
              <input className="input" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
            </div>
            <div className="field">
              <label>副标题</label>
              <input className="input" value={meta.subtitle} onChange={(e) => setMeta({ ...meta, subtitle: e.target.value })} />
            </div>
            <div className="field">
              <label>日期</label>
              <input className="input" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
            </div>
            <div className="field">
              <label>片尾寄语</label>
              <textarea className="textarea" value={meta.ending} onChange={(e) => setMeta({ ...meta, ending: e.target.value })} />
            </div>
          </div>
          <div style={{ width: 420 }}>
            <div className="field">
              <label>画幅</label>
              <AspectPicker value={aspect} onChange={setAspect} />
            </div>
            <div className="field">
              <label>节奏</label>
              <Seg
                value={pace}
                options={[
                  { value: 'slow', label: '舒缓' },
                  { value: 'normal', label: '适中' },
                  { value: 'fast', label: '动感' }
                ]}
                onChange={setPace}
              />
            </div>
            <div className="field">
              <label>时长</label>
              <Seg
                value={durationMode}
                options={[
                  { value: 'photos', label: '按照片数量' },
                  { value: 'music', label: '跟随音乐长度' }
                ]}
                onChange={setDurationMode}
              />
              <div className="muted tiny">
                {durationMode === 'photos' ? '每张照片按节奏停留，音乐在结尾处自动淡出' : '自动调整每张照片的停留时间，让 MV 和整首歌一样长'}
                {music?.analysis && ` · 音乐时长 ${fmtTime(music.analysis.duration)}`}
              </div>
            </div>
            <div className="divider" />
            <div className="row small muted" style={{ alignItems: 'flex-start' }}>
              <Sparkles size={15} style={{ color: 'var(--accent)', flex: 'none' }} />
              <span>
                将使用「{tpl.name}」模板，为 {used.length} 张照片自动匹配版式、卡点转场、字幕与片头片尾，生成后可在编辑器里逐个场景精修。
              </span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

/** 向导里的「AI 推荐」：看几张照片，推荐模板和音乐 */
function WizardAIRecommend({ photos, onApply }: { photos: PhotoAsset[]; onApply: (templateId: string, music: MusicTrack | null) => void }): JSX.Element | null {
  const { settings, builtinMusic, toast } = useApp()
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  if (!settings?.ai.enabled || !settings.ai.hasKey) return null
  return (
    <div className="row" style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10, background: 'var(--accent-soft)' }}>
      <Sparkles size={15} style={{ color: 'var(--accent)' }} />
      <span className="grow small">{reason || '让 AI 看看照片，推荐最合适的模板和音乐'}</span>
      <button
        className="btn sm primary"
        disabled={busy || !photos.length}
        onClick={async () => {
          setBusy(true)
          try {
            const { aiRecommend } = await import('../ai/ai')
            const r = await aiRecommend(photos, builtinMusic)
            onApply(r.templateId, builtinMusic.find((m) => m.id === r.musicId) ?? null)
            setReason(`已选「${getTemplate(r.templateId).name}」：${r.reason}`)
          } catch (e) {
            toast('AI 推荐失败：' + (e as Error).message, 'error')
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} AI 推荐
      </button>
    </div>
  )
}
