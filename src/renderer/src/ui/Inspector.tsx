import { useState } from 'react'
import { Trash2, Copy, Minus, Plus, Crosshair, Settings2, Type, Clock, LayoutGrid, Loader2 } from 'lucide-react'
import type { Project, Scene } from '@shared/types'
import { useApp, usePlayback, updateScene, rearrange, resetPlayhead } from '../store/app'
import { getTemplate } from '../templates'
import { findStyle } from '../engine/renderer'
import { TRANSITIONS, transitionLabel } from '../engine/transitions'
import { retime, newSceneId } from '../arrange/arranger'
import { thumbUrl, Switch, Seg, fmtTime } from './common'
import { AspectPicker } from './Wizard'
import { FILTERS, BEAT_FX_LABEL, type BeatFx } from '../engine/filters'
import { styleTextKeys } from '../templates/styles'
import { OverlayInspector, TextStyleControls } from './OverlayInspector'
import { ensureMasks } from '../analysis/photo'
import { autoText, splitKey, TEXT_LABEL } from '../engine/textkeys'
import type { Pace } from '@shared/types'

export function Inspector({ project }: { project: Project }): JSX.Element {
  const selectedSceneId = useApp((s) => s.selectedSceneId)
  const scene = project.scenes.find((s) => s.id === selectedSceneId)
  return <div className="panel right">{scene ? <SceneInspector project={project} scene={scene} /> : <ProjectInspector project={project} />}</div>
}

