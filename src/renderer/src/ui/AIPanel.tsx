import { useState } from 'react'
import { Sparkles, Wand2, ListOrdered, Mic, Upload, Trash2, Loader2, Settings2, LayoutTemplate } from 'lucide-react'
import type { Project } from '@shared/types'
import { useApp, rearrange, usePlayback, resetPlayhead } from '../store/app'
import { aiWriteCopy, aiRecommend, aiStoryOrder, applyStoryOrder, aiNarrationScript, aiNarration, attachVoiceover, type Recommendation } from '../ai/ai'
import { getTemplate } from '../templates'
import { fmtTime } from './common'
import { AISettingsDialog } from './AISettings'

export function AIPanel({ project }: { project: Project }): JSX.Element {
  const { settings, commit, toast, builtinMusic } = useApp()
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [script, setScript] = useState(project.voiceover?.text ?? '')
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const ready = !!settings?.ai.enabled && !!settings.ai.hasKey

  const run = async (name: string, fn: () => Promise<void>): Promise<void> => {
    setBusy(name)
    setProgress('')
    try {
      await fn()
    } catch (e) {
      toast(`${name}失败：${(e as Error).message}`, 'error')
    } finally {
      setBusy(null)
      setProgress('')
    }
  }
  const cur = (): Project => useApp.getState().project!
  const btn = (name: string, icon: JSX.Element, onClick: () => void, disabled = false): JSX.Element => (
    <button className="btn" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6 }} disabled={!!busy || disabled} onClick={onClick}>
      {busy === name ? <Loader2 size={15} className="spin" /> : icon} {name}
    </button>
  )

  const vo = project.voiceover
  return (
    <>
      {!ready && (
        <div style={{ padding: 12, borderRadius: 10, background: 'var(--accent-soft)', marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <Sparkles size={16} style={{ color: 'var(--accent)' }} />
            <b>AI 功能未开启</b>
          </div>
          <div className="small muted" style={{ marginBottom: 10 }}>
            填写 OpenAI（或兼容接口）的 API Key 后，可以自动写文案、推荐模板、按故事线排序、生成旁白。只会发送 360px 的缩略图。
          </div>
          <button className="btn sm primary" onClick={() => setShowSettings(true)}>
            <Settings2 size={13} /> 打开 AI 设置
          </button>
        </div>
      )}
      <div className="panel-title small">
        <Sparkles size={14} /> AI 助手 {ready && <button className="btn sm ghost icon" title="AI 设置" onClick={() => setShowSettings(true)}><Settings2 size={13} /></button>}
      </div>
      {btn('AI 写文案', <Wand2 size={15} />, () =>
        run('AI 写文案', async () => {
          const next = await aiWriteCopy(cur(), setProgress)
          commit(() => next)
          toast('已生成字幕、卖点和片头片尾文案（可撤销）', 'success')
        }), !ready
      )}
      {btn('AI 推荐模板和音乐', <LayoutTemplate size={15} />, () =>
        run('AI 推荐模板和音乐', async () => setRec(await aiRecommend(cur().photos, builtinMusic))), !ready
      )}
      {rec && (
        <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-2)', marginBottom: 8 }} className="small">
          <div style={{ marginBottom: 4 }}>
            推荐模板：<b>{getTemplate(rec.templateId).name}</b>
            {rec.musicId && (
              <>
                ，音乐：<b>{builtinMusic.find((m) => m.id === rec.musicId)?.name}</b>
              </>
            )}
          </div>
          <div className="muted tiny" style={{ marginBottom: 8 }}>
            {rec.reason}
          </div>
          <button
            className="btn sm primary"
            onClick={() =>
              run('应用推荐', async () => {
                const music = rec.musicId ? builtinMusic.find((m) => m.id === rec.musicId) ?? null : cur().music
                const next = await rearrange(cur(), { templateId: rec.templateId, music })
                commit(() => next)
                resetPlayhead()
                setRec(null)
                toast('已应用推荐', 'success')
              })
            }
          >
            应用
          </button>
          <button className="btn sm ghost" onClick={() => setRec(null)}>
            忽略
          </button>
        </div>
      )}
      {btn('AI 故事线排序', <ListOrdered size={15} />, () =>
        run('AI 故事线排序', async () => {
          const order = await aiStoryOrder(cur())
          const next = await rearrange(applyStoryOrder(cur(), order))
          commit(() => next)
          resetPlayhead()
          toast(`已按故事线重新排序，${order.highlights.length} 张高光照片放在大画面${order.reason ? '：' + order.reason : ''}`, 'success')
        }), !ready
      )}
      {progress && <div className="tiny muted" style={{ marginBottom: 8 }}>{progress}</div>}

      <div className="divider" />
      <div className="panel-title small">
        <Mic size={14} /> 旁白
      </div>
      <textarea className="textarea" placeholder="旁白稿：可以让 AI 写，也可以自己写" value={script} onChange={(e) => setScript(e.target.value)} style={{ minHeight: 90, marginBottom: 6 }} />
      <div className="row" style={{ marginBottom: 6 }}>
        <button className="btn sm grow" disabled={!!busy || !ready} onClick={() => run('AI 写旁白', async () => setScript(await aiNarrationScript(cur())))}>
          {busy === 'AI 写旁白' ? <Loader2 size={13} className="spin" /> : <Wand2 size={13} />} AI 写旁白稿
        </button>
        <button
          className="btn sm grow primary"
          disabled={!!busy || !ready || !script.trim()}
          onClick={() =>
            run('合成语音', async () => {
              const next = await aiNarration(cur(), script.trim())
              commit(() => next)
              toast('旁白已加入，播放时背景音乐会自动压低', 'success')
            })
          }
        >
          {busy === '合成语音' ? <Loader2 size={13} className="spin" /> : <Mic size={13} />} 合成语音
        </button>
      </div>
      <button
        className="btn sm"
        style={{ width: '100%', marginBottom: 10 }}
        disabled={!!busy}
        onClick={() =>
          run('导入旁白', async () => {
            const p = await window.mv.openMusic()
            if (!p) return
            const next = await attachVoiceover(cur(), p)
            commit(() => next)
            toast('已导入旁白录音', 'success')
          })
        }
      >
        <Upload size={13} /> 导入自己录的旁白
      </button>
      {vo && (
        <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-2)' }}>
          <div className="row small" style={{ marginBottom: 8 }}>
            <Mic size={14} style={{ color: 'var(--accent)' }} />
            <span className="grow">旁白 {fmtTime(vo.duration)}</span>
            <button className="btn sm icon danger" title="移除旁白" onClick={() => commit((p) => ({ ...p, voiceover: null }))}>
              <Trash2 size={13} />
            </button>
          </div>
          <div className="field">
            <label>从第 {vo.start.toFixed(1)} 秒开始</label>
            <input type="range" min={0} max={Math.max(1, project.scenes.reduce((s, x) => s + x.duration, 0) - 1)} step={0.1} value={vo.start} onChange={(e) => commit((p) => ({ ...p, voiceover: { ...p.voiceover!, start: Number(e.target.value) } }), { merge: 'vo-start' })} />
          </div>
          <div className="field">
            <label>旁白音量 {Math.round(vo.volume * 100)}%</label>
            <input type="range" min={0} max={2} step={0.05} value={vo.volume} onChange={(e) => commit((p) => ({ ...p, voiceover: { ...p.voiceover!, volume: Number(e.target.value) } }), { merge: 'vo-vol' })} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>旁白时背景音乐降到 {Math.round(vo.duck * 100)}%</label>
            <input type="range" min={0} max={1} step={0.05} value={vo.duck} onChange={(e) => commit((p) => ({ ...p, voiceover: { ...p.voiceover!, duck: Number(e.target.value) } }), { merge: 'vo-duck' })} />
          </div>
        </div>
      )}
      {showSettings && <AISettingsDialog onClose={() => setShowSettings(false)} />}
    </>
  )
}
