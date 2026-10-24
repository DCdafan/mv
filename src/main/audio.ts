import { existsSync } from 'fs'
import type { Project } from '@shared/types'
import { projectDuration } from '@shared/types'

/**
 * 生成 FFmpeg 的音频输入与滤镜参数：
 *  - 背景音乐：截取、淡入淡出、音量；超过音乐长度时循环
 *  - 旁白：按开始时间延迟；旁白期间背景音乐自动压低（ducking）
 * 第 0 路输入是已渲染好的视频
 */
export function buildAudioArgs(project: Project): string[] {
  const duration = projectDuration(project)
  const args: string[] = []
  const filters: string[] = []
  let idx = 1
  let musicLabel = ''
  if (project.music && existsSync(project.music.path)) {
    const musicDur = project.music.analysis?.duration ?? 0
    if (musicDur > 0 && project.musicOffset + duration > musicDur) args.push('-stream_loop', '-1')
    args.push('-i', project.music.path)
    const fade = Math.min(project.settings.fadeOut, duration / 3)
    filters.push(
      `[${idx}:a]atrim=start=${project.musicOffset.toFixed(3)}:duration=${duration.toFixed(3)},asetpts=PTS-STARTPTS,` +
        `afade=t=in:st=0:d=0.4,afade=t=out:st=${Math.max(0, duration - fade).toFixed(3)}:d=${fade.toFixed(3)},volume=${project.settings.musicVolume}[m0]`
    )
    musicLabel = 'm0'
    idx++
  }
  const vo = project.voiceover
  let voiceLabel = ''
  if (vo && existsSync(vo.path) && vo.start < duration) {
    args.push('-i', vo.path)
    const ms = Math.round(vo.start * 1000)
    filters.push(`[${idx}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms},volume=${vo.volume}[v0]`)
    voiceLabel = 'v0'
    idx++
    if (musicLabel) {
      const s0 = vo.start.toFixed(3)
      const e0 = Math.min(duration, vo.start + vo.duration).toFixed(3)
      filters.push(`[${musicLabel}]volume=${vo.duck}:enable='between(t,${s0},${e0})'[m1]`)
      musicLabel = 'm1'
    }
  }
  if (!musicLabel && !voiceLabel) return ['-map', '0:v']
  if (musicLabel && voiceLabel) filters.push(`[${musicLabel}][${voiceLabel}]amix=inputs=2:duration=first:normalize=0[a]`)
  else if (musicLabel) filters.push(`[${musicLabel}]anull[a]`)
  else filters.push(`[${voiceLabel}]apad,atrim=duration=${duration.toFixed(3)}[a]`)
  args.push('-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k')
  return args
}
