import { create } from 'zustand'
import type { Aspect, ExportJob, MusicTrack, Pace, PhotoAsset, Project, ProjectSummary, Scene } from '@shared/types'
import type { AppSettings } from '../../../preload/index'
import { arrange, retime } from '../arrange/arranger'
import { getTemplate } from '../templates'
import { analyzeMusic } from '../analysis/music'

export type View = 'home' | 'editor' | 'batch'

interface Toast {
  id: number
  text: string
  kind: 'info' | 'success' | 'error'
}

interface AppState {
  view: View
  settings: AppSettings | null
  builtinMusic: MusicTrack[]
  projects: ProjectSummary[]
  project: Project | null
  past: Project[]
  future: Project[]
  selectedSceneId: string | null
  exports: ExportJob[]
  showExports: boolean
  toasts: Toast[]
  wizardOpen: boolean
  setView: (v: View) => void
  init: () => Promise<void>
  refreshProjects: () => Promise<void>
  openProject: (id: string) => Promise<void>
  closeProject: () => void
  setProject: (p: Project) => void
  /** 修改项目并记入撤销栈 */
  commit: (fn: (p: Project) => Project, opts?: { merge?: string }) => void
  undo: () => void
  redo: () => void
  selectScene: (id: string | null) => void
  toast: (text: string, kind?: Toast['kind']) => void
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>
  setWizardOpen: (v: boolean) => void
  setShowExports: (v: boolean) => void
}

let lastMergeKey: string | null = null
let lastMergeAt = 0
let saveTimer: ReturnType<typeof setTimeout> | null = null
let toastSeq = 0

export const useApp = create<AppState>((set, get) => ({
  view: 'home',
  settings: null,
  builtinMusic: [],
  projects: [],
  project: null,
  past: [],
  future: [],
  selectedSceneId: null,
  exports: [],
  showExports: false,
  toasts: [],
  wizardOpen: false,

  setView: (view) => set({ view }),

  init: async () => {
    const [settings, builtinMusic, projects, exports] = await Promise.all([
      window.mv.getSettings(),
      window.mv.builtinMusic(),
      window.mv.listProjects(),
      window.mv.listExports()
    ])
    set({ settings, builtinMusic, projects, exports })
    window.mv.onExportUpdate((jobs) => {
      const prev = get().exports
      for (const j of jobs) {
        const old = prev.find((p) => p.id === j.id)
        if (old && old.status !== j.status) {
          if (j.status === 'done') get().toast(`「${j.projectName}」导出完成`, 'success')
          if (j.status === 'error') get().toast(`「${j.projectName}」导出失败：${j.error}`, 'error')
        }
      }
      set({ exports: jobs })
    })
  },

  refreshProjects: async () => set({ projects: await window.mv.listProjects() }),

  openProject: async (id) => {
    const p = await window.mv.loadProject(id)
    set({ project: p, past: [], future: [], selectedSceneId: null, view: 'editor' })
  },

  closeProject: () => {
    const p = get().project
    if (p) window.mv.saveProject(p)
    set({ project: null, view: 'home', past: [], future: [], selectedSceneId: null })
    get().refreshProjects()
  },

  setProject: (p) => {
    set({ project: p })
    scheduleSave(p)
  },

  commit: (fn, opts) => {
    const cur = get().project
    if (!cur) return
    const next = { ...fn(structuredClone(cur)), updatedAt: Date.now() }
    const now = Date.now()
    // 连续的同类修改（例如拖动滑块、打字）合并成一步撤销
    const merge = opts?.merge && opts.merge === lastMergeKey && now - lastMergeAt < 1500
    lastMergeKey = opts?.merge ?? null
    lastMergeAt = now
    set((s) => ({
      project: next,
      past: merge ? s.past : [...s.past.slice(-80), cur],
      future: []
    }))
    scheduleSave(next)
  },

  undo: () => {
    const { past, project, future } = get()
    if (!past.length || !project) return
    const prev = past[past.length - 1]
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future] })
    scheduleSave(prev)
  },

  redo: () => {
    const { past, project, future } = get()
    if (!future.length || !project) return
    const next = future[0]
    set({ project: next, past: [...past, project], future: future.slice(1) })
    scheduleSave(next)
  },

  selectScene: (id) => set({ selectedSceneId: id }),

  toast: (text, kind = 'info') => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 6000 : 3200)
  },

  saveSettings: async (patch) => {
    const settings = await window.mv.setSettings(patch)
    set({ settings })
  },

  setWizardOpen: (v) => set({ wizardOpen: v }),
  setShowExports: (v) => set({ showExports: v })
}))

