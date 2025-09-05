# Core-Renderer分離アーキテクチャ設計

## 概要

既存のVanilla実装をコアロジック層として活用し、レンダリング層のみを切り替え可能にすることで、React版とVanilla版で同じビジネスロジックを共有する設計です。

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────┐
│                  Applications                    │
├──────────────────┬──────────────────────────────┤
│  Vanilla App     │        React App             │
│                  │                              │
│  ┌────────────┐  │  ┌────────────────────────┐ │
│  │  Vanilla   │  │  │    React Components    │ │
│  │  Renderer  │  │  │  <Canvas />            │ │
│  └─────┬──────┘  │  │  <Shape />             │ │
│        │         │  │  <Background />        │ │
│        │         │  └───────┬────────────────┘ │
│        │         │          │                  │
│        │         │  ┌───────▼────────────────┐ │
│        │         │  │   React Renderer       │ │
│        │         │  │   (Adapter Layer)      │ │
│        │         │  └───────┬────────────────┘ │
│        │         │          │                  │
├────────┴─────────┴──────────▼──────────────────┤
│              Core Business Logic                 │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │         @usketch/canvas-core               │ │
│  │  - CanvasManager (ロジックのみ)            │ │
│  │  - ShapeManager                            │ │
│  │  - InteractionManager                      │ │
│  │  - CameraController                        │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │         @usketch/store (Zustand)           │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │         @usketch/tools                     │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## 実装設計

### 1. Core層の再設計

#### CanvasManager (レンダリング非依存)

```typescript
// packages/canvas-core/src/managers/CanvasManager.ts
export interface Renderer {
  renderShape(shape: Shape): void;
  clearShapes(): void;
  updateCamera(camera: Camera): void;
  renderBackground(background: BackgroundOptions): void;
  renderSelection(shapes: Shape[]): void;
  renderPreview(shape: Shape | null): void;
}

export class CanvasManager {
  private renderer: Renderer;
  private interactionManager: InteractionManager;
  private shapeManager: ShapeManager;
  private cameraController: CameraController;
  
  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.setupManagers();
    this.subscribeToStore();
  }
  
  private handleShapeUpdate(shapes: Record<string, Shape>) {
    this.renderer.clearShapes();
    Object.values(shapes).forEach(shape => {
      this.renderer.renderShape(shape);
    });
  }
  
  private handleCameraUpdate(camera: Camera) {
    this.renderer.updateCamera(camera);
  }
  
  // ビジネスロジックのみ、レンダリングはrendererに委譲
  public addShape(shape: Shape) {
    whiteboardStore.getState().addShape(shape);
    // レンダリングは自動的にstore subscriptionで処理
  }
}
```

### 2. Vanilla Renderer実装

```typescript
// packages/canvas-vanilla-renderer/src/VanillaRenderer.ts
export class VanillaRenderer implements Renderer {
  private container: HTMLElement;
  private shapesContainer: HTMLElement;
  private selectionLayer: SelectionLayer;
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.setupLayers();
  }
  
  renderShape(shape: Shape): void {
    const element = this.createShapeElement(shape);
    this.shapesContainer.appendChild(element);
  }
  
  clearShapes(): void {
    this.shapesContainer.innerHTML = '';
  }
  
  private createShapeElement(shape: Shape): HTMLElement {
    // 既存のDOM生成ロジック
    const element = document.createElement('div');
    // ... スタイル設定
    return element;
  }
}
```

### 3. React Renderer実装

```typescript
// packages/canvas-react-renderer/src/ReactRenderer.tsx
export class ReactRenderer implements Renderer {
  private root: Root;
  private stateManager: ReactStateManager;
  
  constructor(container: HTMLElement) {
    this.root = createRoot(container);
    this.stateManager = new ReactStateManager();
  }
  
  renderShape(shape: Shape): void {
    this.stateManager.addShape(shape);
    this.render();
  }
  
  clearShapes(): void {
    this.stateManager.clearShapes();
    this.render();
  }
  
  private render(): void {
    this.root.render(
      <CanvasView 
        shapes={this.stateManager.shapes}
        camera={this.stateManager.camera}
        selection={this.stateManager.selection}
      />
    );
  }
}

// React Components
const CanvasView: React.FC<CanvasViewProps> = ({ shapes, camera, selection }) => {
  return (
    <div className="canvas-container">
      <BackgroundLayer camera={camera} />
      <ShapeLayer shapes={shapes} camera={camera} />
      <SelectionLayer selection={selection} camera={camera} />
    </div>
  );
};

const ShapeLayer: React.FC<{ shapes: Shape[], camera: Camera }> = ({ shapes, camera }) => {
  return (
    <div className="shape-layer" style={getCameraTransform(camera)}>
      {shapes.map(shape => (
        <ShapeComponent key={shape.id} shape={shape} />
      ))}
    </div>
  );
};
```

