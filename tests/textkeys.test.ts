import { describe, it, expect } from 'vitest'
import { parseProduct } from '../src/renderer/src/engine/textkeys'

describe('文件名识别商品', () => {
  it.each([
    ['草莓奶油蛋糕-168.jpg', { name: '草莓奶油蛋糕', price: '168' }],
    ['抹茶慕斯 ¥36.jpg', { name: '抹茶慕斯', price: '36' }],
    ['黄油可颂_18元.png', { name: '黄油可颂', price: '18' }],
    ['提拉米苏35.jpeg', { name: '提拉米苏', price: '35' }],
    ['芝士挞-12.5.jpg', { name: '芝士挞', price: '12.5' }],
    ['门店环境.jpg', { name: '门店环境' }],
    ['Croissant-18.jpg', { name: 'Croissant', price: '18' }]
  ])('%s', (f, want) => expect(parseProduct(f)).toEqual(want))

  it.each(['IMG_1234.jpg', 'DSC0001.JPG', '微信图片_20240101.jpg', '20240101_123.jpg', 'w01.jpg'])('相机文件名不识别：%s', (f) => {
    expect(parseProduct(f)).toBeUndefined()
  })
})
