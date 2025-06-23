import { vi } from 'vitest'

/**
 * Create a mock DOM element with specified properties
 */
export function createMockElement(tag: string, attributes: Record<string, string> = {}): HTMLElement {
  const element = document.createElement(tag)
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value)
  })
  return element
}

/**
 * Mock DOM event with default properties
 */
export function createMockEvent(type: string, properties: Record<string, any> = {}): Event {
  const event = new Event(type)
  Object.assign(event, properties)
  return event
}

/**
 * Wait for next tick in tests
 */
export const nextTick = () => new Promise(resolve => setTimeout(resolve, 0))

/**
 * Mock localStorage for testing
 */
export const mockLocalStorage = () => {
  const store: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
    length: 0,
    key: vi.fn(),
  }
}