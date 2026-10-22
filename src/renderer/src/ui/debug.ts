// 质检用：渲染某个模板每个场景的一帧，供自动化测试截图
import type { Aspect } from '@shared/types'
import { Renderer } from '../engine/renderer'
import { getTemplate } from '../templates'
import { previewProject } from './preview'
import { loadAllFonts } from '../engine/text'
import { useApp } from '../store/app'

async function sceneFrames(templateId: string, aspect: Aspect, seed = 11): Promise<string[]> {
  await loadAllFonts()
  const photos = useApp.getState().project?.photos ?? []
  const proj = previewProject(templateId, photos.length ? photos.map((p) => ({ ...p, excluded: false })) : [], aspect, seed)
  proj.photos = proj.photos.slice(0, 40)
  const c = document.createElement('canvas')
  const r = new Renderer(c, { maxTextureSize: 1024, useOriginals: false, preserveDrawingBuffer: true })
  const [w, h] = aspect === '9:16' ? [360, 640] : aspect === '1:1' ? [480, 480] : [640, 360]
  r.setSize(w, h)
  r.setProject(proj, getTemplate(templateId), { enabled: true, studioName: '拾光摄影工作室', slogan: '用心记录每一份幸福', phone: '400-888-0000', watermark: true })
  const out: string[] = []
  for (const s of proj.scenes) {
    const t = s.start + s.duration * (s.kind === 'photo' ? 0.55 : 0.85)
    await r.prepare(t, t + 0.1)
    r.render(t)
    out.push(c.toDataURL('image/jpeg', 0.85))
  }
  r.dispose()
  return out
}

;(window as unknown as { __mvDebug: unknown }).__mvDebug = { sceneFrames }
