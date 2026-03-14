# Selection Box カスタマイズ設計書

## 概要
現在の`SelectionLayer`コンポーネントを、ユーザーがカスタムJSXコンポーネントを提供できる柔軟な設計に変更します。これにより、アプリケーション固有の選択ボックスUIを実装できるようになります。

## 現在の実装分析

### 既存の構造
- **`@usketch/ui-components/selection-layer.ts`**: DOM直接操作によるクラスベースの実装
- **`@usketch/react-canvas/selection-layer.tsx`**: React コンポーネントベースの実装（現在使用中）

### 現在の選択ボックス要素
1. **単一選択時**
   - 選択ボックス（青い枠線）
   - リサイズハンドル（8方向）
   
2. **複数選択時**
   - グループバウンディングボックス
   - 個別の選択ボックス（薄い枠線）

## 提案する新設計

### 1. インターフェース定義

```typescript
// packages/react-canvas/src/types.ts に追加
export interface SelectionBoxProps {
  // 選択された形状の情報
  selectedShapes: Shape[];
  // バウンディングボックス情報
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // 単一選択か複数選択か
  isMultiSelect: boolean;
  // リサイズハンドルのコールバック
  onResizeHandleDrag?: (handle: string, event: MouseEvent) => void;
  // その他のコンテキスト
  camera: Camera;
}

export interface SelectionLayerProps extends LayerProps {
  selectedIds: Set<string>;
  shapes: Record<string, Shape>;
  // カスタムレンダラー（新規追加、デフォルト: DefaultSelectionBox）
  selectionBox?: React.ComponentType<SelectionBoxProps>;
  // カスタムスタイル（新規追加）
  selectionBoxClassName?: string;
  selectionBoxStyle?: React.CSSProperties;
}
```

### 2. デフォルトコンポーネント

```typescript
// packages/react-canvas/src/components/default-selection-box.tsx
import React from 'react';
import type { SelectionBoxProps } from '../types';

export const DefaultSelectionBox: React.FC<SelectionBoxProps> = ({
  selectedShapes,
  boundingBox,
  isMultiSelect,
  onResizeHandleDrag,
}) => {
  // 複数選択時のレンダリング
  if (isMultiSelect) {
    return (
      <>
        {/* グループ選択ボックス */}
        <div
          className="selection-box group-selection"
          data-testid="group-selection-box"
          style={{
            position: 'absolute',
            left: boundingBox.x - 2,
            top: boundingBox.y - 2,
            width: boundingBox.width + 4,
            height: boundingBox.height + 4,
            border: '2px solid #0066ff',
            backgroundColor: 'rgba(0, 102, 255, 0.05)',
            pointerEvents: 'none',
          }}
        >
          {/* 選択数バッジ */}
          <div
            className="selection-count"
            style={{
              position: 'absolute',
              top: '-24px',
              left: '0',
              backgroundColor: '#0066ff',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            {selectedShapes.length} objects selected
          </div>
        </div>
        
        {/* 個別の選択ボックス（薄い枠） */}
        {selectedShapes.map((shape) => (
          <div
            key={shape.id}
            className="individual-selection-box"
            style={{
              position: 'absolute',
              left: shape.x - 1,
              top: shape.y - 1,
              width: ('width' in shape ? shape.width : 100) + 2,
              height: ('height' in shape ? shape.height : 100) + 2,
              border: '1px solid rgba(0, 123, 255, 0.5)',
              backgroundColor: 'rgba(0, 123, 255, 0.02)',
              pointerEvents: 'none',
            }}
          />
        ))}
      </>
    );
  }

  // 単一選択時のレンダリング
  return (
    <>
      {/* 選択ボックス */}
      <div
        className="selection-box"
        data-testid={`selection-box-${selectedShapes[0].id}`}
        style={{
          position: 'absolute',
          left: boundingBox.x - 2,
          top: boundingBox.y - 2,
          width: boundingBox.width + 4,
          height: boundingBox.height + 4,
          border: '2px solid #0066ff',
          backgroundColor: 'rgba(0, 102, 255, 0.1)',
          pointerEvents: 'none',
        }}
      />
      
      {/* リサイズハンドル */}
      {['nw', 'ne', 'sw', 'se'].map((position) => (
        <div
          key={position}
          className={`resize-handle ${position}`}
          data-resize-handle={position}
          data-testid={`resize-handle-${position}`}
          style={{
            position: 'absolute',
            left: position.includes('w') 
              ? boundingBox.x - 10 
              : boundingBox.x + boundingBox.width - 10,
            top: position.includes('n')
              ? boundingBox.y - 10
              : boundingBox.y + boundingBox.height - 10,
            width: 20,
            height: 20,
            cursor: `${position}-resize`,
            pointerEvents: 'auto',
            zIndex: 10,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseDown={(e) => onResizeHandleDrag?.(position, e.nativeEvent)}
        >
          <div
            style={{
              width: 8,
              height: 8,
              backgroundColor: '#0066ff',
              border: '1px solid white',
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          />
        </div>
      ))}
    </>
  );
};
```

### 3. 更新後のSelectionLayerコンポーネント

```typescript
// packages/react-canvas/src/components/selection-layer.tsx
import { DefaultSelectionBox } from './default-selection-box';

export const SelectionLayer: React.FC<SelectionLayerProps> = ({
  selectedIds,
  shapes,
  camera,
  selectionBox,
  selectionBoxClassName,
  selectionBoxStyle,
  className = "",
}) => {
  // ... 既存のロジック ...

  // デフォルトコンポーネントを明示的に設定
  const SelectionBoxComponent = selectionBox || DefaultSelectionBox;

  return (
    <div className={`selection-layer ${className}`.trim()}>
      <SelectionBoxComponent
        selectedShapes={selectedShapes}
        boundingBox={boundingBox}
        isMultiSelect={selectedShapes.length > 1}
        camera={camera}
      />
    </div>
  );
};
```

