// AI 功能：调用 OpenAI 兼容接口（在主进程发请求），只发送 360px 缩略图，节省流量和费用
import type { MusicTrack, PhotoAsset, Project } from '@shared/types'
import { projectDuration } from '@shared/types'
import { fileUrl } from '../engine/textures'
import { getTemplate, TEMPLATES } from '../templates'
import type { ChatContent } from '../../../preload/index'

type Msg = { role: 'system' | 'user' | 'assistant'; content: ChatContent }

/** 从模型回复里取出 JSON（兼容带 ```json 代码块或前后有说明文字的情况） */
export function parseJson<T>(text: string): T {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('AI 返回的内容不是 JSON')
  return JSON.parse(t.slice(a, b + 1)) as T
}

async function dataUrl(path: string): Promise<string> {
  const blob = await (await fetch(fileUrl(path))).blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('读取缩略图失败'))
    r.readAsDataURL(blob)
  })
}

/** 一组照片 → 「#序号 + 图片」交替的消息内容 */
async function imageContent(photos: { index: number; photo: PhotoAsset }[], intro: string): Promise<ChatContent> {
  const parts: Exclude<ChatContent, string> = [{ type: 'text', text: intro }]
  for (const { index, photo } of photos) {
    const extra = photo.product ? `（文件名商品：${photo.product.name}${photo.product.price ? `，价格 ${photo.product.price} 元` : ''}）` : ''
    parts.push({ type: 'text', text: `#${index}${photo.media === 'video' ? '（视频片段封面）' : ''}${extra}` })
    parts.push({ type: 'image_url', image_url: { url: await dataUrl(photo.thumb ?? photo.proxy ?? photo.path), detail: 'low' } })
  }
  return parts
}

async function ask<T>(task: string, system: string, user: ChatContent): Promise<T> {
  const messages: Msg[] = [
    { role: 'system', content: `TASK:${task}\n${system}\n只输出一个 JSON 对象，不要输出其他文字。` },
    { role: 'user', content: user }
  ]
  return parseJson<T>(await window.mv.ai.chat(messages, true))
}

const usable = (p: Project): PhotoAsset[] => p.photos.filter((x) => !x.excluded)

// ---------------- 1. AI 写文案 ----------------

interface CopyResult {
  title?: string
  subtitle?: string
  ending?: string
  photos?: { index: number; caption?: string; sellingPoint?: string; category?: string }[]
}

