import type { BrandSettings, PhotoAsset, Project, Scene } from '@shared/types'
import { projectDuration } from '@shared/types'
import { FBO, Program, type GL, createTexture } from './gl'
import { LAYER_VS, LAYER_FS, FULL_VS, POST_FS, COPY_FS, PARTICLE_VS, PARTICLE_FS } from './shaders'
import { TRANSITION_MAP, transitionFragment } from './transitions'
import { buildParticleAtlas, simulateParticles } from './particles'
import { PhotoTextures, CanvasTextures, type TexInfo } from './textures'
import { rasterizeText, loadFont, isFontLoaded } from './text'
import { decorCanvas, DECORS, clearDecorCache } from './decor'
import { evalLayer, photoUvRect, resolveMotion } from './anim'
import { clamp, parseColor, strHash } from './math'
import type { BgFill, Grade, Layer, MaskType, ParticleConfig, PhotoLayer, SceneStyle, Template, TextLayer } from './types'
import { DEFAULT_GRADE } from './types'

const MASK_ID: Record<MaskType, number> = { rect: 0, round: 1, ellipse: 2, heart: 3, arch: 4, diamond: 5, hexagon: 6, circle: 7 }
const PATTERN_ID = { paper: 0, dots: 1, grid: 2, lines: 3, film: 4 }
const MAX_PARTICLES = 1200

export interface RendererOptions {
  maxTextureSize: number
  useOriginals: boolean
  preserveDrawingBuffer?: boolean
}

export function findStyle(tpl: Template, id: string): SceneStyle {
  if (tpl.intro.id === id) return tpl.intro
  if (tpl.outro.id === id) return tpl.outro
  return tpl.styles.find((s) => s.id === id) ?? tpl.styles.find((s) => s.slots.length === 1) ?? tpl.styles[0]
}

export class Renderer {
  readonly gl: GL
  private layerProg: Program
  private postProg: Program
  private copyProg: Program
  private particleProg: Program
  private transProgs = new Map<string, Program>()
  private quad: WebGLVertexArrayObject
  private partVao: WebGLVertexArrayObject
  private partBuf: WebGLBuffer
  private partData = new Float32Array(MAX_PARTICLES * 11)
  private atlas: WebGLTexture
  private white: WebGLTexture
  private fboA!: FBO
  private fboB!: FBO
  private fboC!: FBO
  private W = 0
  private H = 0
  photos: PhotoTextures
  private canvasTex: CanvasTextures
  private project: Project | null = null
  private template: Template | null = null
  private brand: BrandSettings | null = null
  private photoMap = new Map<string, PhotoAsset>()
  private layerCache = new Map<string, Layer[]>()
  private grade: Grade = DEFAULT_GRADE
  onNeedsRedraw?: () => void

