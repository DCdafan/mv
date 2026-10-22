// 模板质检：加载一个项目的照片，渲染每个模板每个场景的一帧，拼成总览图
import { _electron as electron } from 'playwright-core'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, resolve } from 'path'
const ROOT = resolve('.')
const OUT = join(ROOT, 'e2e/gallery')
const DATA = process.env.DATA || join(ROOT, 'e2e/shots/userdata') // 复用 smoke 测试生成的项目
mkdirSync(OUT, { recursive: true })
const aspects = (process.argv[2] || '16:9,9:16').split(',')
const only = process.argv[3]
const app = await electron.launch({ args: [join(ROOT, 'out/main/index.js')], env: { ...process.env, MV_USER_DATA: DATA } })
const page = await app.firstWindow()
page.on('pageerror', (e) => console.log('[pageerror]', e.message)); page.on('console', (m) => (m.type() === 'warning' || m.type() === 'error') && !m.text().includes('W1022') && console.log('[console]', m.text().slice(0, 300)))
await page.waitForSelector('.proj', { timeout: 20000 })
await page.click('.proj')
await page.waitForSelector('.timeline')
const ids = ['wedding-white', 'wedding-star', 'chinese-red', 'minimal', 'fashion', 'kids-fun', 'baby-diary', 'travel-diary', 'film-memory', 'graduation', 'bakery-sweet', 'bakery-promo', 'bakery-tea'].filter((x) => !only || only.split(',').includes(x))
for (const aspect of aspects) {
  for (const id of ids) {
    const urls = await page.evaluate(([i, a]) => window.__mvDebug.sceneFrames(i, a), [id, aspect])
    const dir = join(OUT, 'frames', `${id}_${aspect.replace(':', 'x')}`)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    urls.forEach((u, k) => writeFileSync(join(dir, `${String(k).padStart(3, '0')}.jpg`), Buffer.from(u.split(',')[1], 'base64')))
    const cols = aspect === '9:16' ? 8 : 5
    const rows = Math.ceil(urls.length / cols)
    const name = `${id}_${aspect.replace(':', 'x')}.jpg`
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', join(dir, '%03d.jpg'), '-vf', `tile=${cols}x${rows}:padding=4:color=0x222222`, '-frames:v', '1', join(OUT, name)])
    console.log(name, urls.length, 'scenes')
  }
}
await app.close()