function MetaFields({ project }: { project: Project }): JSX.Element {
  const { commit } = useApp()
  const set = (k: keyof Project['meta'], v: string): void => commit((p) => ({ ...p, meta: { ...p.meta, [k]: v } }), { merge: 'meta-' + k })
  return (
    <>
      <div className="field">
        <label>片头标题</label>
        <input className="input" value={project.meta.title} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div className="field">
        <label>副标题</label>
        <input className="input" value={project.meta.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
      </div>
      <div className="field">
        <label>日期</label>
        <input className="input" value={project.meta.date} onChange={(e) => set('date', e.target.value)} />
      </div>
      <div className="field">
        <label>片尾寄语</label>
        <textarea className="textarea" value={project.meta.ending} onChange={(e) => set('ending', e.target.value)} />
      </div>
    </>
  )
}

function ProjectInspector({ project }: { project: Project }): JSX.Element {
  const { commit, toast } = useApp()
  const [maskBusy, setMaskBusy] = useState<string | null>(null)
  const withMask = project.photos.filter((x) => x.mask && !x.excluded).length
  const maskInfo = maskBusy ?? `满屏照片里的人物、宠物会和背景分层移动（已识别 ${withMask} 张）`
  const [busy, setBusy] = useState(false)
  const run = async (patch: Parameters<typeof rearrange>[1], msg: string): Promise<void> => {
    setBusy(true)
    try {
      const next = await rearrange(useApp.getState().project!, patch)
      commit(() => next)
      resetPlayhead()
      toast(msg, 'success')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="panel-body">
      <div className="panel-title">
        <Settings2 size={16} /> 项目设置 {busy && <Loader2 size={14} className="spin" />}
      </div>
      <div className="field">
        <label>画幅（切换后重新编排）</label>
        <AspectPicker value={project.aspect} onChange={(a) => a !== project.aspect && run({ aspect: a }, `已切换为 ${a}`)} />
      </div>
      <div className="field">
        <label>节奏</label>
        <Seg<Pace>
          value={project.settings.pace}
          options={[
            { value: 'slow', label: '舒缓' },
            { value: 'normal', label: '适中' },
            { value: 'fast', label: '动感' }
          ]}
          onChange={(v) => run({ pace: v }, '已按新节奏重新编排')}
        />
      </div>
      <div className="field">
        <label>时长</label>
        <Seg
          value={project.settings.durationMode}
          options={[
            { value: 'photos', label: '按照片数量' },
            { value: 'music', label: '跟随音乐' }
          ]}
          onChange={(v) => run({ durationMode: v }, '已重新编排')}
        />
      </div>
      <div className="field">
        <label>滤镜</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FILTERS.map((f) => (
            <button key={f.id} className={'btn sm' + ((project.settings.filter ?? 'template') === f.id ? ' primary' : '')} onClick={() => commit((p) => ({ ...p, settings: { ...p.settings, filter: f.id } }))}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>卡点特效（重拍时画面跳动）</label>
        <select className="select" value={project.settings.beatFx ?? 'auto'} onChange={(e) => commit((p) => ({ ...p, settings: { ...p.settings, beatFx: e.target.value as BeatFx } }))}>
          {(Object.keys(BEAT_FX_LABEL) as BeatFx[]).map((k) => (
            <option key={k} value={k}>
              {BEAT_FX_LABEL[k]}
              {k === 'auto' ? `（${BEAT_FX_LABEL[getTemplate(project.templateId).beatFx ?? 'none']}）` : ''}
            </option>
          ))}
        </select>
        {!project.music && <div className="muted tiny">需要先添加音乐</div>}
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="grow">
          <span>人物 / 宠物 3D 视差</span>
          <div className="muted tiny">{maskInfo}</div>
        </div>
        <Switch
          on={!!project.settings.parallax}
          onChange={async (v) => {
            commit((p) => ({ ...p, settings: { ...p.settings, parallax: v } }))
            if (v && project.photos.some((x) => x.media !== 'video' && !x.mask && x.maskArea === undefined)) {
              setMaskBusy('正在抠图…')
              const photos = await ensureMasks(useApp.getState().project!.photos, (d, t) => setMaskBusy(`正在抠图 ${d}/${t}`))
              commit((p) => ({ ...p, photos }))
              setMaskBusy(null)
            }
          }}
        />
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <span className="grow">模板粒子特效（花瓣、星光等）</span>
        <Switch on={project.settings.particles} onChange={(v) => commit((p) => ({ ...p, settings: { ...p.settings, particles: v } }))} />
      </div>
      <div className="divider" />
      <div className="panel-title">
        <Type size={16} /> 文字
      </div>
      <MetaFields project={project} />
      <div className="divider" />
      <div className="muted small">在时间线上点击场景，可以更换版式、照片、时长、转场和字幕。</div>
    </div>
  )
}

function SceneInspector({ project, scene }: { project: Project; scene: Scene }): JSX.Element {
  const { commit, selectScene } = useApp()
  const tpl = getTemplate(project.templateId)
  const style = findStyle(tpl, scene.styleId)
  const idx = project.scenes.indexOf(scene)
  const photoMap = new Map(project.photos.map((p) => [p.id, p]))
  const beat = project.music?.analysis ? 60 / project.music.analysis.bpm : 0.6
  const [focusSlot, setFocusSlot] = useState<number | null>(null)
  const isLast = idx === project.scenes.length - 1
  const brand = useApp((s) => s.settings?.brand ?? null)
  const selectedOverlayId = useApp((s) => s.selectedOverlayId)
  const selOverlay = scene.overlays?.find((o) => o.id === selectedOverlayId)
  const textKeys = styleTextKeys(style, tpl.palette, tpl.fonts)
  const sameSlotStyles = tpl.styles.filter((s) => s.slots.length === style.slots.length)
  const otherStyles = tpl.styles.filter((s) => s.slots.length !== style.slots.length)

  const upd = (fn: (s: Scene) => Scene, merge?: string): void => commit((p) => updateScene(p, scene.id, fn), merge ? { merge } : undefined)

  /** 换成槽位数不同的版式：照片不够时从未使用的照片里补，多出来的照片放回去 */
  const switchStyle = (styleId: string): void => {
    const st = findStyle(tpl, styleId)
    commit((p) => {
      const used = new Set(p.scenes.filter((s) => s.kind === 'photo').flatMap((s) => s.photos))
      const spare = p.photos.filter((x) => !x.excluded && !used.has(x.id))
      const photos = [...scene.photos]
      while (photos.length < st.slots.length) photos.push(spare.shift()?.id ?? photos[photos.length % Math.max(1, photos.length)] ?? null)
      photos.length = st.slots.length
      return updateScene(p, scene.id, (s) => ({ ...s, styleId, photos }))
    })
  }

  const setDuration = (d: number): void => upd((s) => ({ ...s, duration: Math.max(0.8, Math.round(d * 100) / 100), transition: { ...s.transition, duration: Math.min(s.transition.duration, Math.max(0.8, d) * 0.6) } }))

  return (
    <div className="panel-body">
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="grow">
          <div style={{ fontWeight: 600, fontSize: 14 }}>{scene.kind === 'intro' ? '片头' : scene.kind === 'outro' ? '片尾' : `场景 ${idx}`}</div>
          <div className="muted tiny">
            {fmtTime(scene.start, true)} – {fmtTime(scene.start + scene.duration, true)}
          </div>
        </div>
        {scene.kind === 'photo' && (
          <>
            <button
              className="btn sm icon"
              title="复制场景"
              onClick={() =>
                commit((p) => {
                  const scenes = [...p.scenes]
                  scenes.splice(idx + 1, 0, { ...structuredClone(scene), id: newSceneId(), seed: scene.seed + 1 })
                  return { ...p, scenes: retime(scenes) }
                })
              }
            >
              <Copy size={13} />
            </button>
            <button
              className="btn sm icon danger"
              title="删除场景"
              onClick={() => {
                commit((p) => ({ ...p, scenes: retime(p.scenes.filter((s) => s.id !== scene.id)) }))
                selectScene(null)
              }}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
        <button className="btn sm" onClick={() => selectScene(null)}>
          完成
        </button>
      </div>

      {selOverlay && <OverlayInspector project={project} scene={scene} overlay={selOverlay} />}
      {(scene.overlays?.length ?? 0) > 0 && !selOverlay && (
        <div style={{ marginBottom: 12 }}>
          <div className="panel-title small">贴纸和文字（{scene.overlays!.length}）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {scene.overlays!.map((o) => (
              <button key={o.id} className="btn sm" onClick={() => useApp.getState().selectOverlay(scene.id, o.id)}>
                {o.kind === 'text' ? `「${(o.text ?? '').slice(0, 6)}」` : o.decor}
              </button>
            ))}
          </div>
        </div>
      )}
      {scene.kind === 'photo' && (
        <>
          <div className="panel-title small">
            <LayoutGrid size={14} /> 版式
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {sameSlotStyles.map((s) => (
              <button key={s.id} className={'btn sm' + (s.id === scene.styleId ? ' primary' : '')} onClick={() => upd((x) => ({ ...x, styleId: s.id }))}>
                {s.name}
              </button>
            ))}
          </div>
          {otherStyles.length > 0 && (
            <select className="select" style={{ marginBottom: 14 }} value="" onChange={(e) => e.target.value && switchStyle(e.target.value)}>
              <option value="">换成其他张数的版式…</option>
              {otherStyles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}（{s.slots.length} 张）
                </option>
              ))}
            </select>
          )}
        </>
      )}

      {scene.photos.length > 0 && (
        <>
          <div className="panel-title small">照片（拖入左侧照片可替换，点击设置焦点）</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(scene.photos.length, 2)}, 1fr)`, gap: 8, marginBottom: 14 }}>
            {scene.photos.map((pid, slot) => {
              const ph = pid ? photoMap.get(pid) : undefined
              const focus = scene.focus?.[slot] ?? ph?.analysis?.focus ?? { x: 0.5, y: 0.45 }
              const ar = ph ? ph.width / ph.height : 1
              return (
                <div
                  key={slot}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData('application/x-mv-photo')
                    if (id) upd((s) => ({ ...s, photos: s.photos.map((x, i) => (i === slot ? id : x)), focus: { ...s.focus, [slot]: undefined as never } }))
                  }}
                  onClick={(e) => {
                    if (focusSlot !== slot) {
                      setFocusSlot(slot)
                      return
                    }
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const x = (e.clientX - r.left) / r.width
                    const y = (e.clientY - r.top) / r.height
                    upd((s) => ({ ...s, focus: { ...(s.focus ?? {}), [slot]: { x, y } } }))
                  }}
                  style={{
                    position: 'relative',
                    aspectRatio: String(ar),
                    maxHeight: 180,
                    borderRadius: 6,
                    backgroundImage: thumbUrl(ph?.thumb),
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: `2px solid ${focusSlot === slot ? 'var(--accent)' : 'var(--line-2)'}`,
                    cursor: focusSlot === slot ? 'crosshair' : 'pointer'
                  }}
                  title={focusSlot === slot ? '点击照片上的位置设为画面焦点（运镜会朝这里推进）' : '点击后再点一次设置焦点'}
                >
                  {focusSlot === slot && (
                    <div style={{ position: 'absolute', left: `${focus.x * 100}%`, top: `${focus.y * 100}%`, transform: 'translate(-50%,-50%)', color: 'var(--accent)', filter: 'drop-shadow(0 0 2px #000)' }}>
                      <Crosshair size={20} />
                    </div>
                  )}
                  <span className="badge" style={{ position: 'absolute', left: 4, top: 4, background: 'rgba(0,0,0,0.6)' }}>
                    {slot + 1}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="panel-title small">
        <Clock size={14} /> 时长
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn sm icon" onClick={() => setDuration(scene.duration - beat)} title="减少一拍">
          <Minus size={13} />
        </button>
        <div className="grow" style={{ textAlign: 'center' }}>
          <b>{scene.duration.toFixed(2)}</b> 秒 <span className="muted small">≈ {Math.round(scene.duration / beat)} 拍</span>
        </div>
        <button className="btn sm icon" onClick={() => setDuration(scene.duration + beat)} title="增加一拍">
          <Plus size={13} />
        </button>
      </div>

      {!isLast && (
        <>
          <div className="panel-title small">转场（进入下一个场景）</div>
          <select className="select" style={{ marginBottom: 8 }} value={scene.transition.name} onChange={(e) => upd((s) => ({ ...s, transition: { name: e.target.value, duration: e.target.value === 'cut' ? 0 : s.transition.duration || Math.min(0.8, s.duration * 0.6) } }))}>
            <option value="cut">硬切</option>
            {TRANSITIONS.map((t) => (
              <option key={t.name} value={t.name}>
                {t.group} · {t.label}
              </option>
            ))}
          </select>
          {scene.transition.name !== 'cut' && (
            <div className="field">
              <label>
                {transitionLabel(scene.transition.name)} 时长 {scene.transition.duration.toFixed(2)} 秒
              </label>
              <input type="range" min={0.2} max={Math.max(0.3, scene.duration * 0.8)} step={0.05} value={scene.transition.duration} onChange={(e) => upd((s) => ({ ...s, transition: { ...s.transition, duration: Number(e.target.value) } }), 'tdur')} />
            </div>
          )}
        </>
      )}

      {scene.kind === 'photo' && textKeys.length > 0 && (
        <>
          <div className="panel-title small" style={{ marginTop: 6 }}>
            <Type size={14} /> 文字
          </div>
          {textKeys.map(({ key, def }) => {
            const { base, slot } = splitKey(key)
            const auto = autoText(key, scene, project, brand) ?? def
            const label = TEXT_LABEL[base] + (textKeys.filter((k) => splitKey(k.key).base === base).length > 1 ? ` ${slot + 1}` : '')
            const val = scene.texts?.[key]
            return (
              <div className="field" key={key}>
                <label className="row">
                  <span className="grow">{label}</span>
                  {val !== undefined && auto && (
                    <button className="btn sm ghost" style={{ height: 20, fontSize: 11 }} onClick={() => upd((s) => { const t = { ...s.texts }; delete t[key]; return { ...s, texts: t } })}>
                      恢复自动
                    </button>
                  )}
                </label>
                {base === 'caption' ? (
                  <textarea className="textarea" placeholder="留空则不显示" value={val ?? auto} onChange={(e) => upd((s) => ({ ...s, texts: { ...s.texts, [key]: e.target.value } }), 'txt-' + scene.id + key)} />
                ) : (
                  <input className="input" placeholder={base === 'price' ? '例如 ¥128，留空则隐藏价格' : '留空则不显示'} value={val ?? auto} onChange={(e) => upd((s) => ({ ...s, texts: { ...s.texts, [key]: e.target.value } }), 'txt-' + scene.id + key)} />
                )}
                <TextStyleControls scene={scene} textKey={key} />
                {base === 'caption' && (
                  <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                    {tpl.captions.slice(0, 6).map((c) => (
                      <button key={c} className="btn sm" style={{ fontSize: 11 }} onClick={() => upd((s) => ({ ...s, texts: { ...s.texts, [key]: c } }))}>
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {textKeys.some((k) => ['product', 'price'].includes(splitKey(k.key).base)) && (
            <div className="muted tiny">品名和价格默认取自照片文件名（如「草莓蛋糕-128.jpg」），在这里修改只影响当前场景。</div>
          )}
        </>
      )}
      {scene.kind !== 'photo' && (
        <>
          <div className="divider" />
          <MetaFields project={project} />
          {scene.kind === 'outro' && <div className="muted tiny">店铺名称、地址、电话在首页「品牌设置」里填写，会自动出现在片尾。</div>}
        </>
      )}
    </div>
  )
}
