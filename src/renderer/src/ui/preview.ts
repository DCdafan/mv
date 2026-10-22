// 模板缩略图：用一个隐藏的渲染器，拿用户自己的照片渲染模板画面
import type { Aspect, PhotoAsset, Project } from '@shared/types'
import { Renderer } from '../engine/renderer'
import { getTemplate } from '../templates'
import { arrange } from '../arrange/arranger'
import { loadFont } from '../engine/text'

export const DEMO_PHOTOS: PhotoAsset[] = [
  { id: 'demo1', path: './demo/w01.jpg', name: 'w01', width: 960, height: 640, orientation: 'landscape' },
  { id: 'demo2', path: './demo/w02.jpg', name: 'w02', width: 640, height: 960, orientation: 'portrait' },
  { id: 'demo3', path: './demo/b03.jpg', name: 'b03', width: 960, height: 640, orientation: 'landscape' },
  { id: 'demo4', path: './demo/t02.jpg', name: 't02', width: 640, height: 960, orientation: 'portrait' },
  { id: 'demo5', path: './demo/f03.jpg', name: 'f03', width: 960, height: 640, orientation: 'landscape' },
  { id: 'demo6', path: './demo/t05.jpg', name: 't05', width: 960, height: 640, orientation: 'landscape' }
]

const bk = (n: number, name: string, price: string, land: boolean): PhotoAsset => ({
  id: 'bk' + n,
  path: `./demo/k0${n}.jpg`,
  name,
  width: land ? 960 : 640,
  height: land ? 640 : 960,
  orientation: land ? 'landscape' : 'portrait',
  product: { name, price }
})

/** 蛋糕店模板的内置预览图（带品名和价格） */
export const BAKERY_DEMO: PhotoAsset[] = [
  bk(1, '草莓奶油蛋糕', '168', false),
  bk(2, '马卡龙礼盒', '88', true),
  bk(3, '抹茶慕斯', '36', true),
  bk(4, '纸杯蛋糕', '15', true),
  bk(5, '蓝莓芝士蛋糕', '42', false),
  bk(6, '黄油可颂', '18', true)
]

export function previewProject(templateId: string, photos: PhotoAsset[], aspect: Aspect, seed = 7): Project {
  const tpl = getTemplate(templateId)
  const mine = photos.filter((p) => !p.excluded)
  // 蛋糕店模板：用户照片里没有商品信息时，用内置蛋糕图预览
  const demo = tpl.industry === 'bakery' ? BAKERY_DEMO : DEMO_PHOTOS
  const ok = mine.length >= 3 && (tpl.industry !== 'bakery' || mine.some((p) => p.product?.price))
  const use = (ok ? mine : demo).slice(0, seed === 7 ? 12 : 40)
  const { scenes, musicOffset } = arrange({ photos: use, template: tpl, aspect, music: null, pace: tpl.pace, durationMode: 'photos', seed })
  return {
    version: 1,
    id: 'preview',
    name: 'preview',
    createdAt: 0,
    updatedAt: 0,
    templateId,
    aspect,
    photos: use,
    music: null,
    musicOffset,
    scenes,
    meta: { ...tpl.defaults, date: '2026.10.22' },
    settings: { pace: tpl.pace, durationMode: 'photos', particles: true, musicVolume: 1, fadeOut: 3 },
    seed
  }
}

let shared: Renderer | null = null
let chain: Promise<unknown> = Promise.resolve()
const cache = new Map<string, Promise<string>>()

function renderer(w: number, h: number): Renderer {
  if (!shared) {
    const c = document.createElement('canvas')
    shared = new Renderer(c, { maxTextureSize: 1024, useOriginals: false, preserveDrawingBuffer: true })
  }
  shared.setSize(w, h)
  return shared
}

/** 渲染模板的一帧做缩略图（片头标题完全出现的时刻 + 第一个正片场景） */
export function templateThumb(templateId: string, photos: PhotoAsset[], aspect: Aspect = '16:9', which: 'intro' | 'scene' = 'intro'): Promise<string> {
  const key = `${templateId}|${aspect}|${which}|${photos.filter((p) => !p.excluded).slice(0, 12).map((p) => p.id).join(',')}`
  let p = cache.get(key)
  if (p) return p
  p = (chain = chain.then(async () => {
    const proj = previewProject(templateId, photos, aspect)
    const [w, h] = aspect === '9:16' ? [216, 384] : aspect === '1:1' ? [300, 300] : [384, 216]
    const r = renderer(w, h)
    r.setProject(proj, getTemplate(templateId), null)
    const scene = which === 'intro' ? proj.scenes[0] : proj.scenes.find((s) => s.kind === 'photo' && s.photos.length > 1) ?? proj.scenes[1]
    await r.prepare(scene.start, scene.start + 0.1)
    const tpl = getTemplate(templateId)
    await Promise.all([loadFont(tpl.fonts.title), loadFont(tpl.fonts.body), tpl.fonts.script ? loadFont(tpl.fonts.script) : null, loadFont('MaShanZheng')])
    r.renderSceneFrame(scene, Math.min(scene.duration * 0.8, 3.2))
    return (r.canvas as HTMLCanvasElement).toDataURL('image/jpeg', 0.85)
  })) as Promise<string>
  cache.set(key, p)
  p.catch(() => cache.delete(key))
  return p
}
