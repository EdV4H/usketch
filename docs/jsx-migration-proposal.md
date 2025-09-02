# React JSX Migration Proposal

## 概要

uSketchのReact版実装において、現在DOM操作や命令的なコードで実装されている部分をJSXとReactコンポーネントに移行し、よりReactらしい宣言的な実装にする提案書です。

**重要な更新**: Core-Renderer分離アーキテクチャを採用し、既存のVanilla実装をコアロジックとして活用しながら、レンダリング層のみをReact化する設計に変更しました。詳細は[Core-Renderer分離アーキテクチャ設計](./core-renderer-separation-architecture.md)を参照してください。

## 現状の課題

### 1. Canvas クラスでのDOM直接操作

**問題箇所**: `packages/canvas-core/src/canvas.ts`

現在、Canvasクラス内で以下のようなDOM要素を直接作成・操作しています：

- `document.createElement` で各レイヤーのコンテナを作成
- `innerHTML` でコンテナの内容をクリア
- シェイプ要素を動的に生成してDOMに追加
- スタイル属性の直接操作

```typescript
// 現在の実装例
this.backgroundContainer = document.createElement("div");
this.shapesContainer.innerHTML = "";
element.style.position = "absolute";
```

### 2. シェイプレンダリングの命令的実装

**問題箇所**: `createShapeElement`, `createRectangleElement`, `createEllipseElement`, `createFreedrawElement`

各シェイプのレンダリングがDOM操作で行われており、Reactコンポーネントとして実装されていません。

### 3. SelectionLayerクラスでのDOM操作

**問題箇所**: `packages/ui-components/src/selection-layer.ts`

選択領域の表示も同様にDOM操作で実装されています。

### 4. 背景レンダラーのDOM操作

**問題箇所**: `packages/backgrounds/src/renderers/`

各背景レンダラー（Grid, Dots, Lines, Isometric）もCanvasやSVG要素を直接操作しています。

## 提案する解決策

### アーキテクチャ方針: Core-Renderer分離

既存のVanilla実装をコアビジネスロジック層として保持し、レンダリング層のみを切り替え可能にすることで、React版とVanilla版で同じロジックを共有します。

### 1. レイヤーコンポーネントの React 化

#### Canvas コンポーネントの再設計

```tsx
// packages/canvas-react/src/Canvas.tsx
export const Canvas: React.FC<CanvasProps> = ({ options }) => {
  const { camera, shapes, selectedShapeIds } = useWhiteboardStore();
  
  return (
    <div className="whiteboard-canvas" role="application">
      <BackgroundLayer 
        renderer={options.background?.renderer}
        config={options.background?.config}
        camera={camera}
      />
      <ShapeLayer 
        shapes={shapes}
        camera={camera}
      />
      <PreviewLayer 
        camera={camera}
      />
      <SelectionLayer 
        selectedShapes={selectedShapes}
        camera={camera}
      />
    </div>
  );
};
```

### 2. シェイプコンポーネントの実装

```tsx
// packages/canvas-react/src/components/shapes/Rectangle.tsx
export const Rectangle: React.FC<RectangleProps> = ({ shape }) => {
  return (
    <div
      className="shape-rectangle"
      data-shape-id={shape.id}
      data-shape-type="rectangle"
      style={{
        width: shape.width,
        height: shape.height,
        backgroundColor: shape.fillColor,
        border: `${shape.strokeWidth}px solid ${shape.strokeColor}`,
        transform: `translate(${shape.x}px, ${shape.y}px) rotate(${shape.rotation}deg)`,
        opacity: shape.opacity,
      }}
    />
  );
};
```

### 3. 背景レンダラーのReact化

```tsx
// packages/backgrounds-react/src/DotsBackground.tsx
export const DotsBackground: React.FC<DotsBackgroundProps> = ({ config, camera }) => {
  return (
    <svg className="background-dots" style={getBackgroundStyle(camera)}>
      <pattern id="dots-pattern" {...getPatternProps(config, camera)}>
        <circle cx={config.spacing / 2} cy={config.spacing / 2} r={config.size} fill={config.color} />
      </pattern>
      <rect width="100%" height="100%" fill="url(#dots-pattern)" />
    </svg>
  );
};
```

