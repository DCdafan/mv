import { Trash2, Copy, ArrowUp, ArrowDown } from 'lucide-react'
import type { Overlay, Project, Scene, TextOverride } from '@shared/types'
import { useApp } from '../store/app'
import { OVERLAY_ANIM_LABEL, newOverlayId } from '../engine/overlays'
import { DECORS } from '../engine/decor'
import { FONT_LABEL } from '../engine/text'
import type { FontKey } from '../engine/types'

const FONTS = Object.keys(FONT_LABEL) as FontKey[]

/** 编辑选中的贴纸 / 文字 */
export function OverlayInspector({ project, scene, overlay }: { project: Project; scene: Scene; overlay: Overlay }): JSX.Element {
  const { commit, selectOverlay } = useApp()
  const upd = (patch: Partial<Overlay>, merge?: string): void =>
    commit((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === scene.id ? { ...s, overlays: (s.overlays ?? []).map((o) => (o.id === overlay.id ? { ...o, ...patch } : o)) } : s)) }), merge ? { merge: merge + overlay.id } : undefined)
  const move = (dir: number): void =>
    commit((p) => ({
      ...p,
      scenes: p.scenes.map((s) => {
        if (s.id !== scene.id) return s
        const list = [...(s.overlays ?? [])]
        const i = list.findIndex((o) => o.id === overlay.id)
        const j = Math.max(0, Math.min(list.length - 1, i + dir))
        ;[list[i], list[j]] = [list[j], list[i]]
        return { ...s, overlays: list }
      })
    }))
  const isText = overlay.kind === 'text'
  return (
    <div style={{ padding: 10, borderRadius: 10, background: 'var(--panel-2)', marginBottom: 14, border: '1px solid rgba(255,138,91,0.4)' }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <b className="grow">{isText ? '文字' : `贴纸 · ${DECORS[overlay.decor ?? '']?.label ?? ''}`}</b>
        <button className="btn sm icon" title="上移一层" onClick={() => move(1)}>
          <ArrowUp size={13} />
        </button>
        <button className="btn sm icon" title="下移一层" onClick={() => move(-1)}>
          <ArrowDown size={13} />
        </button>
        <button
          className="btn sm icon"
          title="复制"
          onClick={() => {
            const copy = { ...overlay, id: newOverlayId(), x: Math.min(0.9, overlay.x + 0.04), y: Math.min(0.9, overlay.y + 0.04) }
            commit((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === scene.id ? { ...s, overlays: [...(s.overlays ?? []), copy] } : s)) }))
            selectOverlay(scene.id, copy.id)
          }}
        >
          <Copy size={13} />
        </button>
        <button
          className="btn sm icon danger"
          title="删除（Delete）"
          onClick={() => {
            commit((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === scene.id ? { ...s, overlays: (s.overlays ?? []).filter((o) => o.id !== overlay.id) } : s)) }))
            selectOverlay(scene.id, null)
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {isText && (
        <>
          <textarea className="textarea" value={overlay.text ?? ''} onChange={(e) => upd({ text: e.target.value }, 'otext')} style={{ minHeight: 50, marginBottom: 8 }} />
          <div className="row" style={{ marginBottom: 8 }}>
            <select className="select grow" value={overlay.font ?? 'ZCOOLKuaiLe'} onChange={(e) => upd({ font: e.target.value })}>
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {FONT_LABEL[f]}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="tiny muted" style={{ width: 40 }}>
          颜色
        </span>
        <input type="color" value={overlay.color.slice(0, 7)} onChange={(e) => upd({ color: e.target.value }, 'ocolor')} />
        <span className="tiny muted">{isText ? '描边' : '辅色'}</span>
        <input type="color" value={(overlay.color2 ?? '#ffffff').slice(0, 7)} onChange={(e) => upd({ color2: e.target.value }, 'ocolor2')} />
        {isText && overlay.color2 && (
          <button className="btn sm ghost" onClick={() => upd({ color2: undefined })}>
            去掉描边
          </button>
        )}
      </div>
      <div className="field">
        <label>{isText ? `字号 ${Math.round((overlay.size ?? 0.06) * 1000) / 10}` : `大小 ${Math.round(overlay.w * 100)}%`}</label>
        {isText ? (
          <input type="range" min={0.02} max={0.2} step={0.002} value={overlay.size ?? 0.06} onChange={(e) => upd({ size: Number(e.target.value) }, 'osize')} />
        ) : (
          <input type="range" min={0.03} max={0.8} step={0.005} value={overlay.w} onChange={(e) => upd({ w: Number(e.target.value) }, 'ow')} />
        )}
      </div>
      {isText && (
        <div className="field">
          <label>文本框宽度 {Math.round(overlay.w * 100)}%</label>
          <input type="range" min={0.1} max={1} step={0.01} value={overlay.w} onChange={(e) => upd({ w: Number(e.target.value) }, 'ow')} />
        </div>
      )}
      <div className="field">
        <label>旋转 {Math.round(overlay.rotation)}°</label>
        <input type="range" min={-180} max={180} step={1} value={overlay.rotation} onChange={(e) => upd({ rotation: Number(e.target.value) }, 'orot')} />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>动画</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(Object.keys(OVERLAY_ANIM_LABEL) as Overlay['anim'][]).map((a) => (
            <button key={a} className={'btn sm' + (overlay.anim === a ? ' primary' : '')} onClick={() => upd({ anim: a })}>
              {OVERLAY_ANIM_LABEL[a]}
            </button>
          ))}
        </div>
      </div>
      <div className="muted tiny" style={{ marginTop: 8 }}>
        在画面上拖动可移动位置，拖右下角圆点可缩放
      </div>
      {void project}
    </div>
  )
}

