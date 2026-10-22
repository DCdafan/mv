/// <reference types="vite/client" />
import type { MvApi } from '../../preload/index'

declare global {
  interface Window {
    mv: MvApi
  }
}
export {}
