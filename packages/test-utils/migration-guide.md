# test-utils 移行ガイド

このドキュメントは、既存の `src/test/` ディレクトリから `@whiteboard/test-utils` パッケージへの移行方法を説明します。

## 移行手順

### 1. パッケージのインストール

monorepo移行後、以下のようにパッケージを参照します：

```json
{
  "devDependencies": {
    "@whiteboard/test-utils": "workspace:*"
  }
}
```

### 2. インポートパスの変更

#### 変更前
```typescript
import { createMockElement, nextTick } from '../test/utils'
```

#### 変更後
```typescript
import { createMockElement, nextTick } from '@whiteboard/test-utils'
```

### 3. セットアップファイルの変更

#### 変更前（vitest.config.ts）
```typescript
export default defineConfig({
  test: {
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

#### 変更後
```typescript
export default defineConfig({
  test: {
    setupFiles: ['@whiteboard/test-utils/setup'],
  },
})
```

## 新機能と改善点

### 1. より充実したDOM操作ヘルパー

既存の機能に加えて、以下が追加されました：

- `createMockSVGElement`: SVG要素のモック作成
- `createMockPointerEvent`: PointerEventのモック
- `createMockTouchEvent`: タッチイベントのモック
- `dragElement`: ドラッグ操作のシミュレーション
- `mockElementDimensions`: 要素サイズのモック

### 2. Canvas専用ヘルパー

新しくCanvas関連のテストヘルパーが追加されました：

```typescript
import { setupCanvasTest, assertCanvasPath } from '@whiteboard/test-utils/canvas'

const { canvas, ctx } = setupCanvasTest()
assertCanvasPath(ctx, [
  { method: 'beginPath' },
  { method: 'moveTo', args: [0, 0] },
  { method: 'lineTo', args: [100, 100] },
])
```

### 3. 非同期処理の強化

```typescript
import { waitFor, retry, createDeferred } from '@whiteboard/test-utils/async'

// 条件待機
await waitFor(() => document.querySelector('.loaded'), {
  timeout: 5000,
  message: 'Element not loaded'
})

// リトライ機能
const result = await retry(async () => {
  return await fetchData()
}, { maxAttempts: 3, backoff: true })
```

### 4. ストレージモックの拡張

IndexedDBやStorageEventのモックが追加されました：

```typescript
import { mockIndexedDB, StorageEventEmitter } from '@whiteboard/test-utils/storage'

const { db, objectStore } = mockIndexedDB()
const storageEvents = new StorageEventEmitter(localStorage)
```

## 互換性の維持

既存の関数は全て互換性を保ちながら移行されています：

- `createMockElement` ✅
- `createMockEvent` ✅  
- `nextTick` ✅
- `mockLocalStorage` ✅

## テストの移行例

### Before
```typescript
import { vi } from 'vitest'
import { createMockElement } from '../test/utils'

describe('Canvas', () => {
  it('should render', () => {
    const canvas = createMockElement('canvas')
    // ...
  })
})
```

### After
```typescript
import { vi } from 'vitest'
import { setupCanvasTest } from '@whiteboard/test-utils'

describe('Canvas', () => {
  it('should render', () => {
    const { canvas, ctx } = setupCanvasTest()
    // より便利なヘルパーが利用可能
  })
})
```

## トラブルシューティング

### TypeScriptエラーが発生する場合

tsconfig.jsonに以下を追加：

```json
{
  "compilerOptions": {
    "paths": {
      "@whiteboard/test-utils": ["./packages/test-utils/src"],
      "@whiteboard/test-utils/*": ["./packages/test-utils/src/*"]
    }
  }
}
```

### モックが正しく動作しない場合

セットアップファイルが正しく読み込まれているか確認：

```bash
# Vitestの設定を確認
vitest --reporter=verbose
```

## 段階的移行

1. **Phase 1**: セットアップファイルのみ移行
2. **Phase 2**: 個別のテストファイルを順次移行
3. **Phase 3**: 古いtest/ディレクトリを削除

各フェーズで動作確認を行いながら進めることを推奨します。