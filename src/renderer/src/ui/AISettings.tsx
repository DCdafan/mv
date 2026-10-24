import { useState } from 'react'
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Modal, Switch } from './common'
import { useApp } from '../store/app'

const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']

export function AISettingsDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { settings, saveSettings, toast } = useApp()
  const cur = settings!.ai
  const [enabled, setEnabled] = useState(cur.enabled)
  const [baseUrl, setBaseUrl] = useState(cur.baseUrl)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(cur.model)
  const [ttsModel, setTtsModel] = useState(cur.ttsModel)
  const [voice, setVoice] = useState(cur.voice)
  const [models, setModels] = useState<string[]>([])
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null)
  const [testing, setTesting] = useState(false)

  const save = async (): Promise<void> => {
    await saveSettings({ ai: { enabled, baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim(), ttsModel: ttsModel.trim(), voice } })
  }

  return (
    <Modal
      title={
        <span className="row">
          <Sparkles size={17} /> AI 设置
        </span>
      }
      width={540}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn"
            disabled={testing}
            onClick={async () => {
              setTesting(true)
              setTest(null)
              try {
                await save()
                const list = await window.mv.ai.models()
                setModels(list)
                setTest({ ok: true, msg: `连接成功，共 ${list.length} 个模型${list.includes(model) ? '' : `；注意：没找到「${model}」`}` })
              } catch (e) {
                setTest({ ok: false, msg: (e as Error).message })
              } finally {
                setTesting(false)
              }
            }}
          >
            {testing ? <Loader2 size={14} className="spin" /> : null} 测试连接
          </button>
          <div className="grow" />
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            onClick={async () => {
              await save()
              toast('AI 设置已保存', 'success')
              onClose()
            }}
          >
            保存
          </button>
        </>
      }
    >
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="grow">
          <b>启用 AI 功能</b>
          <div className="muted tiny">写文案、推荐模板、故事线排序、旁白配音。只发送 360px 缩略图，费用很低。</div>
        </div>
        <Switch on={enabled} onChange={setEnabled} />
      </div>
      <div className="field">
        <label>接口地址（OpenAI 或兼容 OpenAI 格式的服务）</label>
        <input className="input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
      </div>
      <div className="field">
        <label>API Key</label>
        <input className="input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={cur.hasKey ? '已设置（留空则不修改）' : 'sk-...'} />
        <div className="row tiny muted">
          <span className="grow">Key 用系统钥匙串加密保存在本机，只在主进程里使用。</span>
          {cur.hasKey && (
            <button className="btn sm ghost" onClick={async () => { await saveSettings({ ai: { ...cur, apiKey: '__CLEAR__' } }); toast('已清除 API Key') }}>
              清除 Key
            </button>
          )}
        </div>
      </div>
      <div className="field">
        <label>视觉 / 文本模型（需要支持图片输入）</label>
        <input className="input" list="ai-models" value={model} onChange={(e) => setModel(e.target.value)} />
        <datalist id="ai-models">
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <div className="field grow">
          <label>语音模型</label>
          <input className="input" list="ai-models" value={ttsModel} onChange={(e) => setTtsModel(e.target.value)} />
        </div>
        <div className="field" style={{ width: 160 }}>
          <label>音色</label>
          <input className="input" list="ai-voices" value={voice} onChange={(e) => setVoice(e.target.value)} />
          <datalist id="ai-voices">
            {VOICES.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>
      </div>
      {test && (
        <div className="row small" style={{ color: test.ok ? 'var(--ok)' : 'var(--err)' }}>
          {test.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{test.msg}</span>
        </div>
      )}
    </Modal>
  )
}
