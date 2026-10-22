import { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, screen } from 'electron'
import { join, extname, normalize } from 'path'
import { pathToFileURL } from 'url'
import { promises as fsp, existsSync } from 'fs'
import { createHash } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { ExportQueue } from './exporter'
import { Store } from './store'
import { rendererUrl, resourcesDir } from './paths'

const execFileP = promisify(execFile)

// 测试时可指定独立的数据目录，避免影响真实数据
if (process.env['MV_USER_DATA']) app.setPath('userData', process.env['MV_USER_DATA'])

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mvfile',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, bypassCSP: true }
  },
  // 生产环境用 app:// 提供界面文件（file:// 下 WASM、字体的 fetch 会失败）
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
])

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.task': 'application/octet-stream'
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.heic', '.heif'])
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac'])

let mainWindow: BrowserWindow | null = null
let store: Store
let exportQueue: ExportQueue


function createMainWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  mainWindow = new BrowserWindow({
    width: Math.min(1600, width),
    height: Math.min(1000, height),
    minWidth: 1200,
    minHeight: 760,
    show: false,
    backgroundColor: '#15161a',
    title: '拾光MV',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.loadURL(rendererUrl('index'))
  mainWindow.on('closed', () => (mainWindow = null))
}

async function walkImages(dir: string, out: string[], depth = 0): Promise<void> {
  if (depth > 4) return
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) await walkImages(p, out, depth + 1)
    else if (IMAGE_EXT.has(extname(e.name).toLowerCase())) out.push(p)
  }
}

/** 浏览器无法解码 HEIC：macOS 上用系统自带的 sips 转成 JPEG */
async function normalizeImagePaths(paths: string[]): Promise<string[]> {
  const out: string[] = []
  for (const p of paths) {
    const ext = extname(p).toLowerCase()
    if ((ext === '.heic' || ext === '.heif') && process.platform === 'darwin') {
      const st = await fsp.stat(p)
      const key = createHash('md5').update(p + st.mtimeMs + st.size).digest('hex')
      const dst = join(store.cacheDir, `heic-${key}.jpg`)
      if (!existsSync(dst)) {
        try {
          await execFileP('sips', ['-s', 'format', 'jpeg', p, '--out', dst])
        } catch {
          continue
        }
      }
      out.push(dst)
    } else if (ext !== '.heic' && ext !== '.heif') out.push(p)
  }
  return out
}

