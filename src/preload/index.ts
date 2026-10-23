import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ExportJob, MusicTrack, Project, ProjectSummary, BrandSettings, ExportOptions } from '@shared/types'

export interface AppSettings {
  outputDir: string
  brand: BrandSettings
  defaultFps: number
  defaultQuality: 'standard' | 'high' | 'ultra'
}

export interface RenderJobPayload {
  id: string
  project: Project
  brand: BrandSettings | null
  options: ExportOptions
}

const api = {
  openPhotos: (mode: 'files' | 'folder'): Promise<string[]> => ipcRenderer.invoke('dialog:openPhotos', mode),
  expandDropped: (paths: string[]): Promise<string[]> => ipcRenderer.invoke('fs:expandDropped', paths),
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  openMusic: (): Promise<string | null> => ipcRenderer.invoke('dialog:openMusic'),
  openImage: (): Promise<string | null> => ipcRenderer.invoke('dialog:openImage'),
  openFolder: (title?: string): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder', title),
  saveVideo: (name: string): Promise<string | null> => ipcRenderer.invoke('dialog:saveVideo', name),
  saveImage: (name: string, data: ArrayBuffer): Promise<string | null> => ipcRenderer.invoke('dialog:saveImage', name, data),
  listClientFolders: (root: string): Promise<{ name: string; path: string; photos: string[] }[]> =>
    ipcRenderer.invoke('fs:listClientFolders', root),
  cacheWrite: (name: string, data: ArrayBuffer): Promise<string> => ipcRenderer.invoke('cache:write', name, data),
  cacheExists: (name: string): Promise<string | null> => ipcRenderer.invoke('cache:exists', name),
  stat: (p: string): Promise<{ size: number; mtimeMs: number; birthtimeMs: number }> => ipcRenderer.invoke('fs:stat', p),
  exists: (p: string): Promise<boolean> => ipcRenderer.invoke('fs:exists', p),
  builtinMusic: (): Promise<MusicTrack[]> => ipcRenderer.invoke('music:builtin'),

  listProjects: (): Promise<ProjectSummary[]> => ipcRenderer.invoke('project:list'),
  loadProject: (id: string): Promise<Project> => ipcRenderer.invoke('project:load', id),
  saveProject: (p: Project): Promise<void> => ipcRenderer.invoke('project:save', p),
  deleteProject: (id: string): Promise<void> => ipcRenderer.invoke('project:delete', id),
  duplicateProject: (id: string): Promise<string> => ipcRenderer.invoke('project:duplicate', id),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:set', patch),

  enqueueExport: (payload: { project: Project; brand: BrandSettings | null; options: ExportOptions }): Promise<ExportJob> =>
    ipcRenderer.invoke('export:enqueue', payload),
  cancelExport: (id: string): Promise<void> => ipcRenderer.invoke('export:cancel', id),
  listExports: (): Promise<ExportJob[]> => ipcRenderer.invoke('export:list'),
  clearFinishedExports: (): Promise<ExportJob[]> => ipcRenderer.invoke('export:clearFinished'),
  onExportUpdate: (cb: (jobs: ExportJob[]) => void): (() => void) => {
    const h = (_e: unknown, jobs: ExportJob[]): void => cb(jobs)
    ipcRenderer.on('export:update', h)
    return () => ipcRenderer.removeListener('export:update', h)
  },

  reveal: (p: string): Promise<void> => ipcRenderer.invoke('shell:reveal', p),
  openPath: (p: string): Promise<void> => ipcRenderer.invoke('shell:open', p),
  appInfo: (): Promise<{ version: string; platform: string; userData: string; ffmpeg: string }> => ipcRenderer.invoke('app:info'),

  // 导出渲染窗口专用
  render: {
    getJob: (id: string): Promise<RenderJobPayload | null> => ipcRenderer.invoke('render:getJob', id),
    chunk: (id: string, position: number, data: Uint8Array): Promise<void> => ipcRenderer.invoke('render:chunk', id, position, data),
    progress: (id: string, progress: number, fps: number): void => ipcRenderer.send('render:progress', id, progress, fps),
    finished: (id: string): void => ipcRenderer.send('render:finished', id),
    error: (id: string, message: string): void => ipcRenderer.send('render:error', id, message)
  }
}

export type MvApi = typeof api

contextBridge.exposeInMainWorld('mv', api)
