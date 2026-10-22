import { analyzeSamples } from './beat'

self.onmessage = (e: MessageEvent<{ samples: Float32Array; sr: number }>) => {
  try {
    const result = analyzeSamples(e.data.samples, e.data.sr)
    ;(self as unknown as Worker).postMessage({ ok: true, result })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ ok: false, error: String(err) })
  }
}
