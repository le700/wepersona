/**
 * 预加载环境类型声明
 */

import { ElectronAPI } from './preload'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
