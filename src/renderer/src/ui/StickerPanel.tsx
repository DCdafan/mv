import { useMemo, useState } from 'react'
import { Type } from 'lucide-react'
import type { Overlay, Project } from '@shared/types'
import { useApp, usePlayback, targetScene } from '../store/app'
import { DECORS, decorCanvas } from '../engine/decor'
import { newOverlayId } from '../engine/overlays'
import { getTemplate } from '../templates'

const TEXT_PRESETS: { label: string; overlay: Partial<Overlay> }[] = [
  { label: '标题字', overlay: { text: '输入文字', font: 'ZCOOLKuaiLe', size: 0.08, color: '#ffffff', color2: '#ff6f91' } },
  { label: '手写字', overlay: { text: '写点什么吧', font: 'LongCang', size: 0.07, color: '#ffffff' } },
  { label: '书法字', overlay: { text: '福', font: 'MaShanZheng', size: 0.12, color: '#ffd36b', color2: '#8f1414' } },
  { label: '英文花体', overlay: { text: 'Love', font: 'GreatVibes', size: 0.1, color: '#ffffff' } },
  { label: '简约字', overlay: { text: '标题文字', font: 'Sans', size: 0.06, color: '#ffffff' } }
]

export function StickerPanel({ project }: { project: Project }): JSX.Element {
  const tpl = getTemplate(project.templateId)
  const [c1, setC1] = useState(tpl.palette.primary)
  const [c2, setC2] = useState(tpl.palette.accent)
  const { commit, selectOverlay, toast } = useApp()
  const thumbs = useMemo(() => Object.keys(DECORS).map((name) => ({ name, label: DECORS[name].label, url: decorCanvas(name, c1, c2).toDataURL() })), [c1, c2])

  const add = (o: Partial<Overlay>): void => {
    const scene = targetScene(project)
    if (!scene) return
    const overlay: Overlay = { id: newOverlayId(), kind: 'sticker', x: 0.5, y: 0.5, w: 0.16, rotation: 0, color: c1, color2: c2, anim: 'pop', ...o }
    commit((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === scene.id ? { ...s, overlays: [...(s.overlays ?? []), overlay] } : s)) }))
    selectOverlay(scene.id, overlay.id)
    const t = usePlayback.getState().time
    if (t < scene.start || t >= scene.start + scene.duration) usePlayback.setState({ time: scene.start + Math.min(1.5, scene.duration / 2), playing: false })
    toast(`已添加到「${scene.kind === 'intro' ? '片头' : scene.kind === 'outro' ? '片尾' : '场景 ' + project.scenes.indexOf(scene)}」，可在画面上拖动`)
  }

  return (
    <>
      <div className="panel-title small">
        <Type size={14} /> 添加文字
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 14 }}>
        {TEXT_PRESETS.map((p) => (
          <button key={p.label} className="btn sm" onClick={() => add({ ...p.overlay, kind: 'text', w: 0.5, anim: 'fade' })}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="panel-title small grow" style={{ margin: 0 }}>
          贴纸
        </span>
        <span className="tiny muted">颜色</span>
        <input type="color" value={c1} onChange={(e) => setC1(e.target.value)} style={{ width: 26, height: 22, border: 0, background: 'none' }} title="主色" />
        <input type="color" value={c2} onChange={(e) => setC2(e.target.value)} style={{ width: 26, height: 22, border: 0, background: 'none' }} title="辅色" />
      </div>
      <div className="muted tiny" style={{ marginBottom: 8 }}>
        点击添加到当前场景（选中的场景，或播放头所在的场景）
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {thumbs.map((t) => (
          <button
            key={t.name}
            className="btn"
            title={t.label}
            style={{ height: 74, flexDirection: 'column', gap: 2, padding: 4, background: 'var(--bg-2)' }}
            onClick={() => add({ kind: 'sticker', decor: t.name, w: ['flourish', 'brush', 'tape', 'ribbon'].includes(t.name) ? 0.3 : 0.14 })}
          >
            <img src={t.url} style={{ maxWidth: '100%', maxHeight: 46, objectFit: 'contain' }} />
            <span className="tiny muted">{t.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}
