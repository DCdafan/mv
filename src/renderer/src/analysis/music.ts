import type { MusicAnalysis } from '@shared/types'
import { fileUrl } from '../engine/textures'
import BeatWorker from './beat.worker?worker'

const SR = 22050
const cache = new Map<string, Promise<MusicAnalysis>>()
const bufferCache = new Map<string, Promise<AudioBuffer>>()

let audioCtx: AudioContext | null = null
export function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

/** 解码音频（播放用，保留原采样率） */
export function decodeMusic(path: string): Promise<AudioBuffer> {
  let p = bufferCache.get(path)
  if (!p) {
    p = fetch(fileUrl(path))
      .then((r) => {
        if (!r.ok) throw new Error('无法读取音乐文件')
        return r.arrayBuffer()
      })
      .then((buf) => getAudioContext().decodeAudioData(buf))
    p.catch(() => bufferCache.delete(path))
    bufferCache.set(path, p)
  }
  return p
}

/** 分析节拍、能量和波形（结果按路径缓存） */
export function analyzeMusic(path: string): Promise<MusicAnalysis> {
  let p = cache.get(path)
  if (!p) {
    p = (async () => {
      const buffer = await decodeMusic(path)
      // 下混为单声道并重采样到 22050Hz
      const len = Math.ceil(buffer.duration * SR)
      const off = new OfflineAudioContext(1, len, SR)
      const src = off.createBufferSource()
      src.buffer = buffer
      src.connect(off.destination)
      src.start()
      const rendered = await off.startRendering()
      const samples = rendered.getChannelData(0).slice()
      return new Promise<MusicAnalysis>((resolve, reject) => {
        const w = new BeatWorker()
        w.onmessage = (e) => {
          w.terminate()
          if (e.data.ok) resolve(e.data.result)
          else reject(new Error(e.data.error))
        }
        w.onerror = (e) => {
          w.terminate()
          reject(new Error(e.message))
        }
        w.postMessage({ samples, sr: SR }, [samples.buffer])
      })
    })()
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return p
}
