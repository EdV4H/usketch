# Selection Indicator (Drag Selection Box) カスタマイズ設計書

## 概要
現在select-tool内でDOM直接操作により実装されている`selection-box-overlay`（ドラッグ選択時のインジケーター）を、JSXコンポーネントベースのカスタマイズ可能な設計に変更します。

## 現在の実装分析

### 問題点
1. **DOM直接操作**: select-tool.ts内で`document.getElementById`と`style`の直接操作
2. **ハードコーディング**: スタイルやIDが固定されている
3. **カスタマイズ不可**: アプリケーション側で見た目を変更できない
4. **React非準拠**: Reactのレンダリングサイクル外でDOM操作

### 現在の処理フロー
```typescript
// packages/tools/src/machines/select-tool.ts
1. showSelectionBox: DOMエレメントを作成/表示
2. updateSelection: 位置とサイズを更新
3. hideSelectionBox: 非表示にする
4. finalizeSelection: 選択完了時にクリア
```

## 提案する新設計

### 1. インターフェース定義

```typescript
// packages/react-canvas/src/types.ts に追加
export interface SelectionIndicatorProps {
  // ドラッグ選択ボックスの位置とサイズ
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  // 表示状態
  visible: boolean;
  // カメラ情報（座標変換用）
  camera: Camera;
  // 選択中のアイテム数（プレビュー用）
  selectedCount?: number;
}

export interface InteractionLayerProps extends LayerProps {
  activeTool?: string;
  // 新規追加: カスタムSelectionIndicator
  selectionIndicator?: React.ComponentType<SelectionIndicatorProps>;
  selectionIndicatorClassName?: string;
  selectionIndicatorStyle?: React.CSSProperties;
}
```

### 2. デフォルトコンポーネント

```typescript
// packages/react-canvas/src/components/default-selection-indicator.tsx
import React from 'react';
import type { SelectionIndicatorProps } from '../types';

export const DefaultSelectionIndicator: React.FC<SelectionIndicatorProps> = ({
  bounds,
  visible,
  camera,
  selectedCount,
}) => {
  if (!visible || !bounds) {
    return null;
  }

  // カメラ変換を適用
  const transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;

  return (
    <div
      id="selection-box-overlay"
      data-testid="selection-indicator"
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        border: '1px dashed #007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        pointerEvents: 'none',
        zIndex: 1000,
        transform,
        transformOrigin: '0 0',
      }}
    >
      {/* オプション: 選択数の表示 */}
      {selectedCount !== undefined && selectedCount > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: -20,
            right: 0,
            fontSize: '11px',
            color: '#007bff',
            backgroundColor: 'white',
            padding: '2px 6px',
            borderRadius: '3px',
            border: '1px solid #007bff',
          }}
        >
          {selectedCount} item{selectedCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};
```

### 3. InteractionLayerの更新

```typescript
// packages/react-canvas/src/components/interaction-layer.tsx
import { DefaultSelectionIndicator } from './default-selection-indicator';
import { useSelectionIndicator } from '../hooks/use-selection-indicator';

export const InteractionLayer: React.FC<InteractionLayerProps> = ({
  camera,
  activeTool,
  selectionIndicator,
  selectionIndicatorClassName,
  selectionIndicatorStyle,
  className = "",
}) => {
  // 選択ツールの状態を監視
  const { bounds, visible, selectedCount } = useSelectionIndicator(activeTool);
  
  // カスタムコンポーネントまたはデフォルトを使用
  const SelectionIndicatorComponent = selectionIndicator || DefaultSelectionIndicator;

  return (
    <div className={`interaction-layer ${className}`.trim()}>
      {/* 既存のインタラクション要素 */}
      
      {/* Selection Indicator */}
      {activeTool === 'select' && (
        <SelectionIndicatorComponent
          bounds={bounds}
          visible={visible}
          camera={camera}
          selectedCount={selectedCount}
        />
      )}
    </div>
  );
};
```

### 4. Select Tool との連携

```typescript
// packages/react-canvas/src/hooks/use-selection-indicator.ts
import { useEffect, useState } from 'react';
import { whiteboardStore } from '@usketch/store';

export function useSelectionIndicator(activeTool: string | undefined) {
  const [indicatorState, setIndicatorState] = useState({
    bounds: null as { x: number; y: number; width: number; height: number } | null,
    visible: false,
    selectedCount: 0,
  });

  useEffect(() => {
    if (activeTool !== 'select') {
      setIndicatorState({ bounds: null, visible: false, selectedCount: 0 });
      return;
    }

    // ツールからのイベントをリッスン
    const handleSelectionUpdate = (event: CustomEvent) => {
      const { bounds, visible, selectedCount } = event.detail;
      setIndicatorState({ bounds, visible, selectedCount });
    };

    window.addEventListener('selection-indicator-update', handleSelectionUpdate);
    
    return () => {
      window.removeEventListener('selection-indicator-update', handleSelectionUpdate);
    };
  }, [activeTool]);

  return indicatorState;
}
```

### 5. Select Tool の更新

