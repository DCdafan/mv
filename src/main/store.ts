import { join } from 'path'
import { promises as fsp, existsSync } from 'fs'
import type { BrandSettings, Project, ProjectSummary, MusicTrack, AISettings, CustomTemplate } from '@shared/types'
import { safeStorage } from 'electron'
import type { AIConn } from './ai'
import { projectDuration } from '@shared/types'

export interface AppSettings {
  outputDir: string
  brand: BrandSettings
  defaultFps: number
  defaultQuality: 'standard' | 'high' | 'ultra'
  ai: AISettings
  customTemplates: CustomTemplate[]
}

/** 磁盘上的 AI 设置：Key 加密存放 */
interface StoredAI extends Omit<AISettings, 'apiKey' | 'hasKey'> {
  apiKeyEnc?: string
  apiKeyPlain?: string
}

const DEFAULT_AI: AISettings = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  ttsModel: 'tts-1',
  voice: 'alloy'
}

// 测试模式下不碰系统钥匙串，避免弹窗
const canEncrypt = (): boolean => !process.env['MV_USER_DATA'] && safeStorage.isEncryptionAvailable()

const BUILTIN_MUSIC: { file: string; name: string }[] = [
  { file: 'wedding-march.mp3', name: '婚礼进行曲 · 门德尔松' },
  { file: 'clair-de-lune.mp3', name: '月光 · 德彪西' },
  { file: 'morning.mp3', name: '晨景 · 格里格' },
  { file: 'spring.mp3', name: '四季·春 · 维瓦尔第' },
  { file: 'summer-sunday.mp3', name: '夏日星期天' },
  { file: 'apple-cider.mp3', name: '苹果汽水' },
  { file: 'happy-lullaby.mp3', name: '快乐摇篮曲' },
  { file: 'childrens-march.mp3', name: '童趣进行曲' },
  { file: 'jingle-bells.mp3', name: '铃儿响叮当 · 美国空军乐队' },
  { file: 'happy-birthday.mp3', name: '生日快乐歌' }
]

export class Store {
  readonly projectsDir: string
  readonly cacheDir: string
  private settingsPath: string
  private settings!: AppSettings

  constructor(private userData: string, private videosDir: string) {
    this.projectsDir = join(userData, 'projects')
    this.cacheDir = join(userData, 'MVMediaCache') // 不能叫 cache：macOS 不区分大小写，会和 Chromium 的 Cache 目录冲突
    this.settingsPath = join(userData, 'settings.json')
  }

  async init(): Promise<void> {
    await fsp.mkdir(this.projectsDir, { recursive: true })
    await fsp.mkdir(this.cacheDir, { recursive: true })
    const defaults: AppSettings = {
      outputDir: join(this.videosDir, '拾光MV'),
      brand: { enabled: false, studioName: '', slogan: '', phone: '', watermark: false },
      defaultFps: 30,
      defaultQuality: 'high',
      ai: DEFAULT_AI,
      customTemplates: []
    }
    try {
      const saved = JSON.parse(await fsp.readFile(this.settingsPath, 'utf8'))
      const ai = { ...DEFAULT_AI, ...(saved.ai || {}) } as AISettings & StoredAI
      ai.apiKey = this.decryptKey(ai)
      delete ai.apiKeyEnc
      delete ai.apiKeyPlain
      this.settings = { ...defaults, ...saved, brand: { ...defaults.brand, ...(saved.brand || {}) }, ai, customTemplates: saved.customTemplates || [] }
    } catch {
      this.settings = defaults
    }
    await fsp.mkdir(this.settings.outputDir, { recursive: true }).catch(() => {})
  }

  private decryptKey(ai: StoredAI): string {
    try {
      if (ai.apiKeyEnc && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(ai.apiKeyEnc, 'base64'))
    } catch {
      return ''
    }
    return ai.apiKeyPlain ?? ''
  }

  /** 给页面用的设置：不带 API Key 明文 */
  getSettings(): AppSettings {
    return { ...this.settings, ai: { ...this.settings.ai, apiKey: '', hasKey: !!this.settings.ai.apiKey } }
  }

  aiConn(): AIConn & { enabled: boolean } {
    const a = this.settings.ai
    return { enabled: a.enabled, baseUrl: a.baseUrl, apiKey: a.apiKey, model: a.model, ttsModel: a.ttsModel, voice: a.voice }
  }

  async setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const ai = { ...this.settings.ai, ...(patch.ai || {}) }
    // 页面没有传新 Key（空字符串）时保留原来的 Key
    if (!patch.ai?.apiKey) ai.apiKey = this.settings.ai.apiKey
    if (patch.ai?.apiKey === '__CLEAR__') ai.apiKey = ''
    delete ai.hasKey
    this.settings = { ...this.settings, ...patch, brand: { ...this.settings.brand, ...(patch.brand || {}) }, ai }
    const stored: StoredAI = { ...ai }
    delete (stored as Partial<AISettings>).apiKey
    if (ai.apiKey) {
      if (canEncrypt()) stored.apiKeyEnc = safeStorage.encryptString(ai.apiKey).toString('base64')
      else stored.apiKeyPlain = ai.apiKey
    }
    await fsp.writeFile(this.settingsPath, JSON.stringify({ ...this.settings, ai: stored }, null, 2))
    return this.getSettings()
  }

  builtinMusic(resources: string): MusicTrack[] {
    return BUILTIN_MUSIC.filter((m) => existsSync(join(resources, 'music', m.file))).map((m) => ({
      id: 'builtin:' + m.file,
      path: join(resources, 'music', m.file),
      name: m.name,
      builtin: true
    }))
  }

  private projectPath(id: string): string {
    if (!/^[\w-]+$/.test(id)) throw new Error('非法项目 ID')
    return join(this.projectsDir, `${id}.json`)
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const files = (await fsp.readdir(this.projectsDir)).filter((f) => f.endsWith('.json'))
    const out: ProjectSummary[] = []
    for (const f of files) {
      try {
        const p: Project = JSON.parse(await fsp.readFile(join(this.projectsDir, f), 'utf8'))
        out.push({
          id: p.id,
          name: p.name,
          updatedAt: p.updatedAt,
          templateId: p.templateId,
          aspect: p.aspect,
          photoCount: p.photos.filter((x) => !x.excluded).length,
          duration: projectDuration(p),
          cover: p.cover || p.photos.find((x) => !x.excluded)?.thumb,
          dir: this.projectsDir
        })
      } catch {
        /* 跳过损坏的项目文件 */
      }
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async loadProject(id: string): Promise<Project> {
    return JSON.parse(await fsp.readFile(this.projectPath(id), 'utf8'))
  }

  async saveProject(project: Project): Promise<void> {
    const p = this.projectPath(project.id)
    const tmp = p + '.tmp'
    await fsp.writeFile(tmp, JSON.stringify(project))
    await fsp.rename(tmp, p)
  }

  async deleteProject(id: string): Promise<void> {
    await fsp.rm(this.projectPath(id), { force: true })
  }

  async duplicateProject(id: string): Promise<string> {
    const p = await this.loadProject(id)
    const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    p.id = newId
    p.name = p.name + ' 副本'
    p.createdAt = p.updatedAt = Date.now()
    await this.saveProject(p)
    return newId
  }
}
