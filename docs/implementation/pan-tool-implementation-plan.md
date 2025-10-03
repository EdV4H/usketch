# パンツール実装計画書

## 📋 概要

ドラッグ操作でキャンバス全体を移動できる**パンツール（Hand Tool）**をXState v5状態マシンとして実装します。

## 🎯 目的

- ユーザーがキャンバスをドラッグして自由に表示領域を移動できる
- スペースキー押下時に一時的にパンモードに切り替え可能
- スムーズなビューポート移動体験を提供
- 既存のツールシステムと統合

## 📐 要件定義

### 機能要件

#### 1. 基本機能
- ✅ ドラッグ操作によるキャンバス移動
- ✅ マウスカーソルの変更（hand/grab アイコン）
- ✅ スペースキー押下で一時的にパンモードへ移行
- ✅ スペースキーリリースで元のツールに復帰

#### 2. インタラクション
- **ドラッグ開始**: マウスボタン押下
- **ドラッグ中**: マウス移動に応じてビューポート更新
- **ドラッグ終了**: マウスボタンリリース

#### 3. ビューポート更新
- ドラッグ量に応じてZustandストアの`viewport`を更新
- `viewport.x`と`viewport.y`を変更してキャンバス位置を調整

### 非機能要件

- **パフォーマンス**: 60FPS以上のスムーズなドラッグ
- **型安全性**: TypeScript + XState v5の型推論を活用
- **保守性**: 既存ツール（Select, Drawing）と統一されたアーキテクチャ

## 🏗️ アーキテクチャ設計

### 1. 状態マシン設計（XState v5）

#### 状態遷移図

```
┌─────────┐
│  idle   │ ←─────────────────┐
└─────────┘                   │
     │                        │
     │ POINTER_DOWN           │
     ↓                        │
┌─────────┐                  │
│ panning │ ─── POINTER_UP ──┘
└─────────┘
     ↑│
     │└─ POINTER_MOVE (loop)
```

#### 状態詳細

| 状態 | 説明 | カーソル |
|------|------|---------|
| `idle` | 待機状態、ドラッグ可能 | `grab` |
| `panning` | ドラッグ中、ビューポート移動 | `grabbing` |

### 2. コンテキスト構造

```typescript
interface PanToolContext extends ToolContext {
  // パン開始時のポインター位置（スクリーン座標）
  startPoint: Point | null;

  // パン開始時のビューポート位置
  initialViewport: {
    x: number;
    y: number;
  } | null;

  // カーソルスタイル
  cursor: 'grab' | 'grabbing';
}
```

### 3. イベント定義

```typescript
type PanToolEvent =
  | { type: 'POINTER_DOWN'; point: Point }
  | { type: 'POINTER_MOVE'; point: Point }
  | { type: 'POINTER_UP'; point: Point }
  | { type: 'CANCEL' };
```

## 📝 実装計画

### Phase 1: パンツール状態マシンの実装

#### ファイル構成

```
packages/tools/src/tools/
├── pan-tool.ts           # パンツール状態マシン（新規作成）
└── __tests__/
    └── pan-tool.test.ts  # ユニットテスト（新規作成）
```

#### `pan-tool.ts` 実装内容

```typescript
import { assign, setup } from 'xstate';
import type { Point, ToolContext } from '../types/index';

// === コンテキスト定義 ===
export interface PanToolContext extends ToolContext {
  startPoint: Point | null;
  initialViewport: { x: number; y: number } | null;
  cursor: 'grab' | 'grabbing';
}

// === イベント定義 ===
export type PanToolEvent =
  | { type: 'POINTER_DOWN'; point: Point }
  | { type: 'POINTER_MOVE'; point: Point }
  | { type: 'POINTER_UP'; point: Point }
  | { type: 'CANCEL' };

// === アクション定義 ===
const actions = {
  // パン開始時の初期化
  startPan: assign(({ context, event }) => {
    if (event.type !== 'POINTER_DOWN') return context;

    const viewport = whiteboardStore.getState().viewport;

    return {
      ...context,
      startPoint: event.point,
      initialViewport: { x: viewport.x, y: viewport.y },
      cursor: 'grabbing' as const,
    };
  }),

  // ビューポート更新（ドラッグ中）
  updateViewport: ({ context, event }) => {
    if (event.type !== 'POINTER_MOVE') return;
    if (!context.startPoint || !context.initialViewport) return;

    const dx = event.point.x - context.startPoint.x;
    const dy = event.point.y - context.startPoint.y;

    // ビューポートを逆方向に移動（ドラッグと同じ方向にキャンバスが動く）
    whiteboardStore.getState().setViewport({
      x: context.initialViewport.x - dx,
      y: context.initialViewport.y - dy,
    });
  },

  // パン終了時のクリーンアップ
  endPan: assign(({ context }) => ({
    ...context,
    startPoint: null,
    initialViewport: null,
    cursor: 'grab' as const,
  })),
};

// === パンツール状態マシン ===
export const createPanTool = () =>
  setup({
    types: {
      context: {} as PanToolContext,
      events: {} as PanToolEvent,
    },
    actions,
  }).createMachine({
    id: 'panTool',

    initial: 'idle',

    context: {
      startPoint: null,
      initialViewport: null,
      cursor: 'grab',
    },

    states: {
      idle: {
        on: {
          POINTER_DOWN: {
            target: 'panning',
            actions: ['startPan'],
          },
        },
      },

      panning: {
        on: {
          POINTER_MOVE: {
            actions: ['updateViewport'],
          },
          POINTER_UP: {
            target: 'idle',
            actions: ['endPan'],
          },
          CANCEL: {
            target: 'idle',
            actions: ['endPan'],
          },
        },
      },
    },
  });

// エクスポート
export const panToolMachine = createPanTool();
```