function registerIpc(): void {
  ipcMain.handle('dialog:openPhotos', async (_e, mode: 'files' | 'folder') => {
    const r = await dialog.showOpenDialog(mainWindow!, {
      title: mode === 'folder' ? '选择照片文件夹' : '选择照片',
      properties: mode === 'folder' ? ['openDirectory'] : ['openFile', 'multiSelections'],
      filters: mode === 'files' ? [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'heic'] }] : undefined
    })
    if (r.canceled) return []
    const files: string[] = []
    for (const p of r.filePaths) {
      const st = await fsp.stat(p)
      if (st.isDirectory()) await walkImages(p, files)
      else files.push(p)
    }
    return normalizeImagePaths(files)
  })

  ipcMain.handle('fs:expandDropped', async (_e, paths: string[]) => {
    const files: string[] = []
    for (const p of paths) {
      try {
        const st = await fsp.stat(p)
        if (st.isDirectory()) await walkImages(p, files)
        else if (IMAGE_EXT.has(extname(p).toLowerCase())) files.push(p)
      } catch {
        /* 忽略无法读取的路径 */
      }
    }
    return normalizeImagePaths(files)
  })

  ipcMain.handle('dialog:openMusic', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, {
      title: '选择音乐',
      properties: ['openFile'],
      filters: [{ name: '音频', extensions: [...AUDIO_EXT].map((e) => e.slice(1)) }]
    })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('dialog:openImage', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, {
      title: '选择图片',
      properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('dialog:openFolder', async (_e, title?: string) => {
    const r = await dialog.showOpenDialog(mainWindow!, { title: title || '选择文件夹', properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('dialog:saveVideo', async (_e, defaultName: string) => {
    const s = store.getSettings()
    const r = await dialog.showSaveDialog(mainWindow!, {
      title: '导出视频',
      defaultPath: join(s.outputDir, defaultName),
      filters: [{ name: 'MP4 视频', extensions: ['mp4'] }]
    })
    return r.canceled ? null : r.filePath
  })

  /** 批量出片：列出根目录下每个子文件夹及其照片数 */
  ipcMain.handle('fs:listClientFolders', async (_e, root: string) => {
    const entries = await fsp.readdir(root, { withFileTypes: true })
    const result: { name: string; path: string; photos: string[] }[] = []
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue
      const p = join(root, e.name)
      const files: string[] = []
      await walkImages(p, files)
      if (files.length) result.push({ name: e.name, path: p, photos: await normalizeImagePaths(files) })
    }
    result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
    return result
  })

  ipcMain.handle('cache:write', async (_e, name: string, data: ArrayBuffer) => {
    const p = join(store.cacheDir, name)
    await fsp.writeFile(p, Buffer.from(data))
    return p
  })
  ipcMain.handle('cache:exists', async (_e, name: string) => {
    const p = join(store.cacheDir, name)
    return existsSync(p) ? p : null
  })
  ipcMain.handle('fs:stat', async (_e, p: string) => {
    const st = await fsp.stat(p)
    return { size: st.size, mtimeMs: st.mtimeMs, birthtimeMs: st.birthtimeMs }
  })
  ipcMain.handle('fs:exists', async (_e, p: string) => existsSync(p))

  ipcMain.handle('music:builtin', async () => store.builtinMusic(resourcesDir()))

  ipcMain.handle('project:list', async () => store.listProjects())
  ipcMain.handle('project:load', async (_e, id: string) => store.loadProject(id))
  ipcMain.handle('project:save', async (_e, project) => store.saveProject(project))
  ipcMain.handle('project:delete', async (_e, id: string) => store.deleteProject(id))
  ipcMain.handle('project:duplicate', async (_e, id: string) => store.duplicateProject(id))

  ipcMain.handle('settings:get', async () => store.getSettings())
  ipcMain.handle('settings:set', async (_e, patch) => store.setSettings(patch))

  ipcMain.handle('export:enqueue', async (_e, payload) => exportQueue.enqueue(payload))
  ipcMain.handle('export:cancel', async (_e, id: string) => exportQueue.cancel(id))
  ipcMain.handle('export:list', async () => exportQueue.list())
  ipcMain.handle('export:clearFinished', async () => exportQueue.clearFinished())

  ipcMain.handle('shell:reveal', async (_e, p: string) => shell.showItemInFolder(p))
  ipcMain.handle('shell:open', async (_e, p: string) => shell.openPath(p))
  ipcMain.handle('app:info', async () => ({
    version: app.getVersion(),
    platform: process.platform,
    userData: app.getPath('userData'),
    ffmpeg: exportQueue.ffmpegPath()
  }))
}

app.whenReady().then(async () => {
  store = new Store(app.getPath('userData'), app.getPath('videos'))
  await store.init()
  exportQueue = new ExportQueue(store, () => mainWindow)

  // mvfile://local/<encodeURIComponent(绝对路径)>
  protocol.handle('mvfile', async (req) => {
    const u = new URL(req.url)
    const filePath = decodeURIComponent(u.pathname.slice(1))
    try {
      const res = await net.fetch(pathToFileURL(filePath).toString())
      const headers = new Headers(res.headers)
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Cache-Control', 'max-age=3600')
      return new Response(res.body, { status: res.status, headers })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })

  const rendererDir = join(__dirname, '../renderer')
  protocol.handle('app', async (req) => {
    const u = new URL(req.url)
    const file = normalize(join(rendererDir, decodeURIComponent(u.pathname)))
    if (!file.startsWith(rendererDir)) return new Response('forbidden', { status: 403 })
    try {
      const data = await fsp.readFile(file)
      return new Response(data, { headers: { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' } })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })

  registerIpc()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