### 4. カスタムフックの活用

```tsx
// packages/canvas-react/src/hooks/useCanvasInteraction.ts
export const useCanvasInteraction = () => {
  const toolManager = useToolManager();
  const { camera, setCamera } = useWhiteboardStore();
  
  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    // ツール処理とパン処理
  }, [toolManager, camera]);
  
  return { handlePointerDown, handlePointerMove, handlePointerUp, handleWheel };
};
```

## 実装計画

### Phase 1: 基盤整備（1週間）

1. **Core層のリファクタリング**
   - レンダリング部分をCanvasクラスから分離
   - Rendererインターフェースの定義
   - ビジネスロジックのManager化

2. **新パッケージの作成**
   - `@usketch/canvas-vanilla-renderer`: Vanilla版レンダラー
   - `@usketch/canvas-react-renderer`: React版レンダラー
   - `@usketch/canvas-react`: React統合パッケージ

2. **型定義の共有化**
   - 既存の型定義を活用
   - React専用のPropsインターフェース定義

### Phase 2: コンポーネント実装（2週間）

1. **レイヤーコンポーネント**
   - BackgroundLayer
   - ShapeLayer
   - PreviewLayer
   - SelectionLayer

2. **シェイプコンポーネント**
   - Rectangle
   - Ellipse
   - Freedraw
   - 将来的な拡張に対応した基底コンポーネント

3. **背景コンポーネント**
   - DotsBackground
   - GridBackground
   - LinesBackground
   - IsometricBackground

### Phase 3: インタラクション実装（1週間）

1. **カスタムフック**
   - useCanvasInteraction
   - useToolManager
   - useShapeSelection
   - useCanvasZoom

2. **イベント処理**
   - Reactイベントハンドラーへの移行
   - パフォーマンス最適化（useMemo, useCallback）

### Phase 4: 統合とテスト（1週間）

1. **既存アプリへの統合**
   - apps/whiteboard への組み込み
   - 後方互換性の確保

2. **テスト**
   - ユニットテスト
   - E2Eテスト
   - パフォーマンステスト

## メリット

### 1. React エコシステムとの親和性
- Reactの宣言的なパラダイムに従った実装
- React DevToolsでのデバッグが容易
- React Hooksパターンの活用

### 2. 保守性の向上
- コンポーネントベースの設計により責務が明確
- テストが書きやすい
- 状態管理がシンプル

### 3. パフォーマンスの最適化
- React の仮想DOM による効率的な更新
- React.memo による不要な再レンダリング防止
- Concurrent Features の活用可能性

### 4. 開発者体験の向上
- JSX による直感的なUI構造
- TypeScript との相性が良い
- Hot Module Replacement の恩恵

## 考慮事項

### 1. パフォーマンス
- 大量のシェイプを扱う場合の最適化が必要
- React.memo や useMemo の適切な使用
- 必要に応じて react-window などの仮想化ライブラリの検討

### 2. 移行戦略
- Core-Renderer分離により段階的な移行が可能
- 既存のVanilla JS版のロジックを100%再利用
- 同じCanvasManager APIで両バージョンを操作可能
- レンダラーの切り替えのみで移行完了

### 3. バンドルサイズ
- React版のバンドルサイズ増加への対処
- Tree shaking の最適化
- Dynamic import の活用

## 成功指標

1. **機能の完全性**
   - Vanilla JS版と同等の機能を提供
   - すべてのE2Eテストが通過

2. **パフォーマンス**
   - 1000個のシェイプで60fps維持
   - 初期レンダリング時間 < 100ms

3. **開発者体験**
   - コンポーネントの再利用率 > 70%
   - テストカバレッジ > 80%

## タイムライン

- **Week 1**: Phase 1 - 基盤整備
- **Week 2-3**: Phase 2 - コンポーネント実装
- **Week 4**: Phase 3 - インタラクション実装
- **Week 5**: Phase 4 - 統合とテスト

## 次のステップ

1. この提案書のレビューと承認
2. 詳細な技術仕様書の作成
3. プロトタイプの実装
4. チームでの技術検証

## 参考資料

- [React Documentation](https://react.dev/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [Virtual DOM and Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html)