export async function aiWriteCopy(project: Project, onProgress?: (msg: string) => void): Promise<Project> {
  const tpl = getTemplate(project.templateId)
  const photos = usable(project)
  const bakery = tpl.industry === 'bakery'
  const system = [
    '你是影楼和门店 MV 的文案助手。根据照片内容写中文文案，语气温暖自然，不要用表情符号和网络烂梗。',
    `模板：${tpl.name}（${tpl.category}）。风格参考：${tpl.captions.slice(0, 3).join('、')}`,
    '每张照片写一句字幕 caption，不超过 14 个字，贴合画面内容，相邻照片不要重复句式。',
    bakery ? '照片是甜品 / 面包商品时，再写一句卖点 sellingPoint，不超过 12 个字，突出口感或用料，不要编造价格。' : '',
    '再给整支 MV 写：title（片头标题，不超过 8 个字）、subtitle（副标题，不超过 16 个字，可用英文）、ending（片尾寄语，两行，每行不超过 12 个字，用 \\n 分隔）。',
    '同时给每张照片一个 category（如 婚纱、宝宝、美食、宠物、风景、合影、人像）。',
    '输出格式：{"title":"","subtitle":"","ending":"","photos":[{"index":0,"caption":"","sellingPoint":"","category":""}]}'
  ]
    .filter(Boolean)
    .join('\n')
  const merged: CopyResult = { photos: [] }
  const batch = 12
  for (let i = 0; i < photos.length; i += batch) {
    onProgress?.(`AI 正在看第 ${i + 1}–${Math.min(photos.length, i + batch)} 张…`)
    const chunk = photos.slice(i, i + batch).map((photo, k) => ({ index: i + k, photo }))
    const res = await ask<CopyResult>('copy', system, await imageContent(chunk, `共 ${photos.length} 张，下面是第 ${i + 1} 到 ${i + chunk.length} 张。`))
    if (i === 0) Object.assign(merged, { title: res.title, subtitle: res.subtitle, ending: res.ending })
    merged.photos!.push(...(res.photos ?? []))
  }
  const byIndex = new Map(merged.photos!.map((p) => [p.index, p]))
  const updated = new Map(
    photos.map((p, i) => {
      const r = byIndex.get(i)
      return [p.id, r ? { ...p, ai: { ...p.ai, caption: clip(r.caption, 20), sellingPoint: clip(r.sellingPoint, 16), category: r.category } } : p]
    })
  )
  const next: Project = structuredClone(project)
  next.photos = next.photos.map((p) => updated.get(p.id) ?? p)
  if (merged.title) next.meta.title = clip(merged.title, 12)!
  if (merged.subtitle) next.meta.subtitle = clip(merged.subtitle, 24)!
  if (merged.ending) next.meta.ending = merged.ending.replace(/\\n/g, '\n').slice(0, 40)
  // 已有字幕位的场景换成 AI 字幕；手动改过的不动（只替换模板文案库里的句子或空字幕）
  const pm = new Map(next.photos.map((p) => [p.id, p]))
  for (const s of next.scenes) {
    if (s.kind !== 'photo') continue
    const cap = s.photos.map((id) => (id ? pm.get(id)?.ai?.caption : undefined)).find(Boolean)
    const cur = s.texts?.caption
    if (cap && (cur === undefined || cur === '' || tpl.captions.includes(cur))) s.texts = { ...s.texts, caption: cap }
  }
  return next
}

const clip = (s: string | undefined, n: number): string | undefined => (s ? [...s.trim()].slice(0, n).join('') : undefined)

// ---------------- 2. AI 推荐模板和音乐 ----------------

export interface Recommendation {
  templateId: string
  musicId: string | null
  reason: string
}

export async function aiRecommend(photos: PhotoAsset[], music: MusicTrack[]): Promise<Recommendation> {
  const list = photos.filter((p) => !p.excluded)
  const sample = list.filter((_, i) => i % Math.max(1, Math.ceil(list.length / 8)) === 0).slice(0, 8)
  const system = [
    '你是 MV 制作顾问。根据照片内容，从给定模板和音乐里各挑一个最合适的。',
    '模板列表（id：名称 / 分类 / 说明）：',
    ...TEMPLATES.map((t) => `${t.id}：${t.name} / ${t.category} / ${t.description}`),
    '音乐列表（id：名称）：',
    ...music.map((m) => `${m.id}：${m.name}`),
    '输出格式：{"templateId":"","musicId":"","reason":"一句话说明理由，不超过 40 字"}'
  ].join('\n')
  const res = await ask<Partial<Recommendation>>('recommend', system, await imageContent(sample.map((photo, index) => ({ index, photo })), `共 ${list.length} 张照片，下面是抽样的 ${sample.length} 张。`))
  const tpl = TEMPLATES.find((t) => t.id === res.templateId)
  if (!tpl) throw new Error('AI 推荐的模板不存在：' + res.templateId)
  const m = music.find((x) => x.id === res.musicId) ?? null
  return { templateId: tpl.id, musicId: m?.id ?? null, reason: res.reason ?? '' }
}

// ---------------- 3. AI 故事线排序 ----------------

export interface StoryOrder {
  order: string[] // 照片 id 的新顺序
  highlights: string[]
  reason: string
}

