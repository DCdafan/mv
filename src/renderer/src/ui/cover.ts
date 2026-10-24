// 按成片分辨率渲染某一帧为 PNG（封面图）
import type { BrandSettings, Project } from '@shared/types'
import { ASPECT_SIZE } from '@shared/types'
import { Renderer } from '../engine/renderer'
import { getTemplate } from '../templates'
import { loadAllFonts } from '../engine/text'

export async function renderCover(project: Project, brand: BrandSettings | null, t: number): Promise<Blob> {
  const [w, h] = ASPECT_SIZE[project.aspect]
  const canvas = document.createElement('canvas')
  const r = new Renderer(canvas, { maxTextureSize: 4096, useOriginals: true, preserveDrawingBuffer: true, exact: true })
  try {
    r.setSize(w, h)
    r.setProject(project, getTemplate(project.templateId), brand)
    await loadAllFonts()
    const tt = Math.max(0.7, t)
    await r.prepareExact(tt, 30)
    r.render(tt)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (!blob) throw new Error('生成图片失败')
    return blob
  } finally {
    r.dispose()
  }
}

/** 封面默认取片头标题完全出现的时刻 */
export function defaultCoverTime(project: Project): number {
  const s = project.scenes[0]
  return s ? Math.min(s.duration * 0.75, 3) : 1
}
