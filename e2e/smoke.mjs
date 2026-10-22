// 端到端冒烟测试：启动真实应用，走一遍「导入 → 选模板 → 生成 → 预览 → 导出」
import { _electron as electron } from 'playwright-core'
import { mkdirSync, rmSync, existsSync, statSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, resolve } from 'path'

const ROOT = resolve('.')
const OUT = process.env.SHOTS || join(ROOT, 'e2e/shots')
const DATA = join(OUT, 'userdata')
const folder = process.argv[2] || join(ROOT, 'samples/wedding')
const templateName = process.argv[3] || '纯白誓言'
const aspect = process.argv[4] || '横屏 16:9'
rmSync(DATA, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const shot = (page, name) => page.screenshot({ path: join(OUT, name + '.png') })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// CSP 禁止 eval，waitForFunction 不可用，改为轮询页面文字
async function waitText(page, pred, timeout = 60000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const txt = await page.evaluate(() => document.body.innerText)
    if (pred(txt)) return txt
    await sleep(300)
  }
  throw new Error('等待超时')
}

const app = process.env.APP
  ? await electron.launch({ executablePath: process.env.APP, env: { ...process.env, MV_USER_DATA: DATA } })
  : await electron.launch({ args: [join(ROOT, 'out/main/index.js')], env: { ...process.env, MV_USER_DATA: DATA } })
const page = await app.firstWindow()
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[renderer]', m.type(), m.text().slice(0, 300)) })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.setViewportSize({ width: 1500, height: 940 }).catch(() => {})
await page.waitForSelector('text=新建 MV', { timeout: 20000 })
await sleep(1500)
await shot(page, '01-home')

await app.evaluate(({ dialog }, f) => {
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] })
}, folder)
await page.click('button:has-text("新建 MV")')
await page.click('button:has-text("选择文件夹")')
const t0 = Date.now()
await page.waitForSelector('text=张有问题', { timeout: 120000 }).catch(() => {})
await waitText(page, (t) => !t.includes('正在分析照片'), 120000)
console.log('导入分析用时', ((Date.now() - t0) / 1000).toFixed(1), 's')
await sleep(500)
await shot(page, '02-import')
await page.click('button:has-text("下一步")')
await sleep(2500)
await page.click(`.tpl:has-text("${templateName}")`)
await sleep(800)
await shot(page, '03-templates')
await page.click('button:has-text("下一步")')
await sleep(600)
await shot(page, '04-music')
await page.click('button:has-text("下一步")')
await page.click(`.aspect-card:has-text("${aspect}")`)
await sleep(300)
await shot(page, '05-info')
await page.click('button:has-text("一键生成 MV")')
await page.waitForSelector('.timeline', { timeout: 60000 })
await sleep(2500)
await shot(page, '06-editor')
for (const t of [3, 7, 12, 18]) {
  await page.evaluate((tt) => {
    const r = document.querySelector('.transport input[type=range]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(r, String(tt))
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, t)
  await sleep(900)
  await shot(page, `07-t${t}`)
}
// 播放 3 秒
await page.keyboard.press('Space')
await sleep(3000)
await page.keyboard.press('Space')
await shot(page, '08-played')

if (!process.env.NO_EXPORT) {
  const outFile = join(OUT, 'export.mp4')
  rmSync(outFile, { force: true })
  await app.evaluate(({ dialog }, f) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: f })
  }, outFile)
  await page.click('button:has-text("导出视频")')
  await sleep(400)
  if (process.env.RES) await page.click(`.modal .seg button:has-text("${process.env.RES}")`)
  await shot(page, '09-export-dialog')
  await page.click('button:has-text("开始导出")')
  const e0 = Date.now()
  let last = ''
  await waitText(page, (t) => {
    const m = t.match(/渲染中 \d+%[^\n]*/)
    if (m && m[0] !== last) { last = m[0] }
    return t.includes('用时') || t.includes('失败')
  }, 900000)
  console.log('最后进度', last)
  await shot(page, '10-exported')
  console.log('导出用时', ((Date.now() - e0) / 1000).toFixed(1), 's')
  if (existsSync(outFile)) {
    console.log('文件大小', (statSync(outFile).size / 1e6).toFixed(1), 'MB')
    console.log(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,duration', '-of', 'compact', outFile]).toString())
  } else console.log('导出失败：文件不存在')
}
await app.close()