```typescript
// packages/tools/src/machines/select-tool.ts の更新
const selectToolMachine = setup({
  actions: {
    showSelectionBox: () => {
      // DOM操作の代わりにイベントを発火
      window.dispatchEvent(new CustomEvent('selection-indicator-update', {
        detail: { bounds: { x: 0, y: 0, width: 0, height: 0 }, visible: true, selectedCount: 0 }
      }));
    },

    updateSelection: assign(({ context, event }) => {
      // ... 選択ロジック ...
      
      // DOM操作の代わりにイベントを発火
      window.dispatchEvent(new CustomEvent('selection-indicator-update', {
        detail: { 
          bounds: box, 
          visible: true, 
          selectedCount: newSelectedIds.size 
        }
      }));

      return { selectionBox: box, selectedIds: newSelectedIds };
    }),

    hideSelectionBox: () => {
      // DOM操作の代わりにイベントを発火
      window.dispatchEvent(new CustomEvent('selection-indicator-update', {
        detail: { bounds: null, visible: false, selectedCount: 0 }
      }));
    },

    finalizeSelection: assign(() => {
      // DOM操作の代わりにイベントを発火
      window.dispatchEvent(new CustomEvent('selection-indicator-update', {
        detail: { bounds: null, visible: false, selectedCount: 0 }
      }));
      
      return { selectionBox: null, dragStart: null };
    }),
  }
});
```

## 使用例

### 基本的な使用（デフォルト）
```tsx
<WhiteboardCanvas shapes={plugins} />
// DefaultSelectionIndicatorが自動的に使用される
```

### カスタムインジケーター
```tsx
const CustomSelectionIndicator: React.FC<SelectionIndicatorProps> = ({
  bounds,
  visible,
  camera,
  selectedCount,
}) => {
  if (!visible || !bounds) return null;

  return (
    <div
      className="custom-selection-indicator"
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        border: '2px solid #ff6b6b',
        backgroundColor: 'rgba(255, 107, 107, 0.2)',
        borderRadius: '8px',
        pointerEvents: 'none',
        transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
      }}
    >
      {/* カスタムアニメーション */}
      <div className="pulse-animation" />
      
      {/* 選択数バッジ */}
      {selectedCount > 0 && (
        <div className="selection-badge">
          {selectedCount}
        </div>
      )}
    </div>
  );
};

<WhiteboardCanvas 
  shapes={plugins}
  selectionIndicator={CustomSelectionIndicator}
/>
```

### アニメーション付きインジケーター
```tsx
const AnimatedSelectionIndicator: React.FC<SelectionIndicatorProps> = ({
  bounds,
  visible,
}) => {
  const spring = useSpring({
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1)' : 'scale(0.95)',
    config: { tension: 300, friction: 20 },
  });

  if (!bounds) return null;

  return (
    <animated.div
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        ...spring,
      }}
    >
      {/* アニメーション要素 */}
    </animated.div>
  );
};
```

## 実装ステップ

### Phase 1: インターフェース定義（優先度: 高）
1. `SelectionIndicatorProps`の定義
2. `InteractionLayerProps`の拡張
3. イベントタイプの定義

### Phase 2: デフォルトコンポーネント（優先度: 高）
1. `DefaultSelectionIndicator`の実装
2. 既存のスタイルを維持
3. E2Eテストの互換性確保（id="selection-box-overlay"を維持）

### Phase 3: Hook実装（優先度: 高）
1. `useSelectionIndicator`の実装
2. ツールとの通信メカニズム
3. 状態管理の最適化

### Phase 4: Select Tool更新（優先度: 高）
1. DOM操作をイベント発火に置き換え
2. 後方互換性の維持（一時的に両方サポート）
3. テストの更新

### Phase 5: 統合とテスト（優先度: 中）
1. InteractionLayerの更新
2. WhiteboardCanvasへのプロパティ追加
3. E2Eテストの確認

## 利点

### 1. React準拠
- Reactのレンダリングサイクルに統合
- Virtual DOMの恩恵を受ける
- React DevToolsでデバッグ可能

### 2. カスタマイズ性
- 完全にカスタマイズ可能なUI
- アニメーション対応
- テーマ対応

### 3. テスタビリティ
- コンポーネント単体でテスト可能
- モック可能な設計
- 予測可能な動作

### 4. 保守性
- 関心の分離（ツールロジックとUI）
- 型安全性
- 再利用可能なコンポーネント

## 移行戦略

### Phase 1: 並行実装
- 新しいシステムを実装しつつ、既存のDOM操作も維持
- フィーチャーフラグで切り替え可能に

### Phase 2: 段階的移行
- 新規プロジェクトから新システムを使用
- 既存プロジェクトは任意のタイミングで移行

### Phase 3: 完全移行
- すべてのテストが通過後、旧実装を削除
- ドキュメントの更新

## 考慮事項

### パフォーマンス
- 頻繁な更新によるre-renderの最適化
- `useMemo`/`useCallback`の適切な使用
- RAF（RequestAnimationFrame）の活用

### 互換性
- 既存のE2Eテストとの互換性維持
- `id="selection-box-overlay"`の維持（必要に応じて）
- 既存のCSSセレクタのサポート

### アクセシビリティ
- スクリーンリーダー対応（aria-label等）
- キーボード操作のフィードバック
- ハイコントラストモード対応

## まとめ

この設計により、Selection Indicator（ドラッグ選択ボックス）がReactコンポーネントとして実装され、高度にカスタマイズ可能になります。DOM直接操作から脱却し、Reactエコシステムに完全に統合されることで、保守性とテスタビリティが大幅に向上します。