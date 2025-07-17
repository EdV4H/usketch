# @whiteboard/test-utils

共通テストユーティリティパッケージ。Vitest環境でのテストに必要なモック、ヘルパー関数、セットアップを提供します。

## 機能

### グローバルセットアップ
- ブラウザAPIのモック（matchMedia、ResizeObserver、IntersectionObserver等）
- requestAnimationFrameのモック
- エラーハンドリングとクリーンアップ

### DOM操作ヘルパー
- `createMockElement`: モックDOM要素の作成
- `createMockEvent`: モックイベントの作成
- `createMockCanvas`: Canvasモックの作成
- `createMockContext2D`: 2Dコンテキストモックの作成

### 非同期ヘルパー
- `nextTick`: 次のティックまで待機
- `delay`: 指定時間待機
- `waitFor`: 条件が満たされるまで待機
- `waitForElement`: 要素が表示されるまで待機

### ストレージモック
- `mockLocalStorage`: LocalStorageのモック
- `mockSessionStorage`: SessionStorageのモック

### カスタムマッチャー
- `toBeNearlyEqual`: 数値の近似比較
- `toHaveBeenCalledWithShape`: Canvas APIの呼び出し確認

## 使用方法

### インストール

```bash
pnpm add -D @whiteboard/test-utils
```

### Vitest設定での使用

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['@whiteboard/test-utils/setup'],
  },
})
```

### テスト内での使用

```typescript
import { createMockElement, nextTick, mockLocalStorage } from '@whiteboard/test-utils'

describe('MyComponent', () => {
  it('should handle DOM operations', async () => {
    const element = createMockElement('div', { id: 'test', class: 'mock' })
    document.body.appendChild(element)
    
    await nextTick()
    
    expect(element).toBeInTheDocument()
  })
  
  it('should handle localStorage', () => {
    const storage = mockLocalStorage()
    window.localStorage = storage as any
    
    localStorage.setItem('key', 'value')
    expect(storage.setItem).toHaveBeenCalledWith('key', 'value')
  })
})
```

## エクスポート

### setup.ts
グローバルセットアップファイル。Vitestの`setupFiles`で使用。

### DOM Helpers
- `createMockElement(tag: string, attributes?: Record<string, string>): HTMLElement`
- `createMockEvent(type: string, properties?: Record<string, any>): Event`
- `createMockCanvas(width?: number, height?: number): HTMLCanvasElement`
- `createMockContext2D(): CanvasRenderingContext2D`

### Async Helpers
- `nextTick(): Promise<void>`
- `delay(ms: number): Promise<void>`
- `waitFor(condition: () => boolean, timeout?: number): Promise<void>`
- `waitForElement(selector: string, timeout?: number): Promise<Element>`

### Storage Mocks
- `mockLocalStorage(): Storage`
- `mockSessionStorage(): Storage`

### Test Utilities
- `setupCanvasTest(): { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }`
- `cleanupTest(): void`

## 開発

### ビルド

```bash
pnpm build
```

### テスト

```bash
pnpm test
```

### 新しいユーティリティの追加

1. `src/`ディレクトリに新しいファイルを作成
2. `src/index.ts`からエクスポート
3. テストを`src/__tests__/`に追加
4. READMEを更新