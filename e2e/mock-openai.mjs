// 模拟 OpenAI 接口：校验 Key、按 TASK 返回固定格式的 JSON、语音返回测试 mp3，并记录收到的请求
import http from 'http'
import { readFileSync } from 'fs'

export function startMockOpenAI({ key = 'test-key', voice = 'e2e/fixtures/voice.mp3' } = {}) {
  const log = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', () => {
      const auth = req.headers.authorization
      const entry = { method: req.method, url: req.url, auth: auth === `Bearer ${key}` }
      log.push(entry)
      if (!entry.auth) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: { message: 'Incorrect API key provided' } }))
      }
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ data: [{ id: 'mock-vision' }, { id: 'mock-tts' }] }))
      }
      if (req.url === '/v1/audio/speech') {
        const j = JSON.parse(body)
        entry.task = 'speech'
        entry.input = j.input
        entry.model = j.model
        res.writeHead(200, { 'Content-Type': 'audio/mpeg' })
        return res.end(readFileSync(voice))
      }
      if (req.url === '/v1/chat/completions') {
        const j = JSON.parse(body)
        const sys = String(j.messages[0].content)
        const task = (sys.match(/TASK:(\w+)/) || [])[1]
        const user = j.messages[1].content
        const parts = Array.isArray(user) ? user : []
        const idx = parts.filter((p) => p.type === 'text' && /^#\d+/.test(p.text)).map((p) => Number(p.text.match(/^#(\d+)/)[1]))
        entry.task = task
        entry.model = j.model
        entry.images = parts.filter((p) => p.type === 'image_url').length
        entry.json = j.response_format?.type === 'json_object'
        let out = {}
        if (task === 'copy') {
          out = {
            title: 'AI写的标题',
            subtitle: 'AI Subtitle',
            ending: '谢谢你\\n陪伴我们',
            photos: idx.map((i) => ({ index: i, caption: `AI字幕第${i}张`, sellingPoint: `卖点${i}`, category: '宠物' }))
          }
        } else if (task === 'recommend') {
          const music = (sys.match(/builtin:[\w.-]+/g) || [])[0]
          out = { templateId: 'pets', musicId: music, reason: '照片里都是猫狗，适合萌宠模板' }
        } else if (task === 'order') {
          out = { order: [...idx].reverse(), highlights: idx.slice(0, 2), reason: '从户外玩耍排到居家日常' }
        } else if (task === 'narration') {
          out = { script: '这是 AI 写的测试旁白，介绍毛孩子们快乐的一天。' }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        // 故意包一层代码块，验证客户端的容错解析
        return res.end(JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify(out) + '\n```' } }] }))
      }
      res.writeHead(404)
      res.end()
    })
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, log })))
}
