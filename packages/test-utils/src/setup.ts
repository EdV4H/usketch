import '@testing-library/jest-dom/vitest'
import { vi, beforeAll, afterAll, afterEach } from 'vitest'

/**
 * グローバルなテストセットアップ
 * 既存のsrc/test/setup.tsを拡張し、より包括的なモックを提供
 */

// matchMediaのモック
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ResizeObserverのモック
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// IntersectionObserverのモック
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}))

// MutationObserverのモック
global.MutationObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
}))

// requestAnimationFrameのモック
global.requestAnimationFrame = vi.fn().mockImplementation((callback) => {
  return setTimeout(() => callback(Date.now()), 0)
})

global.cancelAnimationFrame = vi.fn().mockImplementation((id) => {
  clearTimeout(id)
})

// getComputedStyleのモック強化
const originalGetComputedStyle = window.getComputedStyle
window.getComputedStyle = vi.fn().mockImplementation((element) => {
  const style = originalGetComputedStyle(element)
  // Canvas要素のデフォルトスタイル
  if (element.tagName === 'CANVAS') {
    return {
      ...style,
      width: '800px',
      height: '600px',
    }
  }
  return style
})

// URLのポリフィル（Node.js環境用）
if (!globalThis.URL) {
  globalThis.URL = URL
}

// Performance APIのモック
if (!globalThis.performance) {
  // @ts-expect-error - Performance APIのモック
  globalThis.performance = {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  }
}

// カスタムエラーハンドリング
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeAll(() => {
  // 開発ビルドの警告を抑制
  console.error = (...args) => {
    const patterns = [
      /Warning: ReactDOM.render is no longer supported/,
      /Warning: Can't perform a React state update on an unmounted component/,
      /ResizeObserver loop limit exceeded/,
    ]
    
    const message = args[0]?.toString() || ''
    if (patterns.some(pattern => pattern.test(message))) {
      return
    }
    
    originalConsoleError.call(console, ...args)
  }

  console.warn = (...args) => {
    const patterns = [
      /Vitest encountered an error/,
      /experimental feature/,
    ]
    
    const message = args[0]?.toString() || ''
    if (patterns.some(pattern => pattern.test(message))) {
      return
    }
    
    originalConsoleWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

// テスト間のクリーンアップ
afterEach(() => {
  // ローカルストレージのクリア
  if (typeof window !== 'undefined') {
    window.localStorage.clear()
    window.sessionStorage.clear()
  }
  
  // DOMのクリーンアップ
  if (typeof document !== 'undefined') {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  }
  
  // すべてのタイマーをクリア
  vi.clearAllTimers()
  
  // すべてのモックをリセット
  vi.clearAllMocks()
})

// グローバルなテストヘルパー
declare global {
  var testHelpers: {
    delay: (ms: number) => Promise<void>
    nextTick: () => Promise<void>
    flushPromises: () => Promise<void>
  }
}

global.testHelpers = {
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  nextTick: () => new Promise(resolve => process.nextTick(resolve)),
  flushPromises: () => new Promise(resolve => setImmediate(resolve)),
}