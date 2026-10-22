// 批量出片端到端测试：samples 下每个子文件夹当作一位客户
import { _electron as electron } from 'playwright-core'
import { rmSync, mkdirSync, readdirSync, statSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, resolve } from 'path'
const ROOT = resolve('.')
const DATA = join(ROOT, 'e2e/batch-data')
const OUTDIR = join(ROOT, 'e2e/batch-out')
rmSync(DATA, { recursive: true, force: true }); rmSync(OUTDIR, { recursive: true, force: true }); mkdirSync(OUTDIR)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const app = await electron.launch({ args: [join(ROOT, 'out/main/index.js')], env: { ...process.env, MV_USER_DATA: DATA } })
const page = await app.firstWindow()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.waitForSelector('text=批量出片')
let n = 0
await app.evaluate(({ dialog }, [root, out]) => {
  let k = 0
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [k++ === 0 ? root : out] })
}, [join(ROOT, 'samples'), OUTDIR])
await page.click('.hero button:has-text("批量出片")')
await page.click('button:has-text("选择客户总目录")')
await sleep(800)
await page.click('.seg button:has-text("720p")')
await page.click('.panel.right .field button:text-is("选择")')
await sleep(300)
await page.screenshot({ path: join(ROOT, 'e2e/shots/20-batch.png') })
const t0 = Date.now()
await page.click('button:has-text("开始批量出片")')
while (Date.now() - t0 < 900000) {
  const txt = await page.evaluate(() => document.body.innerText)
  n = (txt.match(/已导出/g) || []).length
  if (n >= 4 || txt.includes('导出失败')) break
  await sleep(1000)
}
await page.screenshot({ path: join(ROOT, 'e2e/shots/21-batch-done.png') })
console.log('用时', ((Date.now() - t0) / 1000).toFixed(0), 's，已导出', n)
for (const f of readdirSync(OUTDIR)) {
  const p = join(OUTDIR, f)
  const d = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).toString().trim()
  console.log(f, (statSync(p).size / 1e6).toFixed(1) + 'MB', d + 's')
}
await app.close()
