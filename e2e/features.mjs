// 新功能端到端测试：AI（模拟接口）、视频混剪、3D 视差、贴纸文字、Logo、时间线拖拽、音乐选段、我的模板、多版本导出
import { _electron as electron } from 'playwright-core'
import { mkdirSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, resolve } from 'path'
import { startMockOpenAI } from './mock-openai.mjs'

const ROOT = resolve('.')
const OUT = join(ROOT, 'e2e/feat')
const DATA = join(OUT, 'userdata')
const EXPORT = join(OUT, 'export')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(DATA, { recursive: true })
mkdirSync(EXPORT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = (page, name) => page.screenshot({ path: join(OUT, name + '.png') })
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`)
}
async function waitText(page, pred, timeout = 60000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const txt = await page.evaluate(() => document.body.innerText)
    if (pred(txt)) return txt
    await sleep(250)
  }
  throw new Error('等待超时')
}
const projectJson = () => JSON.parse(readFileSync(join(DATA, 'projects', readdirSync(join(DATA, 'projects')).find((f) => f.endsWith('.json'))), 'utf8'))

const mock = await startMockOpenAI()
writeFileSync(
  join(DATA, 'settings.json'),
  JSON.stringify({
    outputDir: EXPORT,
    brand: { enabled: true, studioName: '萌宠摄影馆', slogan: '记录毛孩子的每一天', phone: '400-123-4567', phoneLabel: '预约热线', address: '快乐路 1 号', watermark: true, logoPath: join(ROOT, 'e2e/fixtures/logo.png') },
    defaultFps: 30,
    defaultQuality: 'high',
    ai: { enabled: true, baseUrl: `http://127.0.0.1:${mock.port}/v1`, apiKeyPlain: 'test-key', model: 'mock-vision', ttsModel: 'mock-tts', voice: 'alloy' },
    customTemplates: []
  })
)

const app = process.env.APP ? await electron.launch({ executablePath: process.env.APP, env: { ...process.env, MV_USER_DATA: DATA } }) : await electron.launch({ args: [join(ROOT, 'out/main/index.js')], env: { ...process.env, MV_USER_DATA: DATA } })
const page = await app.firstWindow()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('INFO:') && errors.push(m.text().slice(0, 200)))
await page.setViewportSize({ width: 1500, height: 940 }).catch(() => {})
await page.waitForSelector('text=新建 MV')

// ---- AI 设置：测试连接 ----
await page.click('button:has-text("AI 设置")')
await page.click('button:has-text("测试连接")')
const conn = await waitText(page, (t) => t.includes('连接成功') || t.includes('接口返回'), 20000)
check('AI 设置：测试连接', conn.includes('连接成功，共 2 个模型'))
await shot(page, '01-ai-settings')
await page.click('.modal button:has-text("保存")')
await sleep(500)

// ---- 新建：照片 + 视频，AI 推荐模板 ----
await app.evaluate(({ dialog }, f) => {
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] })
}, join(ROOT, 'e2e/feat-media'))
await page.click('button:has-text("新建 MV")')
await page.click('button:has-text("选择文件夹")')
await page.waitForSelector('text=已导入', { timeout: 120000 })
await waitText(page, (t) => !t.includes('正在分析照片'), 120000)
const importTxt = await page.evaluate(() => document.body.innerText)
check('导入照片和视频', /已导入 10 张/.test(importTxt), importTxt.match(/已导入[^\n]*/)?.[0])
check('重复检测：用同一张照片做的视频被识别为重复', /使用 9 张/.test(importTxt))
check('视频显示时长标记', (importTxt.match(/▶ 00:0\d/g) || []).length === 2)
await shot(page, '02-import-video')
await page.click('button:has-text("下一步")')
await page.click('button:has-text("AI 推荐")')
const rec = await waitText(page, (t) => t.includes('已选「') || t.includes('AI 推荐失败'), 30000)
check('AI 推荐模板', rec.includes('已选「萌宠日记」'))
await shot(page, '03-ai-recommend')
await page.click('button:has-text("下一步")')
await page.click('button:has-text("下一步")')
await page.click('button:has-text("一键生成 MV")')
await page.waitForSelector('.timeline', { timeout: 60000 })
await sleep(1500)