/** 模板文字的样式覆盖：字体 / 颜色 / 大小 */
export function TextStyleControls({ scene, textKey }: { scene: Scene; textKey: string }): JSX.Element {
  const { commit } = useApp()
  const ov: TextOverride = scene.textStyle?.[textKey] ?? {}
  const set = (patch: Partial<TextOverride>, merge?: string): void =>
    commit(
      (p) => ({
        ...p,
        scenes: p.scenes.map((s) => {
          if (s.id !== scene.id) return s
          const next = { ...ov, ...patch }
          const textStyle = { ...(s.textStyle ?? {}) }
          if (!next.font && !next.color && (!next.scale || next.scale === 1)) delete textStyle[textKey]
          else textStyle[textKey] = next
          return { ...s, textStyle }
        })
      }),
      merge ? { merge: merge + scene.id + textKey } : undefined
    )
  return (
    <div className="row" style={{ gap: 4, marginTop: 4 }}>
      <select className="select" style={{ height: 26, fontSize: 11, flex: 1, minWidth: 0 }} value={ov.font ?? ''} onChange={(e) => set({ font: e.target.value || undefined })}>
        <option value="">模板字体</option>
        {FONTS.map((f) => (
          <option key={f} value={f}>
            {FONT_LABEL[f]}
          </option>
        ))}
      </select>
      <input type="color" title="文字颜色" value={(ov.color ?? '#ffffff').slice(0, 7)} onChange={(e) => set({ color: e.target.value }, 'tc')} style={{ width: 26, height: 24 }} />
      <input type="range" title="大小" min={0.5} max={1.8} step={0.05} value={ov.scale ?? 1} onChange={(e) => set({ scale: Number(e.target.value) }, 'ts')} style={{ width: 70 }} />
      {(ov.font || ov.color || (ov.scale && ov.scale !== 1)) && (
        <button className="btn sm ghost" style={{ height: 24, padding: '0 6px', fontSize: 11 }} onClick={() => set({ font: undefined, color: undefined, scale: 1 })}>
          还原
        </button>
      )}
    </div>
  )
}
