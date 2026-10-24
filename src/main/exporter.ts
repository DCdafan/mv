import { BrowserWindow, ipcMain, Notification } from 'electron'
import { join } from 'path'
import { promises as fsp, existsSync, openSync, writeSync, closeSync } from 'fs'
import { spawn } from 'child_process'
import type { BrandSettings, ExportJob, ExportOptions, Project } from '@shared/types'
import { projectDuration } from '@shared/types'
import type { Store } from './store'
import { buildAudioArgs } from './audio'
import { rendererUrl } from './paths'

export interface ExportPayload {
  project: Project
  brand: BrandSettings | null
  options: ExportOptions
}

interface Running {
  job: ExportJob
  payload: ExportPayload
  win?: BrowserWindow
  fd?: number
  tmpVideo: string
}

function resolveFfmpeg(): string {
  const candidates: string[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p: string = require('ffmpeg-static')
    if (p) candidates.push(p.replace('app.asar', 'app.asar.unpacked'))
  } catch {
    /* 没装 ffmpeg-static 时退回系统 ffmpeg */
  }
  candidates.push('/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg')
  return candidates.find((c) => existsSync(c)) || 'ffmpeg'
}

export class ExportQueue {
  private jobs: ExportJob[] = []
  private payloads = new Map<string, ExportPayload>()
  private current: Running | null = null
  private ffmpeg = resolveFfmpeg()

  constructor(private store: Store, private getMainWindow: () => BrowserWindow | null) {
    ipcMain.handle('render:getJob', (_e, id: string) => {
      const payload = this.payloads.get(id)
      return payload ? { id, ...payload } : null
    })
    ipcMain.handle('render:chunk', (_e, id: string, position: number, data: Uint8Array) => {
      const r = this.current
      if (!r || r.job.id !== id || r.fd === undefined) return
      const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
      writeSync(r.fd, buf, 0, buf.length, position)
    })
    ipcMain.on('render:progress', (_e, id: string, progress: number, fps: number) => {
      const r = this.current
      if (!r || r.job.id !== id) return
      r.job.progress = progress * 0.97
      r.job.fpsActual = fps
      this.emit()
    })
    ipcMain.on('render:finished', (_e, id: string) => {
      if (this.current?.job.id === id) this.finishRender().catch((err) => this.fail(String(err?.message || err)))
    })
    ipcMain.on('render:error', (_e, id: string, message: string) => {
      if (this.current?.job.id === id) this.fail(message)
    })
  }

  ffmpegPath(): string {
    return this.ffmpeg
  }

  list(): ExportJob[] {
    return this.jobs
  }

  enqueue(payload: ExportPayload): ExportJob {
    const job: ExportJob = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      projectId: payload.project.id,
      projectName: payload.project.name,
      options: payload.options,
      status: 'queued',
      progress: 0
    }
    this.jobs.push(job)
    this.payloads.set(job.id, payload)
    this.emit()
    this.pump()
    return job
  }

  cancel(id: string): void {
    const job = this.jobs.find((j) => j.id === id)
    if (!job) return
    if (this.current?.job.id === id) {
      this.cleanup(true)
      job.status = 'canceled'
      this.current = null
      this.emit()
      this.pump()
      return
    }
    if (job.status === 'queued') {
      job.status = 'canceled'
      this.emit()
    }
  }

  clearFinished(): ExportJob[] {
    this.jobs = this.jobs.filter((j) => j.status === 'queued' || j.status === 'rendering' || j.status === 'muxing')
    this.emit()
    return this.jobs
  }

  private emit(): void {
    this.getMainWindow()?.webContents.send('export:update', this.jobs)
  }

  private pump(): void {
    if (this.current) return
    const job = this.jobs.find((j) => j.status === 'queued')
    if (!job) return
    const payload = this.payloads.get(job.id)!
    const tmpVideo = join(this.store.cacheDir, `export-${job.id}.mp4`)
    job.status = 'rendering'
    job.startedAt = Date.now()
    const fd = openSync(tmpVideo, 'w')
    const win = new BrowserWindow({
      show: false,
      width: 640,
      height: 360,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        backgroundThrottling: false
      }
    })
    this.current = { job, payload, win, fd, tmpVideo }
    win.webContents.on('render-process-gone', (_e, d) => this.fail('渲染进程异常退出：' + d.reason))
    win.loadURL(`${rendererUrl('render')}?job=${job.id}`)
    this.emit()
  }

  private async finishRender(): Promise<void> {
    const r = this.current!
    if (r.fd !== undefined) closeSync(r.fd)
    r.fd = undefined
    r.win?.destroy()
    r.win = undefined
    r.job.status = 'muxing'
    this.emit()
    await this.mux(r)
    await fsp.rm(r.tmpVideo, { force: true })
    r.job.status = 'done'
    r.job.progress = 1
    r.job.finishedAt = Date.now()
    this.payloads.delete(r.job.id)
    this.current = null
    this.emit()
    if (Notification.isSupported()) {
      new Notification({ title: '导出完成', body: `${r.job.projectName} 已导出` }).show()
    }
    this.pump()
  }

  private mux(r: Running): Promise<void> {
    const { project, options } = r.payload
    const args = ['-y', '-v', 'error', '-i', r.tmpVideo]
    args.push(...buildAudioArgs(project))
    args.push('-c:v', 'copy', '-t', projectDuration(project).toFixed(3), '-movflags', '+faststart', options.outPath)
    return new Promise((resolve, reject) => {
      fsp
        .mkdir(join(options.outPath, '..'), { recursive: true })
        .catch(() => {})
        .then(() => {
          const p = spawn(this.ffmpeg, args)
          let err = ''
          p.stderr.on('data', (d) => (err += d.toString()))
          p.on('error', (e) => reject(new Error('无法启动 FFmpeg：' + e.message)))
          p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('音频合成失败：' + err.slice(-400)))))
        })
    })
  }

  private cleanup(removeTmp: boolean): void {
    const r = this.current
    if (!r) return
    if (r.fd !== undefined) {
      try {
        closeSync(r.fd)
      } catch {
        /* 已关闭 */
      }
      r.fd = undefined
    }
    r.win?.destroy()
    r.win = undefined
    if (removeTmp) fsp.rm(r.tmpVideo, { force: true }).catch(() => {})
  }

  private fail(message: string): void {
    const r = this.current
    if (!r) return
    this.cleanup(true)
    r.job.status = 'error'
    r.job.error = message
    r.job.finishedAt = Date.now()
    this.current = null
    this.emit()
    this.pump()
  }
}