function scheduleSave(p: Project): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    window.mv.saveProject(p).catch((e) => console.error('保存失败', e))
  }, 600)
}

// ---------------- 播放状态（高频更新，单独一个 store） ----------------

interface PlaybackState {
  time: number
  playing: boolean
  setTime: (t: number) => void
  setPlaying: (v: boolean) => void
}

export const usePlayback = create<PlaybackState>((set) => ({
  time: 0,
  playing: false,
  setTime: (time) => set({ time }),
  setPlaying: (playing) => set({ playing })
}))

// ---------------- 项目操作 ----------------

export function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export interface NewProjectInput {
  name: string
  photos: PhotoAsset[]
  templateId: string
  music: MusicTrack | null
  aspect: Aspect
  pace: Pace
  durationMode: 'photos' | 'music'
  meta: Project['meta']
}

export async function createProject(input: NewProjectInput): Promise<Project> {
  const tpl = getTemplate(input.templateId)
  let music = input.music
  if (music && !music.analysis) music = { ...music, analysis: await analyzeMusic(music.path) }
  const seed = Math.floor(Math.random() * 1e9)
  const { scenes, musicOffset } = arrange({
    photos: input.photos,
    template: tpl,
    aspect: input.aspect,
    music: music?.analysis ?? null,
    pace: input.pace,
    durationMode: input.durationMode,
    seed
  })
  const now = Date.now()
  return {
    version: 1,
    id: now.toString(36) + Math.random().toString(36).slice(2, 6),
    name: input.name,
    createdAt: now,
    updatedAt: now,
    templateId: tpl.id,
    aspect: input.aspect,
    photos: input.photos,
    music,
    musicOffset,
    scenes,
    meta: input.meta,
    settings: { pace: input.pace, durationMode: input.durationMode, particles: true, musicVolume: 1, fadeOut: 3 },
    seed
  }
}

/** 用当前设置重新编排（换模板 / 换音乐 / 换画幅 / 换一换） */
export async function rearrange(p: Project, patch: Partial<Pick<Project, 'templateId' | 'aspect' | 'music' | 'seed'>> & { pace?: Pace; durationMode?: 'photos' | 'music' } = {}): Promise<Project> {
  const next: Project = structuredClone(p)
  if (patch.templateId) {
    const oldTpl = getTemplate(p.templateId)
    const newTpl = getTemplate(patch.templateId)
    next.templateId = patch.templateId
    // 文案还是旧模板默认值时，换成新模板的默认文案
    if (next.meta.title === oldTpl.defaults.title) next.meta.title = newTpl.defaults.title
    if (next.meta.subtitle === oldTpl.defaults.subtitle) next.meta.subtitle = newTpl.defaults.subtitle
    if (next.meta.ending === oldTpl.defaults.ending) next.meta.ending = newTpl.defaults.ending
  }
  if (patch.aspect) next.aspect = patch.aspect
  if (patch.music !== undefined) next.music = patch.music
  if (patch.seed !== undefined) next.seed = patch.seed
  if (patch.pace) next.settings.pace = patch.pace
  if (patch.durationMode) next.settings.durationMode = patch.durationMode
  if (next.music && !next.music.analysis) next.music = { ...next.music, analysis: await analyzeMusic(next.music.path) }
  const { scenes, musicOffset } = arrange({
    photos: next.photos,
    template: getTemplate(next.templateId),
    aspect: next.aspect,
    music: next.music?.analysis ?? null,
    pace: next.settings.pace,
    durationMode: next.settings.durationMode,
    seed: next.seed
  })
  next.scenes = scenes
  next.musicOffset = musicOffset
  return next
}

export function updateScene(p: Project, id: string, fn: (s: Scene) => Scene): Project {
  return { ...p, scenes: retime(p.scenes.map((s) => (s.id === id ? fn(s) : s))) }
}