  constructor(readonly canvas: HTMLCanvasElement | OffscreenCanvas, private opts: RendererOptions) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: !!opts.preserveDrawingBuffer
    }) as GL | null
    if (!gl) throw new Error('当前设备不支持 WebGL2')
    this.gl = gl
    this.layerProg = new Program(gl, LAYER_VS, LAYER_FS)
    this.postProg = new Program(gl, FULL_VS, POST_FS)
    this.copyProg = new Program(gl, FULL_VS, COPY_FS)
    this.particleProg = new Program(gl, PARTICLE_VS, PARTICLE_FS)

    this.quad = gl.createVertexArray()!
    gl.bindVertexArray(this.quad)
    const qb = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, qb)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    this.partVao = gl.createVertexArray()!
    gl.bindVertexArray(this.partVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, qb)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    this.partBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf)
    gl.bufferData(gl.ARRAY_BUFFER, this.partData.byteLength, gl.DYNAMIC_DRAW)
    const stride = 11 * 4
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0)
    gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16)
    gl.vertexAttribDivisor(2, 1)
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 32)
    gl.vertexAttribDivisor(3, 1)
    gl.bindVertexArray(null)

    this.atlas = createTexture(gl, buildParticleAtlas(), true)
    const w = document.createElement('canvas')
    w.width = w.height = 2
    w.getContext('2d')!.fillStyle = '#fff'
    w.getContext('2d')!.fillRect(0, 0, 2, 2)
    this.white = createTexture(gl, w, false)

    this.photos = new PhotoTextures(gl, opts.maxTextureSize, opts.useOriginals)
    this.photos.onLoaded = () => this.onNeedsRedraw?.()
    this.canvasTex = new CanvasTextures(gl)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  setSize(w: number, h: number): void {
    w = Math.max(2, Math.round(w))
    h = Math.max(2, Math.round(h))
    if (w === this.W && h === this.H) return
    this.W = w
    this.H = h
    this.canvas.width = w
    this.canvas.height = h
    this.fboA?.dispose()
    this.fboB?.dispose()
    this.fboC?.dispose()
    this.fboA = new FBO(this.gl, w, h)
    this.fboB = new FBO(this.gl, w, h)
    this.fboC = new FBO(this.gl, w, h)
    this.layerCache.clear()
    this.canvasTex.clear()
  }

  setProject(project: Project, template: Template, brand: BrandSettings | null): void {
    if (this.template !== template || this.project?.aspect !== project.aspect) this.layerCache.clear()
    this.project = project
    this.template = template
    this.brand = brand
    this.photoMap = new Map(project.photos.map((p) => [p.id, p]))
    this.grade = { ...DEFAULT_GRADE, ...template.grade }
    // 字体是异步加载的：加载完后清掉用回退字体画的文字纹理再重画
    const fonts = [template.fonts.title, template.fonts.body, template.fonts.script, 'MaShanZheng' as const].filter(Boolean) as Parameters<typeof loadFont>[0][]
    const pending = fonts.filter((f) => !isFontLoaded(f))
    if (pending.length) {
      Promise.all(pending.map(loadFont)).then(() => {
        clearDecorCache()
        this.canvasTex.clear()
        this.onNeedsRedraw?.()
      })
    }
  }

  get size(): [number, number] {
    return [this.W, this.H]
  }

  // ---------- 场景与时间 ----------

  /** 某一时刻需要画哪些场景 */
  activeAt(t: number): { a: number; b: number; p: number } {
    const scenes = this.project?.scenes ?? []
    if (!scenes.length) return { a: -1, b: -1, p: 0 }
    let i = scenes.findIndex((s) => t >= s.start && t < s.start + s.duration)
    if (i < 0) i = t < scenes[0].start ? 0 : scenes.length - 1
    const s = scenes[i]
    const end = s.start + s.duration
    if (i < scenes.length - 1) {
      const d = this.transDur(i)
      if (d > 0 && t >= end - d / 2) return { a: i, b: i + 1, p: (t - (end - d / 2)) / d }
    }
    if (i > 0) {
      const d = this.transDur(i - 1)
      if (d > 0 && t < s.start + d / 2) return { a: i - 1, b: i, p: (t - (s.start - d / 2)) / d }
    }
    return { a: i, b: -1, p: 0 }
  }

  private transDur(i: number): number {
    const scenes = this.project!.scenes
    const tr = scenes[i].transition
    if (!tr || tr.name === 'cut' || !TRANSITION_MAP.has(tr.name)) return 0
    return Math.min(tr.duration, scenes[i].duration * 0.8, scenes[i + 1].duration * 0.8)
  }

  /** 预加载某时间段内需要的照片，返回全部就绪的 Promise（导出时逐帧等待） */
  prepare(t0: number, t1 = t0): Promise<void> {
    const scenes = this.project?.scenes ?? []
    const jobs: Promise<void>[] = []
    for (const s of scenes) {
      if (s.start + s.duration + 2 < t0 || s.start - 2 > t1) continue
      for (const id of s.photos) {
        const p = id ? this.photoMap.get(id) : undefined
        if (p) jobs.push(this.photos.request(p))
      }
    }
    return Promise.all(jobs).then(() => undefined)
  }

  // ---------- 渲染入口 ----------

  render(t: number): void {
    const gl = this.gl
    if (!this.project || !this.template) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, this.W, this.H)
      gl.clearColor(0.08, 0.08, 0.09, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return
    }
    this.prepare(t, t + 3)
    const { a, b, p } = this.activeAt(t)
    const scenes = this.project.scenes
    if (a < 0) {
      this.fboC.bind()
      const [r, g, bl] = parseColor(this.template.palette.bg)
      gl.clearColor(r, g, bl, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    } else if (b < 0) {
      this.drawScene(scenes[a], t - scenes[a].start, this.fboC)
    } else {
      this.drawScene(scenes[a], t - scenes[a].start, this.fboA)
      this.drawScene(scenes[b], t - scenes[b].start, this.fboB)
      this.drawTransition(scenes[a].transition.name, p, t)
    }
    // 模板全局粒子
    if (this.project.settings.particles && this.template.overlay?.length) {
      this.fboC.bind()
      for (const cfg of this.template.overlay) this.drawParticles(cfg, t, 1)
    }
    this.drawWatermark()
    // 后期：暗角、颗粒、漏光、整体淡入淡出
    const total = projectDuration(this.project)
    const fade = Math.max(clamp(1 - t / 0.6), clamp((t - (total - 1.2)) / 1.2))
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.W, this.H)
    gl.disable(gl.BLEND)
    const pp = this.postProg.use()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.fboC.tex)
    pp.i1('uTex', 0)
      .f2('uRes', this.W, this.H)
      .f1('uTime', t)
      .f1('uVignette', this.template.post.vignette)
      .f1('uGrain', this.template.post.grain)
      .f1('uLeak', this.template.post.leak)
      .f1('uFade', fade)
    gl.bindVertexArray(this.quad)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.enable(gl.BLEND)
  }

  /** 只渲染单个场景的某一帧（缩略图、模板预览用） */
  renderSceneFrame(scene: Scene, lt: number): void {
    if (!this.project || !this.template) return
    this.drawScene(scene, lt, this.fboC)
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.W, this.H)
    gl.disable(gl.BLEND)
    const cp = this.copyProg.use()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.fboC.tex)
    cp.i1('uTex', 0)
    gl.bindVertexArray(this.quad)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.enable(gl.BLEND)
  }

  private drawTransition(name: string, p: number, t: number): void {
    const gl = this.gl
    let prog = this.transProgs.get(name)
    if (!prog) {
      const def = TRANSITION_MAP.get(name) ?? TRANSITION_MAP.get('fade')!
      prog = new Program(gl, FULL_VS, transitionFragment(def))
      this.transProgs.set(name, prog)
    }
    this.fboC.bind()
    gl.disable(gl.BLEND)
    prog.use()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.fboA.tex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.fboB.tex)
    prog.i1('uFrom', 0).i1('uTo', 1).f1('progress', clamp(p)).f1('ratio', this.W / this.H).f1('uTime', t)
    gl.bindVertexArray(this.quad)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.enable(gl.BLEND)
  }

  // ---------- 场景绘制 ----------

  private layersFor(scene: Scene): Layer[] {
    const tpl = this.template!
    const style = findStyle(tpl, scene.styleId)
    const orient = style.slots.map((_, i) => {
      const id = scene.photos[i]
      return id ? this.photoMap.get(id)?.orientation ?? null : null
    })
    const key = `${style.id}|${this.project!.aspect}|${scene.seed}|${scene.duration.toFixed(2)}|${orient.join(',')}`
    let layers = this.layerCache.get(key)
    if (!layers) {
      let s = scene.seed >>> 0
      const rand = (): number => {
        s = (s + 0x6d2b79f5) >>> 0
        let x = Math.imul(s ^ (s >>> 15), s | 1)
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296
      }
      layers = style.build({
        aspect: this.project!.aspect,
        W: this.W,
        H: this.H,
        ar: this.W / this.H,
        seed: scene.seed,
        dur: scene.duration,
        rand,
        t: tpl.palette,
        fonts: tpl.fonts,
        orient
      })
      this.layerCache.set(key, layers)
    }
    return layers
  }

  private drawScene(scene: Scene, lt: number, fbo: FBO): void {
    const gl = this.gl
    fbo.bind()
    const [r, g, b] = parseColor(this.template!.palette.bg)
    gl.clearColor(r, g, b, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    const layers = this.layersFor(scene)
    if (!layers.length || layers[0].type !== 'bg') this.drawBg({ kind: 'template' }, scene, { x: 0, y: 0, w: 1, h: 1 }, 1, null)
    layers.forEach((layer, idx) => {
      const st = evalLayer(layer, lt, scene.duration, this.W, this.H)
      if (st.alpha <= 0.002) return
      switch (layer.type) {
        case 'bg':
          this.drawBg(layer.fill, scene, layer.rect, st.alpha, st)
          break
        case 'photo':
          this.drawPhoto(layer, scene, lt, st, idx)
          break
        case 'shape':
          this.drawShape(layer, st)
          break
        case 'text':
          this.drawText(layer, scene, st)
          break
        case 'decor':
          this.drawDecor(layer.decor, layer.color, layer.color2, layer.rect, st)
          break
        case 'particles':
          this.drawParticles(layer.particles, lt, st.alpha)
          break
      }
    })
  }

  private geom(rect: { x: number; y: number; w: number; h: number }): { cx: number; cy: number; w: number; h: number } {
    const w = rect.w * this.W
    const h = rect.h * this.H
    return { cx: rect.x * this.W + w / 2, cy: rect.y * this.H + h / 2, w, h }
  }

  private setCommon(
    prog: Program,
    cx: number,
    cy: number,
    quadW: number,
    quadH: number,
    st: { sx: number; sy: number; rot: number } | null
  ): void {
    prog
      .f2('uRes', this.W, this.H)
      .f2('uCenter', cx, cy)
      .f2('uQuad', quadW, quadH)
      .f2('uScale', st?.sx ?? 1, st?.sy ?? 1)
      .f1('uRot', st?.rot ?? 0)
  }

  private resetLayerUniforms(prog: Program): void {
    // 未用到贴图时也绑定一张白纹理，避免与当前帧缓冲形成反馈回路
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.white)
    prog
      .i1('uMask', 0)
      .f1('uRadius', 0)
      .f1('uBorder', 0)
      .f1('uStroke', 0)
      .f1('uSoft', 0)
      .f1('uReveal', 1)
      .i1('uGrade', 0)
      .f4('uUvRect', 0, 0, 1, 1)
      .i1('uTex', 0)
  }

  private drawQuad(): void {
    this.gl.bindVertexArray(this.quad)
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }

  private drawBg(fill: BgFill, scene: Scene, rect: { x: number; y: number; w: number; h: number }, alpha: number, st: { sx: number; sy: number; rot: number } | null): void {
    if (fill.kind === 'template') fill = this.template!.background
    const prog = this.layerProg.use()
    this.resetLayerUniforms(prog)
    const g = this.geom(rect)
    this.setCommon(prog, g.cx, g.cy, g.w, g.h, st)
    prog.f2('uSize', g.w, g.h).f1('uOpacity', alpha)
    if (fill.kind === 'color') {
      const c = parseColor(fill.color)
      prog.i1('uMode', 1).f4('uColor', ...c).f4('uColor2', ...c).f1('uGradAngle', 0)
    } else if (fill.kind === 'gradient') {
      prog
        .i1('uMode', 1)
        .f4('uColor', ...parseColor(fill.colors[0]))
        .f4('uColor2', ...parseColor(fill.colors[1]))
        .f1('uGradAngle', (((fill.angle ?? 90) as number) * Math.PI) / 180)
    } else if (fill.kind === 'radial') {
      prog.i1('uMode', 3).f4('uColor', ...parseColor(fill.colors[0])).f4('uColor2', ...parseColor(fill.colors[1]))
    } else if (fill.kind === 'pattern') {
      prog
        .i1('uMode', 4)
        .i1('uPattern', PATTERN_ID[fill.pattern])
        .f4('uColor', ...parseColor(fill.color))
        .f4('uColor2', ...parseColor(fill.color2))
    } else if (fill.kind === 'blurPhoto') {
      const id = scene.photos[fill.slot] ?? scene.photos.find((x) => x)
      const photo = id ? this.photoMap.get(id) : undefined
      const e = photo ? this.photos.get(photo) : undefined
      if (e?.blur) {
        const uv = photoUvRect(e.blur.w, e.blur.h, g.w, g.h, { x: 0.5, y: 0.5 }, 'none', 0, 0)
        const gl = this.gl
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, e.blur.tex)
        prog.i1('uMode', 0).f4('uUvRect', ...uv).i1('uGrade', 1)
        this.setGrade(prog, { exposure: -(fill.dim ?? 0.35) * 2 })
        this.drawQuad()
        if (fill.tint) {
          prog.i1('uMode', 1).i1('uGrade', 0).f4('uColor', ...parseColor(fill.tint)).f4('uColor2', ...parseColor(fill.tint))
          this.drawQuad()
        }
        return
      }
      this.drawBg(this.template!.background, scene, rect, alpha, st)
      return
    }
    this.drawQuad()
  }

  private setGrade(prog: Program, extra?: Partial<Grade>): void {
    const g = extra ? { ...this.grade, ...extra, exposure: this.grade.exposure + (extra.exposure ?? 0) } : this.grade
    const sS = parseColor(g.splitShadow)
    const sH = parseColor(g.splitHighlight)
    prog
      .f4('uG1', g.exposure, g.contrast, g.saturation, g.warmth)
      .f4('uG2', g.tint, g.fade, g.mono, g.splitAmount)
      .f3('uSplitS', sS[0], sS[1], sS[2])
      .f3('uSplitH', sH[0], sH[1], sH[2])
  }

  private drawPhoto(layer: PhotoLayer, scene: Scene, lt: number, st: ReturnType<typeof evalLayer>, idx: number): void {
    const gl = this.gl
    const prog = this.layerProg.use()
    this.resetLayerUniforms(prog)
    const g = this.geom(layer.rect)
    const cx = g.cx + st.dx
    const cy = g.cy + st.dy
    const S = Math.min(this.W, this.H)
    const radius = (layer.radius ?? 0) * Math.min(g.w, g.h)
    const mask = MASK_ID[layer.mask ?? (radius > 0 ? 'round' : 'rect')]
    if (layer.shadow) {
      const blur = layer.shadow.blur * S
      const dx = (layer.shadow.dx ?? 0) * S
      const dy = (layer.shadow.dy ?? 0.01) * S
      this.setCommon(prog, cx + dx, cy + dy, g.w + blur * 4, g.h + blur * 4, st)
      prog
        .i1('uMode', 2)
        .f2('uSize', g.w, g.h)
        .i1('uMask', mask)
        .f1('uRadius', radius)
        .f1('uSoft', blur)
        .f4('uColor', ...parseColor(layer.shadow.color ?? '#000000').slice(0, 3) as [number, number, number], layer.shadow.alpha)
        .f1('uOpacity', st.alpha)
      this.drawQuad()
      prog.f1('uSoft', 0)
    }
    this.setCommon(prog, cx, cy, g.w, g.h, st)
    prog.f2('uSize', g.w, g.h).i1('uMask', mask).f1('uRadius', radius).f1('uOpacity', st.alpha)
    if (layer.border) {
      prog.f1('uBorder', layer.border.width * S).f4('uBorderColor', ...parseColor(layer.border.color))
    }
    const id = scene.photos[layer.slot]
    const photo = id ? this.photoMap.get(id) : undefined
    const e = photo ? this.photos.get(photo) : undefined
    if (photo && e?.photo) {
      const pad = 0.6
      const mp = clamp((lt + pad) / (scene.duration + pad * 2))
      const seed = scene.seed + idx * 101 + layer.slot * 7
      const motion = resolveMotion(layer.motion, e.photo.w, e.photo.h, g.w, g.h, seed)
      const focus = scene.focus?.[layer.slot] ?? photo.analysis?.focus ?? { x: 0.5, y: 0.45 }
      let uv: [number, number, number, number]
      if (layer.virtual) {
        const v = this.geom(layer.virtual)
        const vm = resolveMotion(layer.motion, e.photo.w, e.photo.h, v.w, v.h, scene.seed + layer.slot * 7)
        const full = photoUvRect(e.photo.w, e.photo.h, v.w, v.h, focus, vm, layer.motionStrength ?? 1, mp)
        const fx = (layer.rect.x - layer.virtual.x) / layer.virtual.w
        const fy = (layer.rect.y - layer.virtual.y) / layer.virtual.h
        uv = [full[0] + fx * full[2], full[1] + fy * full[3], (layer.rect.w / layer.virtual.w) * full[2], (layer.rect.h / layer.virtual.h) * full[3]]
      } else {
        uv = photoUvRect(e.photo.w, e.photo.h, g.w, g.h, focus, motion, layer.motionStrength ?? 1, mp)
      }
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, e.photo.tex)
      prog.i1('uMode', 0).f4('uUvRect', ...uv).i1('uGrade', 1)
      this.setGrade(prog, layer.grade)
    } else {
      // 占位：照片还没加载或槽位为空
      const c = parseColor(this.template!.palette.primary)
      prog.i1('uMode', 1).f4('uColor', c[0], c[1], c[2], 0.25).f4('uColor2', c[0], c[1], c[2], 0.12).f1('uGradAngle', 1)
    }
    this.drawQuad()
  }

  private drawShape(layer: Extract<Layer, { type: 'shape' }>, st: ReturnType<typeof evalLayer>): void {
    const prog = this.layerProg.use()
    this.resetLayerUniforms(prog)
    const g = this.geom(layer.rect)
    const S = Math.min(this.W, this.H)
    const radius = (layer.radius ?? 0) * Math.min(g.w, g.h)
    const mask = MASK_ID[layer.shape]
    const cx = g.cx + st.dx
    const cy = g.cy + st.dy
    if (layer.shadow) {
      const blur = layer.shadow.blur * S
      this.setCommon(prog, cx + (layer.shadow.dx ?? 0) * S, cy + (layer.shadow.dy ?? 0.01) * S, g.w + blur * 4, g.h + blur * 4, st)
      prog
        .i1('uMode', 2)
        .f2('uSize', g.w, g.h)
        .i1('uMask', mask)
        .f1('uRadius', radius)
        .f1('uSoft', blur)
        .f4('uColor', 0, 0, 0, layer.shadow.alpha)
        .f1('uOpacity', st.alpha)
      this.drawQuad()
      prog.f1('uSoft', 0)
    }
    // 描边时四边形略放大，避免描边被裁掉
    const strokePx = (layer.stroke ?? 0) * S
    this.setCommon(prog, cx, cy, g.w + 4, g.h + 4, st)
    prog
      .i1('uMode', 1)
      .f2('uSize', g.w - (strokePx > 0 ? 0 : 0), g.h)
      .i1('uMask', mask)
      .f1('uRadius', radius)
      .f1('uStroke', strokePx)
      .f4('uColor', ...parseColor(layer.color))
      .f4('uColor2', ...parseColor(layer.color2 ?? layer.color))
      .f1('uGradAngle', ((layer.gradientAngle ?? 90) * Math.PI) / 180)
      .f1('uOpacity', st.alpha)
    this.drawQuad()
  }

  resolveText(layer: TextLayer, scene: Scene): string {
    const p = this.project!
    const key = layer.key
    if (key && scene.texts && scene.texts[key] !== undefined) return scene.texts[key]
    const brand = this.brand
    switch (key) {
      case 'title':
        return p.meta.title
      case 'subtitle':
        return p.meta.subtitle
      case 'date':
        return p.meta.date
      case 'ending':
        return p.meta.ending
      case 'studio':
        return brand?.enabled ? brand.studioName : ''
      case 'slogan':
        return brand?.enabled ? brand.slogan : ''
      case 'phone':
        return brand?.enabled && brand.phone ? `预约热线  ${brand.phone}` : ''
      case 'caption':
        return ''
    }
    return layer.text
  }

  private drawText(layer: TextLayer, scene: Scene, st: ReturnType<typeof evalLayer>): void {
    const text = this.resolveText(layer, scene)
    if (!text.trim()) return
    const S = Math.min(this.W, this.H)
    const g = this.geom(layer.rect)
    const key = `t|${text}|${JSON.stringify(layer.style)}|${S}|${Math.round(g.w)}`
    const info = this.canvasTex.get(key, () => rasterizeText(text, layer.style, S, g.w).canvas)
    const align = layer.style.align ?? 'center'
    const vAlign = layer.style.vAlign ?? 'middle'
    // rasterize 的四周带了 padding，按对齐方式把文字块放进矩形
    const padPx = Math.ceil(
      (layer.style.stroke ? layer.style.stroke.width * layer.style.size * S : 0) +
        (layer.style.shadow ? (layer.style.shadow.blur + Math.max(Math.abs(layer.style.shadow.dx ?? 0), Math.abs(layer.style.shadow.dy ?? 0))) * layer.style.size * S : 0) +
        layer.style.size * S * 0.25
    )
    let cx = g.cx
    if (align === 'left') cx = g.cx - g.w / 2 - padPx + info.w / 2
    else if (align === 'right') cx = g.cx + g.w / 2 + padPx - info.w / 2
    let cy = g.cy
    if (vAlign === 'top') cy = g.cy - g.h / 2 - padPx + info.h / 2
    else if (vAlign === 'bottom') cy = g.cy + g.h / 2 + padPx - info.h / 2
    this.drawTexQuad(info, cx + st.dx, cy + st.dy, info.w, info.h, st, st.reveal)
  }

  private drawDecor(name: string, color: string | undefined, color2: string | undefined, rect: { x: number; y: number; w: number; h: number }, st: ReturnType<typeof evalLayer>): void {
    const def = DECORS[name]
    if (!def) return
    const info = this.canvasTex.get(`d|${name}|${color}|${color2}`, () => decorCanvas(name, color, color2))
    const w = rect.w * this.W
    const h = rect.h > 0 ? rect.h * this.H : (w * def.h) / def.w
    const cx = rect.x * this.W + w / 2
    const cy = rect.y * this.H + h / 2
    this.drawTexQuad(info, cx + st.dx, cy + st.dy, w, h, st, 1)
  }

  private drawTexQuad(info: TexInfo, cx: number, cy: number, w: number, h: number, st: { sx: number; sy: number; rot: number; alpha: number }, reveal: number): void {
    const gl = this.gl
    const prog = this.layerProg.use()
    this.resetLayerUniforms(prog)
    this.setCommon(prog, cx, cy, w, h, st)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, info.tex)
    prog.i1('uMode', 0).f2('uSize', w + 4, h + 4).f1('uOpacity', st.alpha).f1('uReveal', reveal)
    this.drawQuad()
  }

  private drawParticles(cfg: ParticleConfig, t: number, opacity: number): void {
    const gl = this.gl
    const n = simulateParticles(cfg, t, this.W, this.H, opacity, this.partData, 0)
    if (!n) return
    const prog = this.particleProg.use()
    prog.f2('uRes', this.W, this.H).i1('uTex', 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.atlas)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.partData, 0, n * 11)
    gl.bindVertexArray(this.partVao)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n)
    gl.bindVertexArray(null)
  }

  private drawWatermark(): void {
    const brand = this.brand
    if (!brand?.enabled || !brand.watermark || !brand.studioName) return
    this.fboC.bind()
    const S = Math.min(this.W, this.H)
    const style = { font: 'Sans' as const, size: 0.022, color: 'rgba(255,255,255,0.85)', weight: 500, letterSpacing: 0.1, shadow: { color: 'rgba(0,0,0,0.45)', blur: 0.3 } }
    const info = this.canvasTex.get(`wm|${brand.studioName}|${S}`, () => rasterizeText(brand.studioName, style, S, this.W).canvas)
    const margin = S * 0.03
    this.drawTexQuad(info, this.W - margin - info.w / 2, this.H - margin - info.h / 2, info.w, info.h, { sx: 1, sy: 1, rot: 0, alpha: 0.7 }, 1)
  }

  /** 读取当前画面为 ImageBitmap（缩略图） */
  async snapshot(): Promise<ImageBitmap> {
    return createImageBitmap(this.canvas as HTMLCanvasElement)
  }

  dispose(): void {
    this.photos.dispose()
    this.canvasTex.clear()
    const ext = this.gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
  }
}

export { strHash }
