export type GL = WebGL2RenderingContext

export function compile(gl: GL, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error('Shader compile error: ' + log + '\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'))
  }
  return sh
}

export class Program {
  readonly prog: WebGLProgram
  private locs = new Map<string, WebGLUniformLocation | null>()

  constructor(private gl: GL, vs: string, fs: string) {
    const p = gl.createProgram()!
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs))
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
    gl.bindAttribLocation(p, 0, 'aPos')
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program link error: ' + gl.getProgramInfoLog(p))
    this.prog = p
  }

  use(): this {
    this.gl.useProgram(this.prog)
    return this
  }

  loc(name: string): WebGLUniformLocation | null {
    if (!this.locs.has(name)) this.locs.set(name, this.gl.getUniformLocation(this.prog, name))
    return this.locs.get(name)!
  }

  f1(n: string, v: number): this {
    this.gl.uniform1f(this.loc(n), v)
    return this
  }
  f2(n: string, a: number, b: number): this {
    this.gl.uniform2f(this.loc(n), a, b)
    return this
  }
  f3(n: string, a: number, b: number, c: number): this {
    this.gl.uniform3f(this.loc(n), a, b, c)
    return this
  }
  f4(n: string, a: number, b: number, c: number, d: number): this {
    this.gl.uniform4f(this.loc(n), a, b, c, d)
    return this
  }
  i1(n: string, v: number): this {
    this.gl.uniform1i(this.loc(n), v)
    return this
  }
}

export class FBO {
  fb: WebGLFramebuffer
  tex: WebGLTexture
  constructor(private gl: GL, public w: number, public h: number) {
    this.tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }
  bind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fb)
    this.gl.viewport(0, 0, this.w, this.h)
  }
  dispose(): void {
    this.gl.deleteFramebuffer(this.fb)
    this.gl.deleteTexture(this.tex)
  }
}

export function createTexture(gl: GL, source: TexImageSource, mipmap = true): WebGLTexture {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  if (mipmap) {
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  }
  return tex
}