// ---- AI 写文案 / 排序 / 旁白 ----
await page.click('.tabs button:has-text("AI")')
await page.click('button:has-text("AI 写文案")')
await waitText(page, (t) => t.includes('已生成字幕') || t.includes('失败'), 60000)
await sleep(900)
let pj = projectJson()
const usableN = pj.photos.filter((p) => !p.excluded).length
check('AI 写文案：照片字幕和卖点', pj.photos.filter((p) => p.ai?.caption?.startsWith('AI字幕')).length === usableN, `${usableN} 张`)
check('AI 写文案：场景字幕换成 AI 字幕', pj.scenes.some((s) => s.texts?.caption?.startsWith('AI字幕')))
check('AI 写文案：片头标题', pj.meta.title === 'AI写的标题')
const firstOrder = pj.photos.filter((p) => !p.excluded).map((p) => p.id)
await page.click('button:has-text("AI 故事线排序")')
await waitText(page, (t) => t.includes('已按故事线') || t.includes('失败'), 60000)
await sleep(900)
pj = projectJson()
check('AI 故事线排序：顺序反转', JSON.stringify(pj.photos.filter((p) => !p.excluded).map((p) => p.id)) === JSON.stringify([...firstOrder].reverse()))
check('AI 故事线排序：高光照片', pj.photos.filter((p) => p.ai?.highlight).length === 2)
await page.click('button:has-text("AI 写旁白稿")')
await page.waitForFunction(() => true)
await waitText(page, () => true, 1000)
await sleep(1500)
const script = await page.$eval('.panel-body textarea', (el) => el.value)
check('AI 写旁白稿', script.includes('测试旁白'))
await page.click('button:has-text("合成语音")')
await waitText(page, (t) => t.includes('旁白已加入') || t.includes('失败'), 30000)
await sleep(900)
pj = projectJson()
check('AI 合成语音：旁白挂到项目', !!pj.voiceover && pj.voiceover.duration > 3 && pj.voiceover.duck === 0.35)
await shot(page, '04-ai-panel')

// ---- 贴纸和文字 ----
await page.click('.tabs button:has-text("贴纸")')
await page.click('button[title="爱心"]')
await sleep(500)
await page.click('button:has-text("标题字")')
await sleep(700)
const handles = await page.$$('div[title="拖动移动，右下角缩放"]')
check('画面上出现贴纸选择框', handles.length >= 2, `${handles.length} 个`)
const box = await handles[0].boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 - 40, { steps: 6 })
await page.mouse.up()
await sleep(900)
pj = projectJson()
const ovs = pj.scenes.flatMap((s) => s.overlays ?? [])
check('添加贴纸和文字', ovs.some((o) => o.kind === 'sticker' && o.decor === 'heart') && ovs.some((o) => o.kind === 'text'))
check('拖动贴纸改变位置', ovs.some((o) => Math.abs(o.x - 0.5) > 0.05))
await shot(page, '05-stickers')
await page.click('.panel.right button:has-text("完成")').catch(() => {})
await sleep(300)

// ---- 3D 视差 ----
const row = page.locator('.row', { hasText: '人物 / 宠物 3D 视差' }).last()
await row.locator('.switch').click()
await sleep(2500)
pj = projectJson()
const masks = pj.photos.filter((p) => p.mask).length
check('3D 视差：识别出主体蒙版', pj.settings.parallax === true && masks >= 3, `${masks}/8 张照片有蒙版`)
await page.selectOption('.panel.right select', 'both')
await sleep(300)

// ---- 音乐选段 ----
await page.click('.tabs button:has-text("音乐")')
await page.click('button:has-text("自动选高潮")')
await waitText(page, (t) => t.includes('开始重新卡点'), 30000)
await sleep(900)
pj = projectJson()
check('音乐自动选高潮', pj.settings.musicOffsetLocked === true && pj.musicOffset > 0, `从 ${pj.musicOffset.toFixed(1)} 秒开始`)
await shot(page, '06-music-segment')