### Phase 2: ツール設定への登録

#### `packages/tools/src/configs/default-tools.ts` に追加

```typescript
import { createPanTool } from '../tools/pan-tool';

// パンツールの動作定義
const panToolBehaviors: ToolBehaviors = {
  // 必要に応じてカスタム動作を定義
  onActivate: ({ store }) => {
    // パンツール有効化時の処理
    console.log('Pan tool activated');
  },

  onDeactivate: ({ store }) => {
    // パンツール無効化時の処理
    console.log('Pan tool deactivated');
  },
};

// getDefaultTools() に追加
export function getDefaultTools(): ToolConfig[] {
  return [
    // ... 既存ツール（select, rectangle, draw）
    {
      id: 'pan',
      machine: createPanTool(),
      displayName: 'Hand',
      icon: 'hand',
      shortcut: 'h',
      enabled: true,
      metadata: {
        author: 'uSketch Team',
        version: '1.0.0',
        description: 'Pan the canvas by dragging',
        category: 'navigation',
      },
      behaviors: panToolBehaviors,
    },
  ];
}
```

### Phase 3: Zustandストアの拡張

#### `packages/store/src/store.ts` に`setViewport`メソッド追加確認

既存の`setViewport`メソッドを確認し、必要に応じて以下の機能を追加：

```typescript
export interface WhiteboardStore {
  // ... 既存のプロパティ

  viewport: {
    x: number;
    y: number;
    zoom: number;
  };

  // ビューポート更新メソッド
  setViewport: (viewport: Partial<{ x: number; y: number; zoom: number }>) => void;
}
```

### Phase 4: UI統合

#### ツールバーへのボタン追加

`apps/whiteboard/src/components/ToolBar.tsx` (または相当するファイル) に追加：

```tsx
const tools = [
  { id: 'select', label: 'Select', icon: '👆', shortcut: 'V' },
  { id: 'pan', label: 'Hand', icon: '✋', shortcut: 'H' }, // 新規追加
  { id: 'rectangle', label: 'Rectangle', icon: '⬜', shortcut: 'R' },
  { id: 'draw', label: 'Draw', icon: '✏️', shortcut: 'D' },
];
```

### Phase 5: スペースキー連携（オプション）

#### グローバルキーボードショートカット

`apps/whiteboard/src/hooks/useKeyboardShortcuts.ts` に追加：

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // スペースキー押下でパンツールに一時切り替え
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      previousToolRef.current = currentTool;
      setSelectedTool('pan');
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    // スペースキーリリースで元のツールに復帰
    if (e.code === 'Space') {
      e.preventDefault();
      if (previousToolRef.current) {
        setSelectedTool(previousToolRef.current);
        previousToolRef.current = null;
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, [currentTool, setSelectedTool]);
```

## 🧪 テスト計画

### ユニットテスト

`packages/tools/src/tools/__tests__/pan-tool.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActor } from 'xstate';
import { panToolMachine } from '../pan-tool';
import { whiteboardStore } from '@usketch/store';