### 4. React Hooks でのCore活用

```typescript
// packages/canvas-react/src/hooks/useCanvas.ts
export const useCanvas = (containerRef: RefObject<HTMLElement>) => {
  const [canvasManager, setCanvasManager] = useState<CanvasManager | null>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // React Rendererを使用してCanvasManagerを初期化
    const renderer = new ReactRenderer(containerRef.current);
    const manager = new CanvasManager(renderer);
    setCanvasManager(manager);
    
    return () => {
      manager.destroy();
    };
  }, []);
  
  return canvasManager;
};

// 使用例
export const WhiteboardApp: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvas = useCanvas(containerRef);
  
  return (
    <div>
      <Toolbar onToolChange={(tool) => canvas?.setTool(tool)} />
      <div ref={containerRef} className="whiteboard-container" />
    </div>
  );
};
```

### 5. 背景レンダラーの抽象化

```typescript
// packages/backgrounds-core/src/BackgroundRenderer.ts
export abstract class BackgroundRenderer {
  abstract render(container: HTMLElement, camera: Camera, config: any): void;
  abstract cleanup(container: HTMLElement): void;
}

// Vanilla実装
export class VanillaDotsRenderer extends BackgroundRenderer {
  render(container: HTMLElement, camera: Camera, config: DotsConfig): void {
    // Canvas/SVGでの描画
  }
}

// React実装
export class ReactDotsRenderer extends BackgroundRenderer {
  private root: Root | null = null;
  
  render(container: HTMLElement, camera: Camera, config: DotsConfig): void {
    if (!this.root) {
      this.root = createRoot(container);
    }
    this.root.render(<DotsBackground camera={camera} config={config} />);
  }
  
  cleanup(container: HTMLElement): void {
    this.root?.unmount();
  }
}
```

## 移行戦略

### Phase 1: Core層のリファクタリング (1週間)
1. 既存のCanvasクラスからレンダリング部分を抽出
2. Rendererインターフェースの定義
3. ビジネスロジックをManagerクラスに分離

### Phase 2: Vanilla Renderer実装 (3日)
1. 既存のレンダリング処理をVanillaRendererに移行
2. 既存アプリの動作確認

### Phase 3: React Renderer実装 (1週間)
1. ReactRendererクラスの実装
2. React用のViewコンポーネント作成
3. カスタムフックの実装

### Phase 4: 統合テスト (3日)
1. 両方のレンダラーで同じ動作をすることを確認
2. パフォーマンステスト
3. E2Eテスト

## メリット

### 1. コードの再利用性
- ビジネスロジックを100%共有
- バグ修正が両バージョンに自動的に反映
- テストコードの共有

### 2. 保守性
- レンダリング層とロジック層の責務が明確
- 新しいレンダラー（Vue, Solid等）の追加が容易
- 単一責任の原則に従った設計

### 3. 段階的移行
- 既存のVanilla版を壊さずにReact版を開発
- 部分的な移行が可能
- リスクの最小化

### 4. パフォーマンス
- レンダリング最適化を各フレームワークに特化して実装可能
- Virtual DOMの恩恵をReact版で享受
- Vanilla版は軽量なまま維持

## 実装例

### Vanilla版の使用

```javascript
import { CanvasManager } from '@usketch/canvas-core';
import { VanillaRenderer } from '@usketch/canvas-vanilla-renderer';

const container = document.getElementById('canvas');
const renderer = new VanillaRenderer(container);
const canvas = new CanvasManager(renderer);

// 同じAPIで操作
canvas.addShape({ type: 'rectangle', ... });
```

### React版の使用

```jsx
import { Canvas } from '@usketch/canvas-react';

export const App = () => {
  return (
    <Canvas 
      onReady={(manager) => {
        // 同じCanvasManager APIを使用
        manager.addShape({ type: 'rectangle', ... });
      }}
    />
  );
};
```

## 技術的な考慮事項

### 1. イベント処理
- Core層でイベントを抽象化
- 各レンダラーが適切なイベントハンドラーを設定

### 2. 状態管理
- Zustandは既にReact/Vanilla両対応
- レンダラー固有の状態は各レンダラー内で管理

### 3. パフォーマンス最適化
- React版: useMemo, React.memo, Virtual DOM
- Vanilla版: RequestAnimationFrame, バッチ更新

### 4. TypeScript
- 共通の型定義を@usketch/shared-typesで管理
- Rendererインターフェースで型安全性を保証

## まとめ

この設計により、既存のVanilla実装をコアロジックとして活用し、レンダリング層のみをReact化することが可能になります。将来的には他のフレームワーク（Vue, Solid等）への対応も容易になり、プロジェクトの柔軟性と保守性が大幅に向上します。