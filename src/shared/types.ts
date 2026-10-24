// 项目数据模型：主进程、编辑器和导出渲染窗口共用

export type Aspect = '16:9' | '9:16' | '1:1' | '4:3'
export type Orientation = 'landscape' | 'portrait' | 'square'
export type Pace = 'slow' | 'normal' | 'fast'

export const ASPECT_SIZE: Record<Aspect, [number, number]> = {
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '1:1': [1440, 1440],
  '4:3': [1440, 1080]
}

export interface FaceBox {
  x: number // 0..1，相对原图
  y: number
  w: number
  h: number
  eyesClosed?: boolean
}

export type PhotoFlag = 'blur' | 'eyesClosed' | 'duplicate' | 'dark' | 'overexposed'

export interface PhotoAnalysis {
  sharpness: number // 归一化后 0..1
  brightness: number // 0..1
  faces: FaceBox[]
  hash: string // dHash 16 进制
  dupOf?: string // 与哪张照片重复（保留分数更高的那张）
  score: number // 综合评分 0..100
  focus: { x: number; y: number } // 兴趣中心 0..1
  flags: PhotoFlag[]
}

export interface PhotoAsset {
  id: string
  path: string // 原图绝对路径
  name: string
  width: number
  height: number
  orientation: Orientation
  takenAt?: number
  proxy?: string // 预览代理图绝对路径（长边 2048）
  thumb?: string // 缩略图绝对路径（长边 360）
  analysis?: PhotoAnalysis
  excluded?: boolean
  /** 商品信息（从文件名识别，如「草莓蛋糕-128.jpg」） */
  product?: { name: string; price?: string }
  /** 素材类型，默认照片 */
  media?: 'photo' | 'video'
  /** 视频时长（秒） */
  duration?: number
  /** 主体抠图蒙版（PNG，白色为人物 / 宠物），用于 3D 视差 */
  mask?: string
  maskArea?: number
  /** AI 分析结果 */
  ai?: PhotoAI
}

export interface PhotoAI {
  caption?: string // 字幕
  sellingPoint?: string // 商品卖点
  category?: string // 内容类别：婚纱、宝宝、美食、宠物……
  highlight?: boolean // 高光照片，优先放在满屏版式和副歌
}

/** 场景里自由添加的文字和贴纸 */
export interface Overlay {
  id: string
  kind: 'text' | 'sticker'
  text?: string
  decor?: string
  x: number // 中心点，相对画布 0..1
  y: number
  w: number // 宽度，相对画布宽
  rotation: number // 度
  color: string
  color2?: string
  font?: string
  size?: number // 文字大小（相对画布短边）
  anim: 'none' | 'pop' | 'fade' | 'float' | 'spin' | 'pulse' | 'drop'
}

/** 模板文字的样式覆盖 */
export interface TextOverride {
  font?: string
  color?: string
  scale?: number
}

export interface Voiceover {
  path: string
  text?: string
  start: number // 秒
  duration: number
  volume: number
  duck: number // 旁白期间背景音乐音量比例 0..1
}

export interface MusicAnalysis {
  duration: number
  bpm: number
  beats: number[] // 秒
  downbeats: number[] // 小节第一拍，秒
  energy: number[] // 每 energyStep 秒一个值，0..1
  energyStep: number
  waveform: number[] // 供界面绘制，0..1
  confidence: number // 节拍可信度 0..1
}

export interface MusicTrack {
  id: string
  path: string
  name: string
  builtin?: boolean
  analysis?: MusicAnalysis
}

export interface TransitionRef {
  name: string
  duration: number // 秒
}

export interface Scene {
  id: string
  kind: 'intro' | 'photo' | 'outro'
  styleId: string
  photos: (string | null)[] // 每个槽位的照片 id
  focus?: Record<number, { x: number; y: number }> // 手动焦点覆盖
  texts?: Record<string, string> // 文字覆盖（按图层 key）
  textStyle?: Record<string, TextOverride> // 文字样式覆盖（按图层 key）
  overlays?: Overlay[] // 自由添加的文字和贴纸
  start: number // 秒
  duration: number // 秒
  transition: TransitionRef // 进入下一场景的转场
  seed: number
}

export interface ProjectMeta {
  title: string
  subtitle: string
  date: string
  ending: string
}

export interface BrandSettings {
  enabled: boolean
  studioName: string
  slogan: string
  phone: string
  phoneLabel?: string // 「预约热线」「订购热线」
  address?: string
  logoPath?: string
  watermark: boolean
}

export interface ProjectSettings {
  pace: Pace
  durationMode: 'photos' | 'music'
  particles: boolean
  musicVolume: number
  fadeOut: number
  /** 全局滤镜 id，默认 template（使用模板调色） */
  filter?: string
  /** 卡点特效，默认 auto（跟随模板） */
  beatFx?: 'auto' | 'none' | 'pulse' | 'flash' | 'both'
  /** 人物 / 宠物 3D 视差 */
  parallax?: boolean
  /** 用户手动选了音乐起点，重新编排时保留 */
  musicOffsetLocked?: boolean
}

export interface Project {
  version: 1
  id: string
  name: string
  createdAt: number
  updatedAt: number
  templateId: string
  aspect: Aspect
  photos: PhotoAsset[]
  music: MusicTrack | null
  musicOffset: number // 从音乐的第几秒开始
  scenes: Scene[]
  meta: ProjectMeta
  settings: ProjectSettings
  seed: number
  cover?: string
  voiceover?: Voiceover | null
}

export interface ProjectSummary {
  id: string
  name: string
  updatedAt: number
  templateId: string
  aspect: Aspect
  photoCount: number
  duration: number
  cover?: string
  dir: string
}

export interface ExportOptions {
  width: number
  height: number
  fps: number
  bitrate: number // bps
  outPath: string
}

export interface ExportJob {
  id: string
  projectId: string
  projectName: string
  options: ExportOptions
  status: 'queued' | 'rendering' | 'muxing' | 'done' | 'error' | 'canceled'
  progress: number // 0..1
  error?: string
  startedAt?: number
  finishedAt?: number
  fpsActual?: number
}

export function projectDuration(p: Pick<Project, 'scenes'>): number {
  const last = p.scenes[p.scenes.length - 1]
  return last ? last.start + last.duration : 0
}

export interface AISettings {
  enabled: boolean
  baseUrl: string // OpenAI 兼容接口地址，如 https://api.openai.com/v1
  apiKey: string // 保存时加密；渲染进程拿到的是是否已设置
  hasKey?: boolean
  model: string // 视觉 / 文本模型
  ttsModel: string
  voice: string
}

/** 我的模板：在某个内置模板基础上保存的一组设置 */
export interface CustomTemplate {
  id: string
  name: string
  baseTemplateId: string
  filter?: string
  beatFx?: ProjectSettings['beatFx']
  particles?: boolean
  parallax?: boolean
  pace?: Pace
  aspect?: Aspect
  musicPath?: string
  musicName?: string
  meta?: Partial<ProjectMeta>
  createdAt: number
}