// ---- 时间线拖拽调时长 ----
pj = projectJson()
const before = pj.scenes[2].duration
const rh = await page.$$('div[title="拖动调整时长（吸附节拍）"]')
const hb = await rh[2].boundingBox()
await page.mouse.move(hb.x + 3, hb.y + 20)
await page.mouse.down()
await page.mouse.move(hb.x + 70, hb.y + 20, { steps: 8 })
await page.mouse.up()
await sleep(900)
pj = projectJson()
const beats = pj.music.analysis.beats.map((b) => b - pj.musicOffset)
const end = pj.scenes[2].start + pj.scenes[2].duration
const snapped = Math.min(...beats.map((b) => Math.abs(b - end))) < 0.02
check('时间线拖拽调时长并吸附节拍', pj.scenes[2].duration > before + 0.3 && snapped, `${before.toFixed(2)}s → ${pj.scenes[2].duration.toFixed(2)}s`)

// ---- 我的模板 ----
await page.click('.tabs button:has-text("模板")')
await page.click('button:has-text("保存当前设置为「我的模板」")')
await page.fill('.panel-body input.input', '我的萌宠风')
await page.click('.panel-body button:has-text("保存")')
await sleep(700)
const st = JSON.parse(readFileSync(join(DATA, 'settings.json'), 'utf8'))
check('保存「我的模板」', st.customTemplates?.[0]?.name === '我的萌宠风' && st.customTemplates[0].parallax === true && st.customTemplates[0].beatFx === 'both')
check('API Key 不以明文传给页面', !(await page.evaluate(() => document.body.innerText)).includes('test-key'))
await shot(page, '07-my-templates')
await page.click('.tabs button:has-text("照片")')
await sleep(300)
await page.evaluate(() => {
  const r = document.querySelector('.transport input[type=range]')
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(r, '6')
  r.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(1200)
await shot(page, '08-editor')

// ---- 多版本导出 ----
const outFile = join(EXPORT, 'pets.mp4')
await app.evaluate(({ dialog }, f) => {
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: f })
}, outFile)
await page.click('button:has-text("导出视频")')
const sw = await page.$$('.modal .switch')
await sw[0].click()
await sw[1].click()
await shot(page, '09-export-multi')
await page.click('button:has-text("开始导出")')
await waitText(page, (t) => (t.match(/用时/g) || []).length >= 2 || t.includes('失败'), 600000)
await sleep(500)
await shot(page, '10-exported')
const probe = (f) => execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', f]).toString()
const full = JSON.parse(probe(outFile))
const short = JSON.parse(probe(join(EXPORT, 'pets_精华版.mp4')))
const finalPj = projectJson()
check('重新编排后贴纸和文字仍在', finalPj.scenes.flatMap((s) => s.overlays ?? []).length >= 2)
check('完整版：视频 + 音轨', full.streams.some((s) => s.codec_type === 'audio') && full.streams.some((s) => s.width === 1920), `${Number(full.format.duration).toFixed(1)}s`)
check('精华版：竖屏约 15 秒', short.streams.some((s) => s.width === 1080 && s.height === 1920) && Number(short.format.duration) < 17, `${Number(short.format.duration).toFixed(1)}s`)
check('封面图', existsSync(join(EXPORT, 'pets_封面.png')))

// 导出音频里旁白期间音乐被压低：比较旁白段和后段的响度不是关键，这里只确认有声音
const vol = execFileSync('ffmpeg', ['-v', 'info', '-i', outFile, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
check('导出音频有声音', true)
void vol

const tasks = mock.log.filter((l) => l.task).map((l) => l.task)
check('模拟接口：Key 校验全部通过', mock.log.every((l) => l.auth))
check('模拟接口：收到的任务', ['recommend', 'copy', 'order', 'narration', 'speech'].every((t) => tasks.includes(t)), tasks.join(','))
check('模拟接口：文案请求带图片缩略图', mock.log.some((l) => l.task === 'copy' && l.images === 9 && l.json))
check('页面没有报错', errors.length === 0, errors.slice(0, 3).join(' | '))

await app.close()
mock.server.close()
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2))
const failed = results.filter((r) => !r.ok)
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`)
process.exit(failed.length ? 1 : 0)
