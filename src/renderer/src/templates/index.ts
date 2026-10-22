import type { Template, TemplateCategory } from '../engine/types'
import { weddingWhite, weddingStar, chineseRed } from './wedding'
import { kidsFun, babyDiary, travelDiary, fashion, filmMemory, graduation, minimal } from './life'

export const TEMPLATES: Template[] = [weddingWhite, weddingStar, chineseRed, minimal, fashion, kidsFun, babyDiary, travelDiary, filmMemory, graduation]

export const CATEGORIES: ('全部' | TemplateCategory)[] = ['全部', '婚纱', '中式', '写真', '儿童', '旅行', '家庭', '毕业']

const MAP = new Map(TEMPLATES.map((t) => [t.id, t]))

export function getTemplate(id: string): Template {
  return MAP.get(id) ?? TEMPLATES[0]
}
