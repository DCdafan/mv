import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../store/app'
import { fileUrl } from '../engine/textures'

export function Modal(props: { title: ReactNode; width?: number; onClose: () => void; children: ReactNode; footer?: ReactNode; height?: number | string }): JSX.Element {
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [props.onClose])
  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="modal" style={{ width: props.width ?? 560, height: props.height }}>
        <div className="modal-head">
          <div className="grow">{props.title}</div>
          <button className="btn ghost sm icon" onClick={props.onClose} title="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{props.children}</div>
        {props.footer && <div className="modal-foot">{props.footer}</div>}
      </div>
    </div>
  )
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return <div className={'switch' + (on ? ' on' : '')} onClick={() => onChange(!on)} role="switch" aria-checked={on} />
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }): JSX.Element {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value }: { value: number }): JSX.Element {
  return (
    <div className="progress">
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

export function fmtTime(t: number, ms = false): string {
  t = Math.max(0, t)
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return ms ? `${base}.${String(Math.floor((t % 1) * 10))}` : base
}

export function Toasts(): JSX.Element {
  const toasts = useApp((s) => s.toasts)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={'toast ' + t.kind}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

export const thumbUrl = (p?: string): string => (p ? `url("${fileUrl(p)}")` : 'none')

export function AspectIcon({ aspect, size = 22 }: { aspect: string; size?: number }): JSX.Element {
  const [w, h] = aspect.split(':').map(Number)
  const k = size / Math.max(w, h)
  return <div className="shape" style={{ width: w * k, height: h * k }} />
}
