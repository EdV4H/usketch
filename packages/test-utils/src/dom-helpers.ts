import { vi } from 'vitest'

/**
 * DOM操作関連のヘルパー関数
 * 既存のsrc/test/utils.tsから移行・拡張
 */

/**
 * Create a mock DOM element with specified properties
 */
export function createMockElement(
  tag: string,
  attributes: Record<string, string> = {}
): HTMLElement {
  const element = document.createElement(tag)
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value)
  })
  return element
}

/**
 * Create a mock SVG element
 */
export function createMockSVGElement(
  tag: string,
  attributes: Record<string, string> = {}
): SVGElement {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag)
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value)
  })
  return element as SVGElement
}

/**
 * Mock DOM event with default properties
 */
export function createMockEvent(
  type: string,
  properties: Record<string, any> = {}
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, properties)
  return event
}

/**
 * Create a mock MouseEvent
 */
export function createMockMouseEvent(
  type: string,
  properties: Partial<MouseEventInit> = {}
): MouseEvent {
  const defaults: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: 0,
    clientY: 0,
    screenX: 0,
    screenY: 0,
    button: 0,
    buttons: 1,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  }
  
  return new MouseEvent(type, { ...defaults, ...properties })
}

/**
 * Create a mock KeyboardEvent
 */
export function createMockKeyboardEvent(
  type: string,
  properties: Partial<KeyboardEventInit> = {}
): KeyboardEvent {
  const defaults: KeyboardEventInit = {
    bubbles: true,
    cancelable: true,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  }
  
  return new KeyboardEvent(type, { ...defaults, ...properties })
}

/**
 * Create a mock PointerEvent
 */
export function createMockPointerEvent(
  type: string,
  properties: Partial<PointerEventInit> = {}
): PointerEvent {
  const defaults: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    pointerType: 'mouse',
    pressure: 0.5,
    width: 1,
    height: 1,
  }
  
  return new PointerEvent(type, { ...defaults, ...properties })
}

/**
 * Create a mock Touch
 */
export function createMockTouch(properties: Partial<Touch> = {}): Touch {
  const defaults = {
    identifier: 0,
    target: document.body,
    clientX: 0,
    clientY: 0,
    screenX: 0,
    screenY: 0,
    pageX: 0,
    pageY: 0,
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 0,
  }
  
  return { ...defaults, ...properties } as Touch
}

/**
 * Create a mock TouchEvent
 */
export function createMockTouchEvent(
  type: string,
  properties: {
    touches?: Touch[]
    changedTouches?: Touch[]
    targetTouches?: Touch[]
  } & Partial<TouchEventInit> = {}
): TouchEvent {
  const {
    touches = [],
    changedTouches = [],
    targetTouches = [],
    ...eventInit
  } = properties
  
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    ...eventInit,
  })
  
  // TouchListは読み取り専用なので、Object.definePropertyで設定
  Object.defineProperty(event, 'touches', {
    value: touches,
    writable: false,
  })
  Object.defineProperty(event, 'changedTouches', {
    value: changedTouches,
    writable: false,
  })
  Object.defineProperty(event, 'targetTouches', {
    value: targetTouches,
    writable: false,
  })
  
  return event
}

/**
 * Create a mock DragEvent
 */
export function createMockDragEvent(
  type: string,
  properties: Partial<DragEventInit> = {}
): DragEvent {
  const defaults: DragEventInit = {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer(),
  }
  
  return new DragEvent(type, { ...defaults, ...properties })
}

/**
 * Get element position relative to viewport
 */
export function getElementPosition(element: Element): DOMRect {
  return element.getBoundingClientRect()
}

/**
 * Simulate element click at specific coordinates
 */
export function clickElement(
  element: Element,
  x = 0,
  y = 0,
  options: Partial<MouseEventInit> = {}
): void {
  const rect = element.getBoundingClientRect()
  const clientX = rect.left + x
  const clientY = rect.top + y
  
  const event = createMockMouseEvent('click', {
    ...options,
    clientX,
    clientY,
  })
  
  element.dispatchEvent(event)
}

/**
 * Simulate element drag
 */
export function dragElement(
  element: Element,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): void {
  const rect = element.getBoundingClientRect()
  
  // Mouse down
  element.dispatchEvent(
    createMockMouseEvent('mousedown', {
      clientX: rect.left + startX,
      clientY: rect.top + startY,
    })
  )
  
  // Mouse move
  element.dispatchEvent(
    createMockMouseEvent('mousemove', {
      clientX: rect.left + endX,
      clientY: rect.top + endY,
    })
  )
  
  // Mouse up
  element.dispatchEvent(
    createMockMouseEvent('mouseup', {
      clientX: rect.left + endX,
      clientY: rect.top + endY,
    })
  )
}

/**
 * Wait for element to appear in DOM
 */
export async function waitForElement(
  selector: string,
  timeout = 1000
): Promise<Element> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector)
    if (element) {
      return element
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  throw new Error(`Element with selector "${selector}" not found within ${timeout}ms`)
}

/**
 * Mock element dimensions
 */
export function mockElementDimensions(
  element: Element,
  dimensions: {
    width?: number
    height?: number
    x?: number
    y?: number
  }
): void {
  const { width = 100, height = 100, x = 0, y = 0 } = dimensions
  
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    x,
    y,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  })
}