// OpenAI 兼容接口：在主进程里调用，API Key 不暴露给页面
import { promises as fsp } from 'fs'

export interface AIConn {
  baseUrl: string
  apiKey: string
  model: string
  ttsModel: string
  voice: string
}

function url(c: AIConn, path: string): string {
  return c.baseUrl.replace(/\/+$/, '') + path
}

async function request(c: AIConn, path: string, init: RequestInit, timeoutMs = 120000): Promise<Response> {
  if (!c.apiKey) throw new Error('还没有填写 API Key')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url(c, path), {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${c.apiKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      let msg = body.slice(0, 300)
      try {
        msg = JSON.parse(body).error?.message ?? msg
      } catch {
        /* 不是 JSON */
      }
      throw new Error(`接口返回 ${res.status}：${msg}`)
    }
    return res
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('请求超时，请检查网络或接口地址')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** 列出可用模型（用于「测试连接」） */
export async function listModels(c: AIConn): Promise<string[]> {
  const res = await request(c, '/models', { method: 'GET' }, 20000)
  const data = (await res.json()) as { data?: { id: string }[] }
  return (data.data ?? []).map((m) => m.id).sort()
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } })[]
}

/** 对话补全，json=true 时要求模型返回 JSON 对象 */
export async function chat(c: AIConn, messages: ChatMessage[], json: boolean): Promise<string> {
  const body: Record<string, unknown> = { model: c.model, messages }
  if (json) body.response_format = { type: 'json_object' }
  const res = await request(c, '/chat/completions', { method: 'POST', body: JSON.stringify(body) })
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('模型没有返回内容')
  return content
}

/** 文字转语音，保存为 mp3 */
export async function speech(c: AIConn, text: string, outPath: string): Promise<void> {
  const res = await request(c, '/audio/speech', {
    method: 'POST',
    body: JSON.stringify({ model: c.ttsModel, voice: c.voice, input: text, response_format: 'mp3' })
  })
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 100) throw new Error('语音合成返回的数据为空')
  await fsp.writeFile(outPath, buf)
}
