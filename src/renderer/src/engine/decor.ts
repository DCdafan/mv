// 程序化绘制的装饰素材（无需额外图片资源，任意颜色、任意分辨率）
import { fontFamily } from './text'

type Draw = (g: CanvasRenderingContext2D, w: number, h: number, c: string, c2: string) => void

interface DecorDef {
  label: string
  w: number
  h: number
  draw: Draw
}

const star = (g: CanvasRenderingContext2D, x: number, y: number, r: number, inner = 0.45): void => {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * inner : r
    const a = (i * Math.PI) / 5 - Math.PI / 2
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  g.closePath()
}

const heartPath = (g: CanvasRenderingContext2D, x: number, y: number, s: number): void => {
  g.beginPath()
  g.moveTo(x, y + s * 0.35)
  g.bezierCurveTo(x - s * 0.75, y - s * 0.15, x - s * 0.4, y - s * 0.75, x, y - s * 0.3)
  g.bezierCurveTo(x + s * 0.4, y - s * 0.75, x + s * 0.75, y - s * 0.15, x, y + s * 0.35)
  g.closePath()
}

export const DECORS: Record<string, DecorDef> = {
  xi: {
    label: '囍',
    w: 512,
    h: 512,
    draw: (g, w, h, c) => {
      g.fillStyle = c
      g.font = `${h * 0.86}px ${fontFamily('MaShanZheng')}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('囍', w / 2, h * 0.53)
    }
  },
  rings: {
    label: '对戒',
    w: 512,
    h: 340,
    draw: (g, w, h, c, c2) => {
      g.lineWidth = 18
      g.strokeStyle = c
      g.beginPath()
      g.arc(w * 0.4, h * 0.55, h * 0.3, 0, Math.PI * 2)
      g.stroke()
      g.strokeStyle = c2
      g.beginPath()
      g.arc(w * 0.6, h * 0.55, h * 0.3, 0, Math.PI * 2)
      g.stroke()
      g.fillStyle = '#fff'
      star(g, w * 0.4, h * 0.2, 18, 0.35)
      g.fill()
    }
  },
  flourish: {
    label: '花纹分隔线',
    w: 1024,
    h: 128,
    draw: (g, w, h, c) => {
      g.strokeStyle = c
      g.fillStyle = c
      g.lineWidth = 4
      g.lineCap = 'round'
      const cy = h / 2
      g.beginPath()
      g.moveTo(w * 0.04, cy)
      g.lineTo(w * 0.38, cy)
      g.moveTo(w * 0.62, cy)
      g.lineTo(w * 0.96, cy)
      g.stroke()
      for (const s of [-1, 1]) {
        g.beginPath()
        g.moveTo(w / 2 + s * w * 0.05, cy)
        g.bezierCurveTo(w / 2 + s * w * 0.1, cy - h * 0.45, w / 2 + s * w * 0.16, cy - h * 0.1, w / 2 + s * w * 0.12, cy)
        g.bezierCurveTo(w / 2 + s * w * 0.09, cy + h * 0.25, w / 2 + s * w * 0.15, cy + h * 0.3, w / 2 + s * w * 0.12 + s * 30, cy)
        g.stroke()
      }
      g.beginPath()
      g.moveTo(w / 2, cy - h * 0.3)
      g.lineTo(w / 2 + h * 0.2, cy)
      g.lineTo(w / 2, cy + h * 0.3)
      g.lineTo(w / 2 - h * 0.2, cy)
      g.closePath()
      g.fill()
    }
  },
  corner: {
    label: '花角',
    w: 256,
    h: 256,
    draw: (g, w, h, c) => {
      g.strokeStyle = c
      g.lineWidth = 6
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(16, h - 16)
      g.lineTo(16, 16)
      g.lineTo(w - 16, 16)
      g.stroke()
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(36, h * 0.7)
      g.lineTo(36, 36)
      g.lineTo(w * 0.7, 36)
      g.stroke()
      g.beginPath()
      g.arc(70, 70, 26, Math.PI, Math.PI * 2.5)
      g.stroke()
      g.fillStyle = c
      g.beginPath()
      g.arc(70, 70, 8, 0, Math.PI * 2)
      g.fill()
    }
  },
  heartLine: {
    label: '爱心线框',
    w: 512,
    h: 460,
    draw: (g, w, h, c) => {
      g.strokeStyle = c
      g.lineWidth = 14
      heartPath(g, w / 2, h * 0.5, w * 0.85)
      g.stroke()
    }
  },
  heart: {
    label: '爱心',
    w: 512,
    h: 460,
    draw: (g, w, h, c) => {
      g.fillStyle = c
      heartPath(g, w / 2, h * 0.5, w * 0.85)
      g.fill()
    }
  },
  star: {
    label: '星星',
    w: 256,
    h: 256,
    draw: (g, w, h, c) => {
      g.fillStyle = c
      star(g, w / 2, h / 2 + 8, w * 0.46)
      g.fill()
    }
  },
  cloud: {
    label: '云朵',
    w: 512,
    h: 300,
    draw: (g, w, h, c) => {
      g.fillStyle = c
      g.beginPath()
      g.arc(w * 0.3, h * 0.62, h * 0.24, 0, Math.PI * 2)
      g.arc(w * 0.5, h * 0.45, h * 0.32, 0, Math.PI * 2)
      g.arc(w * 0.7, h * 0.6, h * 0.25, 0, Math.PI * 2)
      g.fill()
      g.fillRect(w * 0.3, h * 0.6, w * 0.4, h * 0.26)
    }
  },
  balloon: {
    label: '气球',
    w: 256,
    h: 512,
    draw: (g, w, h, c, c2) => {
      g.strokeStyle = c2
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(w / 2, h * 0.58)
      g.bezierCurveTo(w * 0.3, h * 0.72, w * 0.7, h * 0.85, w / 2, h * 0.98)
      g.stroke()
      g.fillStyle = c
      g.beginPath()
      g.ellipse(w / 2, h * 0.3, w * 0.4, h * 0.27, 0, 0, Math.PI * 2)
      g.fill()
      g.beginPath()
      g.moveTo(w / 2 - 12, h * 0.6)
      g.lineTo(w / 2 + 12, h * 0.6)
      g.lineTo(w / 2, h * 0.565)
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.45)'
      g.beginPath()
      g.ellipse(w * 0.36, h * 0.2, w * 0.08, h * 0.05, -0.6, 0, Math.PI * 2)
      g.fill()
    }
  },
  crown: {
    label: '皇冠',
    w: 512,
    h: 340,
    draw: (g, w, h, c) => {
      g.fillStyle = c
      g.beginPath()
      g.moveTo(w * 0.1, h * 0.85)
      g.lineTo(w * 0.06, h * 0.25)
      g.lineTo(w * 0.3, h * 0.55)
      g.lineTo(w * 0.5, h * 0.1)
      g.lineTo(w * 0.7, h * 0.55)
      g.lineTo(w * 0.94, h * 0.25)
      g.lineTo(w * 0.9, h * 0.85)
      g.closePath()
      g.fill()
      for (const x of [0.06, 0.5, 0.94]) {
        g.beginPath()
        g.arc(w * x, h * (x === 0.5 ? 0.1 : 0.25), 18, 0, Math.PI * 2)
        g.fill()
      }
    }
  },
  lantern: {
    label: '灯笼',
    w: 256,
    h: 420,
    draw: (g, w, h, c, c2) => {
      g.strokeStyle = c2
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(w / 2, 0)
      g.lineTo(w / 2, h * 0.12)
      g.stroke()
      g.fillStyle = c2
      g.fillRect(w * 0.3, h * 0.1, w * 0.4, h * 0.06)
      g.fillRect(w * 0.3, h * 0.74, w * 0.4, h * 0.06)
      g.fillStyle = c
      g.beginPath()
      g.ellipse(w / 2, h * 0.45, w * 0.46, h * 0.31, 0, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.18)'
      g.lineWidth = 3
      for (const k of [-0.25, 0, 0.25]) {
        g.beginPath()
        g.ellipse(w / 2, h * 0.45, w * 0.46 * Math.abs(k) * 2 + 1, h * 0.31, 0, 0, Math.PI * 2)
        g.stroke()
      }
      g.strokeStyle = c2
      g.lineWidth = 3
      for (let i = 0; i < 7; i++) {
        g.beginPath()
        g.moveTo(w * (0.38 + i * 0.04), h * 0.8)
        g.lineTo(w * (0.38 + i * 0.04), h * 0.98)
        g.stroke()
      }
      g.fillStyle = c2
      g.font = `bold ${w * 0.32}px ${fontFamily('MaShanZheng')}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('福', w / 2, h * 0.47)
    }
  },
  auspiciousCloud: {
    label: '祥云',
    w: 512,
    h: 256,
    draw: (g, w, h, c) => {
      g.strokeStyle = c
      g.lineWidth = 10
      g.lineCap = 'round'
      const spiral = (x: number, y: number, r: number, dir: number): void => {
        g.beginPath()
        for (let a = 0; a < Math.PI * 3; a += 0.1) {
          const rr = r * (1 - a / (Math.PI * 3.4))
          g.lineTo(x + Math.cos(a * dir) * rr, y + Math.sin(a * dir) * rr)
        }
        g.stroke()
      }
      spiral(w * 0.3, h * 0.55, h * 0.3, 1)
      spiral(w * 0.55, h * 0.4, h * 0.34, -1)
      spiral(w * 0.76, h * 0.6, h * 0.24, 1)
      g.beginPath()
      g.moveTo(w * 0.05, h * 0.85)
      g.quadraticCurveTo(w * 0.5, h * 0.95, w * 0.95, h * 0.85)
      g.stroke()
    }
  },
  laurel: {
    label: '月桂枝',
    w: 512,
    h: 512,
    draw: (g, w, h, c) => {
      g.fillStyle = c
      g.strokeStyle = c
      g.lineWidth = 6
      for (const s of [-1, 1]) {
        g.beginPath()
        g.arc(w / 2, h * 0.45, w * 0.38, Math.PI / 2 + s * 0.25, Math.PI / 2 + s * 2.6, s < 0)
        g.stroke()
        for (let i = 0; i < 9; i++) {
          const a = Math.PI / 2 + s * (0.45 + i * 0.25)
          const x = w / 2 + Math.cos(a) * w * 0.38
          const y = h * 0.45 + Math.sin(a) * w * 0.38
          g.save()
          g.translate(x, y)
          g.rotate(a + (s > 0 ? 0.6 : -0.6) + Math.PI / 2)
          g.beginPath()
          g.ellipse(0, -20, 10, 24, 0, 0, Math.PI * 2)
          g.fill()
          g.restore()
        }
      }
    }
  },
  gradCap: {
    label: '学士帽',
    w: 512,
    h: 400,
    draw: (g, w, h, c, c2) => {
      g.fillStyle = c
      g.beginPath()
      g.moveTo(w * 0.5, h * 0.1)
      g.lineTo(w * 0.98, h * 0.35)
      g.lineTo(w * 0.5, h * 0.6)
      g.lineTo(w * 0.02, h * 0.35)
      g.closePath()
      g.fill()
      g.beginPath()
      g.moveTo(w * 0.25, h * 0.5)
      g.lineTo(w * 0.25, h * 0.78)
      g.quadraticCurveTo(w * 0.5, h * 0.95, w * 0.75, h * 0.78)
      g.lineTo(w * 0.75, h * 0.5)
      g.lineTo(w * 0.5, h * 0.63)
      g.closePath()
      g.fill()
      g.strokeStyle = c2
      g.lineWidth = 6
      g.beginPath()
      g.moveTo(w * 0.5, h * 0.35)
      g.lineTo(w * 0.88, h * 0.45)
      g.lineTo(w * 0.88, h * 0.75)
      g.stroke()
      g.fillStyle = c2
      g.fillRect(w * 0.86, h * 0.75, 14, 40)
    }
  },
  plane: {
    label: '纸飞机',
    w: 512,
    h: 384,
    draw: (g, w, h, c, c2) => {
      g.fillStyle = c
      g.beginPath()
      g.moveTo(w * 0.95, h * 0.1)
      g.lineTo(w * 0.05, h * 0.45)
      g.lineTo(w * 0.38, h * 0.58)
      g.closePath()
      g.fill()
      g.fillStyle = c2
      g.beginPath()
      g.moveTo(w * 0.95, h * 0.1)
      g.lineTo(w * 0.38, h * 0.58)
      g.lineTo(w * 0.48, h * 0.9)
      g.closePath()
      g.fill()
    }
  },
  stamp: {
    label: '邮戳',
    w: 512,
    h: 512,
    draw: (g, w, h, c) => {
      g.strokeStyle = c
      g.fillStyle = c
      g.lineWidth = 10
      g.beginPath()
      g.arc(w / 2, h / 2, w * 0.44, 0, Math.PI * 2)
      g.stroke()
      g.lineWidth = 4
      g.beginPath()
      g.arc(w / 2, h / 2, w * 0.36, 0, Math.PI * 2)
      g.stroke()
      g.font = `bold ${w * 0.1}px ${fontFamily('Montserrat')}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      const txt = 'BON VOYAGE · TRAVEL DIARY · '
      for (let i = 0; i < txt.length; i++) {
        const a = (i / txt.length) * Math.PI * 2 - Math.PI / 2
        g.save()
        g.translate(w / 2 + Math.cos(a) * w * 0.4 - 0, h / 2 + Math.sin(a) * w * 0.4)
        g.rotate(a + Math.PI / 2)
        g.font = `bold ${w * 0.055}px ${fontFamily('Montserrat')}`
        g.fillText(txt[i], 0, 0)
        g.restore()
      }
      star(g, w / 2, h / 2, w * 0.14)
      g.fill()
    }
  },
  tape: {
    label: '和纸胶带',
    w: 512,
    h: 128,
    draw: (g, w, h, c) => {
      g.fillStyle = c
      g.globalAlpha = 0.75
      g.beginPath()
      g.moveTo(0, 8)
      for (let y = 8; y <= h - 8; y += 12) g.lineTo(y % 24 ? 10 : 0, y)
      g.lineTo(0, h - 8)
      g.lineTo(w, h - 8)
      for (let y = h - 8; y >= 8; y -= 12) g.lineTo(y % 24 ? w - 10 : w, y)
      g.closePath()
      g.fill()
      g.globalAlpha = 0.25
      g.fillStyle = '#fff'
      for (let x = 20; x < w; x += 40) g.fillRect(x, 8, 14, h - 16)
    }
  },
  pin: {
    label: '定位',
    w: 256,
    h: 360,
    draw: (g, w, h, c) => {
      g.fillStyle = c
      g.beginPath()
      g.arc(w / 2, h * 0.36, w * 0.4, Math.PI, 0)
      g.quadraticCurveTo(w * 0.9, h * 0.6, w / 2, h * 0.97)
      g.quadraticCurveTo(w * 0.1, h * 0.6, w * 0.1, h * 0.36)
      g.fill()
      g.globalCompositeOperation = 'destination-out'
      g.beginPath()
      g.arc(w / 2, h * 0.36, w * 0.16, 0, Math.PI * 2)
      g.fill()
    }
  },
  quote: {
    label: '引号',
    w: 256,
    h: 200,
    draw: (g, w, h, c) => {
      g.fillStyle = c
      g.font = `bold ${h * 1.4}px ${fontFamily('PlayfairDisplay')}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('“', w / 2, h * 0.75)
    }
  },
  brush: {
    label: '笔刷',
    w: 1024,
    h: 256,
    draw: (g, w, h, c) => {
      g.fillStyle = c
      for (let i = 0; i < 40; i++) {
        const y = h * 0.2 + (i / 40) * h * 0.6
        const x0 = w * (0.02 + Math.sin(i * 3.1) * 0.015)
        const x1 = w * (0.97 + Math.cos(i * 2.3) * 0.02)
        g.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.7))
        g.fillRect(x0, y, x1 - x0, h * 0.6 / 40 + 1)
      }
    }
  },
  sunburst: {
    label: '光芒',
    w: 512,
    h: 512,
    draw: (g, w, h, c) => {
      g.fillStyle = c
      g.translate(w / 2, h / 2)
      for (let i = 0; i < 24; i++) {
        g.rotate((Math.PI * 2) / 24)
        g.beginPath()
        g.moveTo(0, 0)
        g.lineTo(-w * 0.04, -w * 0.5)
        g.lineTo(w * 0.04, -w * 0.5)
        g.closePath()
        g.globalAlpha = i % 2 ? 0.5 : 1
        g.fill()
      }
    }
  },
  cupcake: {
    label: '纸杯蛋糕',
    w: 400,
    h: 460,
    draw: (g, w, h, c, c2) => {
      // 纸杯
      g.fillStyle = c2
      g.beginPath()
      g.moveTo(w * 0.18, h * 0.55)
      g.lineTo(w * 0.82, h * 0.55)
      g.lineTo(w * 0.72, h * 0.97)
      g.lineTo(w * 0.28, h * 0.97)
      g.closePath()
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.12)'
      g.lineWidth = 6
      for (let i = 1; i < 6; i++) {
        const x0 = w * (0.18 + i * 0.107)
        g.beginPath()
        g.moveTo(x0, h * 0.56)
        g.lineTo(w * 0.28 + (x0 - w * 0.18) * 0.69, h * 0.96)
        g.stroke()
      }
      // 奶油
      g.fillStyle = c
      for (const [x, y, r] of [
        [0.3, 0.5, 0.17],
        [0.5, 0.48, 0.2],
        [0.7, 0.5, 0.17],
        [0.4, 0.34, 0.16],
        [0.6, 0.34, 0.16],
        [0.5, 0.21, 0.13]
      ]) {
        g.beginPath()
        g.arc(w * x, h * y, w * r, 0, Math.PI * 2)
        g.fill()
      }
      // 樱桃
      g.fillStyle = '#e8364f'
      g.beginPath()
      g.arc(w * 0.5, h * 0.09, w * 0.08, 0, Math.PI * 2)
      g.fill()
      // 糖粒
      const cols = ['#ffd23f', '#4cc3ff', '#7ed957', '#ffffff']
      for (let i = 0; i < 14; i++) {
        g.save()
        g.fillStyle = cols[i % cols.length]
        g.translate(w * (0.25 + ((i * 37) % 50) / 100), h * (0.22 + ((i * 53) % 30) / 100))
        g.rotate(i)
        g.fillRect(-8, -3, 16, 6)
        g.restore()
      }
    }
  },
  cake: {
    label: '蛋糕',
    w: 480,
    h: 420,
    draw: (g, w, h, c, c2) => {
      g.fillStyle = c2
      g.fillRect(w * 0.12, h * 0.55, w * 0.76, h * 0.38)
      g.fillStyle = c
      g.fillRect(w * 0.12, h * 0.5, w * 0.76, h * 0.1)
      // 奶油滴落
      for (let i = 0; i < 7; i++) {
        g.beginPath()
        g.arc(w * (0.17 + i * 0.11), h * 0.6, w * 0.045, 0, Math.PI)
        g.fill()
      }
      g.fillRect(w * 0.24, h * 0.3, w * 0.52, h * 0.22)
      g.fillStyle = c2
      g.fillRect(w * 0.24, h * 0.42, w * 0.52, h * 0.1)
      // 蜡烛
      for (const x of [0.38, 0.5, 0.62]) {
        g.fillStyle = '#ffffff'
        g.fillRect(w * x - 6, h * 0.14, 12, h * 0.16)
        g.fillStyle = '#ffb703'
        g.beginPath()
        g.ellipse(w * x, h * 0.1, 9, 16, 0, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = 'rgba(0,0,0,0.12)'
      g.fillRect(w * 0.05, h * 0.93, w * 0.9, h * 0.04)
    }
  },
  macaron: {
    label: '马卡龙',
    w: 400,
    h: 300,
    draw: (g, w, h, c, c2) => {
      const shell = (y: number): void => {
        g.fillStyle = c
        g.beginPath()
        g.ellipse(w / 2, y, w * 0.44, h * 0.2, 0, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = 'rgba(255,255,255,0.35)'
        g.beginPath()
        g.ellipse(w * 0.4, y - h * 0.07, w * 0.18, h * 0.05, 0, 0, Math.PI * 2)
        g.fill()
      }
      shell(h * 0.68)
      g.fillStyle = c2
      g.beginPath()
      g.ellipse(w / 2, h * 0.5, w * 0.4, h * 0.1, 0, 0, Math.PI * 2)
      g.fill()
      shell(h * 0.32)
    }
  },
  burst: {
    label: '价格爆炸贴',
    w: 512,
    h: 512,
    draw: (g, w, h, c, c2) => {
      g.translate(w / 2, h / 2)
      g.fillStyle = c
      g.beginPath()
      const n = 20
      for (let i = 0; i < n * 2; i++) {
        const r = i % 2 ? w * 0.4 : w * 0.48
        const a = (i * Math.PI) / n
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      g.closePath()
      g.fill()
      g.strokeStyle = c2
      g.lineWidth = 8
      g.setLineDash([14, 10])
      g.beginPath()
      g.arc(0, 0, w * 0.34, 0, Math.PI * 2)
      g.stroke()
    }
  },
  ribbon: {
    label: '丝带横幅',
    w: 800,
    h: 200,
    draw: (g, w, h, c, c2) => {
      g.fillStyle = c2
      for (const s of [-1, 1]) {
        const x = s < 0 ? 0 : w
        g.beginPath()
        g.moveTo(x, h * 0.35)
        g.lineTo(x - s * w * 0.16, h * 0.35)
        g.lineTo(x - s * w * 0.16, h * 0.9)
        g.lineTo(x, h * 0.9)
        g.lineTo(x - s * w * 0.06, h * 0.62)
        g.closePath()
        g.fill()
      }
      g.fillStyle = c
      g.fillRect(w * 0.1, h * 0.15, w * 0.8, h * 0.6)
      g.fillStyle = 'rgba(0,0,0,0.18)'
      g.beginPath()
      g.moveTo(w * 0.1, h * 0.75)
      g.lineTo(w * 0.16, h * 0.75)
      g.lineTo(w * 0.16, h * 0.9)
      g.closePath()
      g.moveTo(w * 0.9, h * 0.75)
      g.lineTo(w * 0.84, h * 0.75)
      g.lineTo(w * 0.84, h * 0.9)
      g.closePath()
      g.fill()
    }
  },
  dots: {
    label: '圆点',
    w: 256,
    h: 256,
    draw: (g, w, h, c) => {
      g.fillStyle = c
      g.beginPath()
      g.arc(w / 2, h / 2, w * 0.45, 0, Math.PI * 2)
      g.fill()
    }
  },
  leafBranch: {
    label: '枝叶',
    w: 512,
    h: 256,
    draw: (g, w, h, c) => {
      g.strokeStyle = c
      g.fillStyle = c
      g.lineWidth = 5
      g.beginPath()
      g.moveTo(w * 0.02, h * 0.7)
      g.quadraticCurveTo(w * 0.5, h * 0.35, w * 0.98, h * 0.55)
      g.stroke()
      for (let i = 1; i < 10; i++) {
        const t = i / 10
        const x = w * (0.02 + t * 0.96)
        const y = h * (0.7 - Math.sin(t * Math.PI) * 0.22 - t * 0.0)
        for (const s of [-1, 1]) {
          g.save()
          g.translate(x, y)
          g.rotate(s * 0.9 - 0.3)
          g.beginPath()
          g.ellipse(0, -h * 0.12 * s, h * 0.05, h * 0.12, 0, 0, Math.PI * 2)
          g.fill()
          g.restore()
        }
      }
    }
  }
}

const cache = new Map<string, HTMLCanvasElement>()

export function clearDecorCache(): void {
  cache.clear()
}

export function decorCanvas(name: string, color = '#ffffff', color2 = '#ffd88a'): HTMLCanvasElement {
  const key = `${name}|${color}|${color2}`
  let c = cache.get(key)
  if (c) return c
  const def = DECORS[name] ?? DECORS.star
  c = document.createElement('canvas')
  c.width = def.w
  c.height = def.h
  const g = c.getContext('2d')!
  def.draw(g, def.w, def.h, color, color2)
  cache.set(key, c)
  return c
}
