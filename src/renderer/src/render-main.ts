// 导出渲染窗口：逐帧渲染 → WebCodecs H.264 硬件编码 → mp4-muxer 封装 → 分块写盘（主进程再用 FFmpeg 合成音乐）
import { Muxer, StreamTarget } from 'mp4-muxer'
import { Renderer } from './engine/renderer'
import { getTemplate } from './templates'
import { loadAllFonts } from './engine/text'
import { projectDuration } from '@shared/types'

async function pickCodec(w: number, h: number, fps: number, bitrate: number): Promise<VideoEncoderConfig> {
  const big = w * h > 1920 * 1088
  const levels = big ? (fps > 30 ? ['avc1.640034', 'avc1.640033'] : ['avc1.640033', 'avc1.640034']) : fps > 30 ? ['avc1.64002a', 'avc1.640032'] : ['avc1.640028', 'avc1.640032']
  const candidates: VideoEncoderConfig[] = []
  for (const codec of [...levels, 'avc1.4d0033', 'avc1.42003e']) {
    for (const hw of ['prefer-hardware', 'no-preference'] as const) {
      candidates.push({ codec, width: w, height: h, bitrate, framerate: fps, hardwareAcceleration: hw, avc: { format: 'avc' }, latencyMode: 'quality', bitrateMode: 'variable' })
    }
  }
  for (const c of candidates) {
    try {
      const s = await VideoEncoder.isConfigSupported(c)
      if (s.supported) return s.config ?? c
    } catch {
      /* 继续尝试下一个 */
    }
  }
  throw new Error('当前系统不支持 H.264 编码')
}

async function run(): Promise<void> {
  const id = new URLSearchParams(location.search).get('job')!
  const job = await window.mv.render.getJob(id)
  if (!job) throw new Error('找不到导出任务')
  const { project, options, brand } = job
  const { width: W, height: H, fps, bitrate } = options
  const total = projectDuration(project)
  const frames = Math.max(1, Math.round(total * fps))

  await loadAllFonts()
  const canvas = document.createElement('canvas')
  const renderer = new Renderer(canvas, { maxTextureSize: Math.max(2048, Math.min(4096, Math.max(W, H) * 1.6)), useOriginals: Math.max(W, H) > 2048, preserveDrawingBuffer: true, exact: true })
  renderer.setSize(W, H)
  renderer.setProject(project, getTemplate(project.templateId), brand)

  // 分块写盘，控制在途数据量
  let pending: Promise<void>[] = []
  const muxer = new Muxer({
    target: new StreamTarget({
      onData: (data, position) => {
        pending.push(window.mv.render.chunk(id, position, new Uint8Array(data)))
      },
      chunked: true,
      chunkSize: 4 * 1024 * 1024
    }),
    video: { codec: 'avc', width: W, height: H, frameRate: fps },
    fastStart: false,
    firstTimestampBehavior: 'offset'
  })

  let encodeError: Error | null = null
  const config = await pickCodec(W, H, fps, bitrate)
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e
    }
  })
  encoder.configure(config)

  const t0 = performance.now()
  let lastReport = 0
  for (let i = 0; i < frames; i++) {
    if (encodeError) throw encodeError
    const t = i / fps
    await renderer.prepareExact(t, fps)
    renderer.render(t)
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) })
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
    frame.close()
    while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 1))
    if (pending.length > 24) {
      await Promise.all(pending)
      pending = []
    }
    const now = performance.now()
    if (now - lastReport > 250) {
      lastReport = now
      window.mv.render.progress(id, i / frames, (i + 1) / ((now - t0) / 1000))
    }
  }
  await encoder.flush()
  if (encodeError) throw encodeError
  encoder.close()
  muxer.finalize()
  await Promise.all(pending)
  renderer.dispose()
  window.mv.render.finished(id)
}

run().catch((e) => {
  console.error(e)
  const id = new URLSearchParams(location.search).get('job') ?? ''
  window.mv.render.error(id, String(e?.message || e))
})