export async function aiStoryOrder(project: Project): Promise<StoryOrder> {
  const photos = usable(project).slice(0, 60)
  const tpl = getTemplate(project.templateId)
  const system = [
    `你是 MV 剪辑师，正在为「${tpl.name}」（${tpl.category}）模板的 MV 排列照片顺序。`,
    '按自然的故事线排序，例如婚礼：准备 → 仪式 → 外景 → 晚宴；旅行：出发 → 景点 → 美食 → 返程；门店：门店环境 → 招牌商品 → 其他商品 → 制作过程。',
    '相似场景放在一起，开头和结尾放最有代表性的画面。',
    '再挑出 3～6 张最好看、最适合放在音乐高潮处满屏展示的高光照片 highlights。',
    '输出格式：{"order":[序号...],"highlights":[序号...],"reason":"一句话说明排序思路，不超过 40 字"}，order 必须包含所有序号且不重复。'
  ].join('\n')
  const res = await ask<{ order?: number[]; highlights?: number[]; reason?: string }>(
    'order',
    system,
    await imageContent(photos.map((photo, index) => ({ index, photo })), `共 ${photos.length} 张，序号从 0 开始。`)
  )
  const seen = new Set<number>()
  const order: string[] = []
  for (const i of res.order ?? []) {
    if (Number.isInteger(i) && i >= 0 && i < photos.length && !seen.has(i)) {
      seen.add(i)
      order.push(photos[i].id)
    }
  }
  // 模型漏掉的照片按原顺序补在后面
  photos.forEach((p, i) => !seen.has(i) && order.push(p.id))
  const highlights = (res.highlights ?? []).filter((i) => photos[i]).map((i) => photos[i].id)
  return { order, highlights, reason: res.reason ?? '' }
}

/** 把排序结果应用到项目照片列表 */
export function applyStoryOrder(project: Project, s: StoryOrder): Project {
  const pos = new Map(s.order.map((id, i) => [id, i]))
  const hl = new Set(s.highlights)
  const photos = [...project.photos]
    .map((p) => ({ ...p, ai: { ...p.ai, highlight: hl.has(p.id) } }))
    .sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9))
  return { ...project, photos }
}

// ---------------- 4. AI 旁白 ----------------

export async function aiNarrationScript(project: Project): Promise<string> {
  const tpl = getTemplate(project.templateId)
  const total = projectDuration(project)
  // 中文旁白约每秒 4 个字，占整支 MV 的 60% 左右
  const chars = Math.max(20, Math.min(220, Math.round(total * 0.6 * 4)))
  const captions = project.scenes.map((s) => s.texts?.caption).filter(Boolean).slice(0, 12)
  const products = project.photos.filter((p) => p.product?.name && !p.excluded).map((p) => `${p.product!.name}${p.product!.price ? ` ${p.product!.price}元` : ''}`)
  const system = [
    '你是视频旁白撰稿人，写一段适合朗读的中文旁白。',
    `MV 主题：${project.meta.title}（${tpl.name}，${tpl.category}）。`,
    tpl.industry === 'bakery' ? `这是门店推广视频，介绍这些商品：${products.slice(0, 8).join('、')}。结尾邀请顾客到店。` : '',
    captions.length ? `画面字幕参考：${captions.join('；')}` : '',
    `长度约 ${chars} 个字，句子短，适合朗读，不要标题、不要括号说明、不要表情符号。`,
    '输出格式：{"script":"旁白全文"}'
  ]
    .filter(Boolean)
    .join('\n')
  const res = await ask<{ script?: string }>('narration', system, `请为「${project.meta.title}」写旁白。`)
  if (!res.script?.trim()) throw new Error('AI 没有生成旁白')
  return res.script.trim()
}

/** 文字转语音并挂到项目上：旁白从片头之后开始，期间背景音乐压低 */
export async function aiNarration(project: Project, script: string): Promise<Project> {
  const path = await window.mv.ai.speech(script)
  return attachVoiceover(project, path, script)
}

export async function attachVoiceover(project: Project, path: string, text?: string): Promise<Project> {
  const duration = (await window.mv.mediaDuration(path)) || 10
  const intro = project.scenes[0]
  const start = intro ? Math.min(intro.duration * 0.6, 2.5) : 0.5
  return { ...project, voiceover: { path, text, start, duration, volume: 1, duck: 0.35 } }
}