### 4. WhiteboardCanvasの更新

```typescript
// packages/react-canvas/src/components/whiteboard-canvas.tsx
import { DefaultSelectionBox } from './default-selection-box';

export interface WhiteboardCanvasProps extends CanvasProps {
  // 新規追加（デフォルト: DefaultSelectionBox）
  selectionBox?: React.ComponentType<SelectionBoxProps>;
  selectionBoxClassName?: string;
  selectionBoxStyle?: React.CSSProperties;
}

// WhiteboardCanvasコンポーネント内
const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  selectionBox = DefaultSelectionBox, // デフォルト値を明示的に設定
  selectionBoxClassName,
  selectionBoxStyle,
  ...otherProps
}) => {
  // ...
  
  // 内部でSelectionLayerに渡す
  return (
    <>
      {/* ... */}
      <SelectionLayer
        selectedIds={selectedIds}
        shapes={shapes}
        camera={camera}
        selectionBox={selectionBox}
        selectionBoxClassName={selectionBoxClassName}
        selectionBoxStyle={selectionBoxStyle}
      />
      {/* ... */}
    </>
  );
};
```

## 使用例

### 基本的な使用（デフォルト）
```tsx
import { WhiteboardCanvas } from '@usketch/react-canvas';

// デフォルトのDefaultSelectionBoxが自動的に適用される
<WhiteboardCanvas shapes={plugins} />

// 明示的にDefaultSelectionBoxを指定することも可能
import { DefaultSelectionBox } from '@usketch/react-canvas';
<WhiteboardCanvas 
  shapes={plugins} 
  selectionBox={DefaultSelectionBox}
/>
```

### カスタムセレクションボックス
```tsx
const CustomSelectionBox: React.FC<SelectionBoxProps> = ({
  selectedShapes,
  boundingBox,
  isMultiSelect,
}) => {
  return (
    <div className="custom-selection">
      {/* カスタムUI実装 */}
      <div className="selection-info">
        選択中: {selectedShapes.length}個
      </div>
      <div className="custom-handles">
        {/* カスタムハンドル */}
      </div>
    </div>
  );
};

<WhiteboardCanvas 
  shapes={plugins}
  selectionBox={CustomSelectionBox}
/>
```

### スタイルのカスタマイズ
```tsx
<WhiteboardCanvas 
  shapes={plugins}
  selectionBoxClassName="my-selection-box"
  selectionBoxStyle={{
    borderColor: '#ff0000',
    borderWidth: 3,
  }}
/>
```

## 実装ステップ

### Phase 1: インターフェース定義（優先度: 高）
1. `SelectionBoxProps`インターフェースの定義
2. `SelectionLayerProps`の拡張
3. TypeScript型定義の更新

### Phase 2: デフォルトコンポーネント実装（優先度: 高）
1. `DefaultSelectionBox`コンポーネントの作成
2. 既存のレンダリングロジックを移植
3. リサイズハンドルの抽出
4. エクスポート設定（`@usketch/react-canvas`から公開）

### Phase 3: SelectionLayer改修（優先度: 高）
1. カスタムレンダラーサポートの追加
2. プロパティの受け渡し
3. デフォルトコンポーネントのインポートと適用
4. 後方互換性の維持

### Phase 4: WhiteboardCanvas統合（優先度: 中）
1. 新しいプロパティの追加
2. デフォルト値の設定（DefaultSelectionBox）
3. SelectionLayerへの伝播
4. ドキュメント更新

### Phase 5: テストとサンプル（優先度: 中）
1. ユニットテストの作成
2. E2Eテストの更新
3. サンプル実装の作成

## 利点

### 1. 柔軟性
- アプリケーション固有のUI要件に対応可能
- 選択ボックスの見た目を完全にカスタマイズ可能

### 2. 保守性
- デフォルト実装とカスタム実装の分離
- コンポーネントの責務が明確

### 3. 拡張性
- 新しい選択モード（回転ハンドル等）の追加が容易
- アニメーションやエフェクトの追加が可能

### 4. 後方互換性
- 既存のコードは変更なしで動作
- 段階的な移行が可能

## 考慮事項

### パフォーマンス
- カスタムコンポーネントの再レンダリング最適化
- メモ化の適切な使用

### アクセシビリティ
- キーボードナビゲーション対応
- スクリーンリーダー対応

### イベント処理
- リサイズハンドルのドラッグイベント
- 選択ボックスのクリックイベント

## エクスポート構成

```typescript
// packages/react-canvas/src/index.ts
export { WhiteboardCanvas } from './components/whiteboard-canvas';
export { DefaultSelectionBox } from './components/default-selection-box';
export type { SelectionBoxProps, WhiteboardCanvasProps } from './types';
```

これにより、ユーザーは以下のようにインポートできます：

```typescript
import { 
  WhiteboardCanvas, 
  DefaultSelectionBox,
  type SelectionBoxProps 
} from '@usketch/react-canvas';
```

## まとめ

この設計により、`SelectionLayer`は高度にカスタマイズ可能なコンポーネントとなり、様々なアプリケーションの要件に対応できるようになります。

**重要なポイント**：
- `DefaultSelectionBox`コンポーネントを明示的に作成し、デフォルトとして適用
- ユーザーがカスタマイズしない場合は、自動的に`DefaultSelectionBox`が使用される
- `DefaultSelectionBox`も公開APIとしてエクスポートし、ユーザーが拡張・参考にできるようにする
- 完全な後方互換性を維持しつつ、段階的な移行が可能