import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

export const isDev = !app.isPackaged && !!process.env['ELECTRON_RENDERER_URL']

export function rendererUrl(page: 'index' | 'render'): string {
  if (isDev) return `${process.env['ELECTRON_RENDERER_URL']}/${page}.html`
  return `app://renderer/${page}.html`
}

export function resourcesDir(): string {
  if (app.isPackaged) return process.resourcesPath
  const candidates = [join(app.getAppPath(), 'resources'), join(__dirname, '../../resources'), join(process.cwd(), 'resources')]
  return candidates.find((c) => existsSync(join(c, 'music'))) ?? candidates[0]
}
