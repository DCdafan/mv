// 精华版：从完整项目里挑高光照片，配上音乐副歌，生成 15 秒左右的短视频（发抖音、视频号）
import type { Aspect, Project } from '@shared/types'
import { projectDuration } from '@shared/types'
import { arrange, findChorus, retime, carryEdits } from './arranger'
import { getTemplate } from '../templates'

export interface ShortOptions {
  seconds: number
  aspect: Aspect
}

export function makeShortVersion(project: Project, opt: ShortOptions): Project {
  const tpl = getTemplate(project.templateId)
  const usable = project.photos.filter((p) => !p.excluded)
  // 片头约 3.6 秒、片尾约 4.5 秒，中间每张约 1.8 秒
  const n = Math.max(3, Math.min(8, Math.round((opt.seconds - 7) / 1.8)))
  const rank = (p: (typeof usable)[number]): number => (p.ai?.highlight ? 1000 : 0) + (p.analysis?.score ?? 50) - (p.media === 'video' ? 5 : 0)
  const chosen = new Set([...usable].sort((a, b) => rank(b) - rank(a)).slice(0, n).map((p) => p.id))
  // 保持原来的先后顺序
  const photos = usable.filter((p) => chosen.has(p.id))
  const music = project.music?.analysis ?? null
  const offset = music ? Math.max(0, findChorus(music, opt.seconds) - 3.5) : undefined
  const { scenes, musicOffset } = arrange({
    photos,
    template: tpl,
    aspect: opt.aspect,
    music,
    pace: 'fast',
    durationMode: 'photos',
    seed: project.seed + 1,
    musicOffset: offset
  })
  // 超出目标时长时从后往前去掉正片场景（保留片头片尾）
  let list = scenes
  while (projectDuration({ scenes: list }) > opt.seconds + 1.5 && list.filter((s) => s.kind === 'photo').length > 2) {
    const lastPhoto = list.map((s) => s.kind).lastIndexOf('photo')
    list = retime(list.filter((_, i) => i !== lastPhoto))
  }
  return {
    ...structuredClone(project),
    id: project.id + '-short',
    name: project.name + ' 精华版',
    aspect: opt.aspect,
    scenes: carryEdits(project.scenes, list, false),
    musicOffset,
    voiceover: null,
    settings: { ...project.settings, pace: 'fast', fadeOut: Math.min(project.settings.fadeOut, 2) }
  }
}
