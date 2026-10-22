// 可编辑文字的取值规则：场景覆盖 > 自动值（项目信息、店铺品牌、照片里的品名价格）> 版式默认文字
import type { BrandSettings, PhotoAsset, Project, Scene } from '@shared/types'

/** 相机默认文件名（IMG_1234、DSC0001、微信图片_xxx 等）不当作品名 */
const CAMERA_NAME = /^(img|dsc|dscn|dcim|pxl|mvimg|photo|image|screenshot|wechat|mmexport|微信图片|屏幕快照|截屏|截图)[\s_-]*\d/i

/**
 * 从文件名识别商品信息，例如：
 *   草莓奶油蛋糕-168.jpg → { name: '草莓奶油蛋糕', price: '168' }
 *   抹茶慕斯 ¥36.jpg     → { name: '抹茶慕斯', price: '36' }
 *   黄油可颂_18元.png    → { name: '黄油可颂', price: '18' }
 *   门店环境.jpg         → { name: '门店环境' }
 */
export function parseProduct(fileName: string): { name: string; price?: string } | undefined {
  const base = fileName.replace(/\.[^.]+$/, '').trim()
  if (!base || CAMERA_NAME.test(base) || /^[\d\s_\-.]+$/.test(base)) return undefined
  // 品名需含中文，或是 3 个以上字母的英文单词（避免把 w01、a2 这类编号当品名）
  const isName = (s: string): boolean => /\p{Script=Han}/u.test(s) || /[A-Za-z]{3,}/.test(s)
  const m = base.match(/^(.*?)[\s_\-—]*(?:[¥￥]\s*)?(\d+(?:\.\d{1,2})?)\s*(?:元|rmb|RMB)?$/)
  if (m && m[1] && isName(m[1])) return { name: m[1].trim(), price: m[2] }
  if (m && m[1]) return undefined
  if (/[\p{Script=Han}]/u.test(base) || /^[A-Za-z][A-Za-z\s'&]+$/.test(base)) return { name: base.replace(/[_]+/g, ' ').trim() }
  return undefined
}

export function formatPrice(price?: string): string {
  return price ? `￥${price}` : ''
}

/** key 形如 product、price@1（@ 后面是照片槽位） */
export function splitKey(key: string): { base: string; slot: number } {
  const [base, s] = key.split('@')
  return { base, slot: s ? Number(s) || 0 : 0 }
}

/** 返回 undefined 表示没有自动值，使用版式里的默认文字 */
export function autoText(key: string, scene: Scene, project: Project, brand: BrandSettings | null, photoMap?: Map<string, PhotoAsset>): string | undefined {
  const { base, slot } = splitKey(key)
  const photo = (): PhotoAsset | undefined => {
    const id = scene.photos[slot]
    if (!id) return undefined
    return photoMap ? photoMap.get(id) : project.photos.find((p) => p.id === id)
  }
  const on = !!brand?.enabled
  switch (base) {
    case 'title':
      return project.meta.title
    case 'subtitle':
      return project.meta.subtitle
    case 'date':
      return project.meta.date
    case 'ending':
      return project.meta.ending
    case 'studio':
      return on ? brand!.studioName : ''
    case 'slogan':
      return on ? brand!.slogan : ''
    case 'phone':
      return on && brand!.phone ? `${brand!.phoneLabel || '预约热线'}  ${brand!.phone}` : ''
    case 'address':
      return on && brand!.address ? brand!.address : ''
    case 'product':
      return photo()?.product?.name ?? ''
    case 'price':
      return formatPrice(photo()?.product?.price)
    case 'caption':
      return ''
  }
  return undefined
}

export const TEXT_LABEL: Record<string, string> = {
  caption: '字幕',
  product: '品名',
  price: '价格',
  tag: '标签'
}

/** 编辑器里按场景可编辑的文字（片头片尾的标题等走项目信息） */
export const SCENE_TEXT_KEYS = ['caption', 'product', 'price', 'tag']