describe('PanTool', () => {
  let actor: ReturnType<typeof createActor>;

  beforeEach(() => {
    actor = createActor(panToolMachine);
    actor.start();

    // ストアをモック
    vi.spyOn(whiteboardStore.getState(), 'setViewport');
  });

  it('初期状態は idle で cursor は grab', () => {
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.cursor).toBe('grab');
  });

  it('POINTER_DOWN で panning 状態に遷移', () => {
    actor.send({ type: 'POINTER_DOWN', point: { x: 100, y: 100 } });
    expect(actor.getSnapshot().value).toBe('panning');
    expect(actor.getSnapshot().context.cursor).toBe('grabbing');
  });

  it('POINTER_MOVE でビューポートが更新される', () => {
    actor.send({ type: 'POINTER_DOWN', point: { x: 100, y: 100 } });
    actor.send({ type: 'POINTER_MOVE', point: { x: 150, y: 150 } });

    expect(whiteboardStore.getState().setViewport).toHaveBeenCalled();
  });

  it('POINTER_UP で idle 状態に戻る', () => {
    actor.send({ type: 'POINTER_DOWN', point: { x: 100, y: 100 } });
    actor.send({ type: 'POINTER_UP', point: { x: 150, y: 150 } });

    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.cursor).toBe('grab');
  });

  it('CANCEL でパンをキャンセル', () => {
    actor.send({ type: 'POINTER_DOWN', point: { x: 100, y: 100 } });
    actor.send({ type: 'CANCEL' });

    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.startPoint).toBeNull();
  });
});
```

### E2Eテスト

`apps/e2e/tests/pan-tool.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Pan Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('パンツールボタンをクリックして有効化', async ({ page }) => {
    await page.click('[data-testid="tool-pan"]');
    await expect(page.locator('[data-testid="tool-pan"]')).toHaveClass(/active/);
  });

  test('ドラッグ操作でキャンバスが移動', async ({ page }) => {
    await page.click('[data-testid="tool-pan"]');

    const canvas = page.locator('[data-testid="whiteboard-canvas"]');

    // 初期ビューポート取得
    const initialViewport = await page.evaluate(() => {
      return window.whiteboardStore.getState().viewport;
    });

    // ドラッグ操作
    await canvas.hover({ position: { x: 100, y: 100 } });
    await page.mouse.down();
    await page.mouse.move(200, 200);
    await page.mouse.up();

    // ビューポートが変更されたことを確認
    const newViewport = await page.evaluate(() => {
      return window.whiteboardStore.getState().viewport;
    });

    expect(newViewport.x).not.toBe(initialViewport.x);
    expect(newViewport.y).not.toBe(initialViewport.y);
  });

  test('スペースキーで一時的にパンモード', async ({ page }) => {
    // 初期ツールを Select に設定
    await page.click('[data-testid="tool-select"]');

    // スペースキー押下
    await page.keyboard.down('Space');
    await expect(page.locator('body')).toHaveCSS('cursor', /grab/);

    // スペースキーリリース
    await page.keyboard.up('Space');
    await expect(page.locator('[data-testid="tool-select"]')).toHaveClass(/active/);
  });
});
```

## 📦 ファイル変更まとめ

### 新規作成ファイル

1. `packages/tools/src/tools/pan-tool.ts` - パンツール状態マシン
2. `packages/tools/src/tools/__tests__/pan-tool.test.ts` - ユニットテスト
3. `apps/e2e/tests/pan-tool.spec.ts` - E2Eテスト

### 変更ファイル

1. `packages/tools/src/configs/default-tools.ts` - パンツール設定追加
2. `packages/tools/src/index.ts` - エクスポート追加
3. `apps/whiteboard/src/components/ToolBar.tsx` - UIボタン追加
4. `apps/whiteboard/src/hooks/useKeyboardShortcuts.ts` - スペースキー連携

## 🚀 実装スケジュール

| フェーズ | タスク | 所要時間 | 担当 |
|---------|--------|---------|------|
| Phase 1 | パンツール状態マシン実装 | 2時間 | Developer |
| Phase 2 | ツール設定への登録 | 30分 | Developer |
| Phase 3 | Zustandストア確認・拡張 | 30分 | Developer |
| Phase 4 | UI統合（ツールバー） | 1時間 | Developer |
| Phase 5 | スペースキー連携 | 1時間 | Developer |
| Testing | ユニット＋E2Eテスト | 2時間 | Tester |
| Review | コードレビュー＋修正 | 1時間 | Architect |

**合計**: 約8時間

## 🎯 成功基準

- ✅ パンツールボタンをクリックして有効化できる
- ✅ ドラッグ操作でキャンバスがスムーズに移動する
- ✅ スペースキー押下で一時的にパンモードに切り替わる
- ✅ スペースキーリリースで元のツールに復帰する
- ✅ カーソルが適切に変化する（grab ↔ grabbing）
- ✅ 全ユニットテストが合格
- ✅ 全E2Eテストが合格

## 📚 参考資料

- [XState v5 Documentation](https://stately.ai/docs/xstate)
- [Zustand Documentation](https://zustand.docs.pmnd.rs/)
- [uSketch Tool System Design](./xstate-tool-system-design.md)
- [uSketch API仕様書](../api/README.md)

## 🔄 今後の拡張案

1. **慣性スクロール**: ドラッグ終了後も慣性で少し移動
2. **パン範囲制限**: 無限にパンできないようキャンバス範囲を制限
3. **ミニマップ連携**: パン操作をミニマップに反映
4. **タッチデバイス対応**: マルチタッチジェスチャーでのパン操作

---

**作成日**: 2025-10-03
**作成者**: uSketch Development Team
**バージョン**: 1.0.0
