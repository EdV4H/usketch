/**
 * @whiteboard/test-utils
 * 
 * 共通テストユーティリティのエントリーポイント
 */

// DOM Helpers
export {
  createMockElement,
  createMockSVGElement,
  createMockEvent,
  createMockMouseEvent,
  createMockKeyboardEvent,
  createMockPointerEvent,
  createMockTouch,
  createMockTouchEvent,
  createMockDragEvent,
  getElementPosition,
  clickElement,
  dragElement,
  waitForElement,
  mockElementDimensions,
} from './dom-helpers'

// Async Helpers
export {
  nextTick,
  delay,
  flushPromises,
  waitFor,
  waitForValueChange,
  retry,
  createDeferred,
  waitForAnimationFrame,
  waitForAnimationFrames,
  timeout,
  runWithFakeTimers,
  createControllableAsync,
} from './async-helpers'

// Canvas Helpers
export {
  createMockCanvas,
  createMockContext2D,
  setupCanvasTest,
  getCanvasMethodCalls,
  assertCanvasPath,
  createMockImage,
  mockCanvasToBlob,
  mockCanvasToDataURL,
  createPathRecorder,
} from './canvas-helpers'

// Storage Mocks
export {
  mockLocalStorage,
  mockSessionStorage,
  createStorageWithData,
  mockIndexedDB,
  StorageEventEmitter,
  createPersistentStorage,
  mockStorageQuota,
  installStorageMocks,
} from './storage-mocks'

// Re-export types
// Note: Currently no types are exported from the modules