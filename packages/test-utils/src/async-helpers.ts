/**
 * 非同期処理関連のヘルパー関数
 */

/**
 * Wait for next tick in tests
 */
export const nextTick = (): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, 0))

/**
 * Wait for specified milliseconds
 */
export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms))

/**
 * Flush all pending promises
 */
export const flushPromises = (): Promise<void> => 
  new Promise(resolve => setImmediate(resolve))

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number
    interval?: number
    message?: string
  } = {}
): Promise<void> {
  const { timeout = 1000, interval = 50, message = 'Condition not met' } = options
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    const result = await condition()
    if (result) {
      return
    }
    await delay(interval)
  }
  
  throw new Error(`${message} within ${timeout}ms`)
}

/**
 * Wait until a value changes
 */
export async function waitForValueChange<T>(
  getValue: () => T,
  options: {
    timeout?: number
    interval?: number
    message?: string
  } = {}
): Promise<T> {
  const initialValue = getValue()
  let currentValue = initialValue
  
  await waitFor(
    () => {
      currentValue = getValue()
      return currentValue !== initialValue
    },
    options
  )
  
  return currentValue
}

/**
 * Retry a function until it succeeds
 */
export async function retry<T>(
  fn: () => T | Promise<T>,
  options: {
    maxAttempts?: number
    delay?: number
    backoff?: boolean
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay: delayMs = 100, backoff = true } = options
  let lastError: Error | undefined
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts) {
        const waitTime = backoff ? delayMs * attempt : delayMs
        await delay(waitTime)
      }
    }
  }
  
  throw lastError || new Error('Retry failed')
}

/**
 * Create a deferred promise
 */
export function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: any) => void
} {
  let resolve: (value: T) => void
  let reject: (reason?: any) => void
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  }
}

/**
 * Wait for animation frame
 */
export const waitForAnimationFrame = (): Promise<number> =>
  new Promise(resolve => requestAnimationFrame(resolve))

/**
 * Wait for multiple animation frames
 */
export async function waitForAnimationFrames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await waitForAnimationFrame()
  }
}

/**
 * Create a timeout promise
 */
export function timeout<T>(
  promise: Promise<T>,
  ms: number,
  message = `Operation timed out after ${ms}ms`
): Promise<T> {
  return Promise.race([
    promise,
    delay(ms).then(() => {
      throw new Error(message)
    }),
  ])
}

/**
 * Run a function with fake timers
 */
export async function runWithFakeTimers<T>(
  fn: () => T | Promise<T>
): Promise<T> {
  const { vi } = await import('vitest')
  
  vi.useFakeTimers()
  try {
    const result = fn()
    if (result instanceof Promise) {
      vi.runAllTimers()
      return await result
    }
    return result
  } finally {
    vi.useRealTimers()
  }
}

/**
 * Create a mock async function with controlled resolution
 */
export function createControllableAsync<TArgs extends any[], TReturn>(
  implementation?: (...args: TArgs) => TReturn
): {
  fn: (...args: TArgs) => Promise<TReturn>
  resolve: (value: TReturn) => void
  reject: (error: Error) => void
  reset: () => void
} {
  const { vi } = require('vitest')
  let deferred = createDeferred<TReturn>()
  
  const fn = vi.fn(async (...args: TArgs) => {
    if (implementation) {
      implementation(...args)
    }
    return deferred.promise
  })
  
  return {
    fn,
    resolve: (value: TReturn) => deferred.resolve(value),
    reject: (error: Error) => deferred.reject(error),
    reset: () => {
      deferred = createDeferred<TReturn>()
      fn.mockClear()
    },
  }
}