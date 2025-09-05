# React完全移行計画

## 概要

uSketchプロジェクトをVanilla JavaScriptからReactへ完全移行する実装計画書です。
Core-Renderer分離ではなく、全コードベースをReact/TypeScriptで再実装し、よりシンプルで保守性の高いアーキテクチャを実現します。

## 移行方針

### 基本方針
- Vanilla版のメンテナンスを終了し、React版に一本化
- 既存のビジネスロジックはReact用に最適化して書き直し
- DOM操作を完全に排除し、すべてJSX/Reactコンポーネントで実装
- Zustand + React Hooksによる状態管理

## 現状分析

### 削除対象パッケージ
- `@usketch/whiteboard` (Vanilla版アプリ)
- DOM操作に依存している既存のcanvas-coreの大部分

### 移行対象パッケージ
- `@usketch/canvas-core` → `@usketch/react-canvas`
- `@usketch/ui-components` → Reactコンポーネントとして再実装
- `@usketch/backgrounds` → React/SVGコンポーネントとして再実装
- `@usketch/tools` → React Hooks + Zustandで再実装

### 維持するパッケージ
- `@usketch/shared-types` (型定義)
- `@usketch/store` (Zustandは既にReact対応)

## 新アーキテクチャ

```
┌──────────────────────────────────────────┐
│         React Whiteboard App              │
├──────────────────────────────────────────┤
│           React Components                │
│  ┌────────────────────────────────────┐  │
│  │ <WhiteboardCanvas />               │  │
│  │   ├── <BackgroundLayer />          │  │
│  │   ├── <ShapeLayer />               │  │
│  │   ├── <SelectionLayer />           │  │
│  │   └── <InteractionLayer />         │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│           Custom Hooks                    │
│  ┌────────────────────────────────────┐  │
│  │ useCanvas()                        │  │
│  │ useTools()                         │  │
│  │ useShapeManagement()               │  │
│  │ useInteraction()                   │  │
│  │ useKeyboardShortcuts()             │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│           State Management                │
│  ┌────────────────────────────────────┐  │
│  │ Zustand Stores                     │  │
│  │ - whiteboardStore                  │  │
│  │ - toolStore                        │  │
│  │ - uiStore                          │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## 実装計画

### Phase 1: React基盤構築（1週間）

#### 1.1 新パッケージ作成
```bash
packages/
  react-canvas/        # メインのReactキャンバス実装
  react-shapes/        # シェイプコンポーネント
  react-tools/         # ツール用Hooks
  react-backgrounds/   # 背景コンポーネント
```

#### 1.2 基本構造の実装

```tsx
// packages/react-canvas/src/WhiteboardCanvas.tsx
export const WhiteboardCanvas: React.FC = () => {
  const { shapes, camera, selectedIds } = useWhiteboardStore();
  const { activeTool } = useToolStore();
  const interactions = useInteraction();

  return (
    <div 
      className="whiteboard-canvas"
      {...interactions.getCanvasProps()}
    >
      <BackgroundLayer camera={camera} />
      <ShapeLayer shapes={shapes} camera={camera} />
      <SelectionLayer selectedIds={selectedIds} shapes={shapes} />
      <InteractionLayer activeTool={activeTool} />
    </div>
  );
};
```

### Phase 2: コンポーネント実装（2週間）

#### 2.1 シェイプコンポーネント

```tsx
// packages/react-shapes/src/components/Shape.tsx
export const Shape: React.FC<{ shape: ShapeModel }> = React.memo(({ shape }) => {
  const Component = shapeComponents[shape.type];
  
  if (!Component) return null;
  
  return (
    <div
      className="shape-wrapper"
      data-shape-id={shape.id}
      style={getShapeStyle(shape)}
    >
      <Component {...shape} />
    </div>
  );
});

// Rectangle.tsx
export const Rectangle: React.FC<RectangleShape> = ({ 
  width, 
  height, 
  fillColor, 
  strokeColor, 
  strokeWidth 
}) => {
  return (
    <div 
      className="shape-rectangle"
      style={{
        width,
        height,
        backgroundColor: fillColor,
        border: `${strokeWidth}px solid ${strokeColor}`,
      }}
    />
  );
};
```

#### 2.2 背景コンポーネント

```tsx
// packages/react-backgrounds/src/GridBackground.tsx
export const GridBackground: React.FC<GridBackgroundProps> = ({ 
  spacing = 20, 
  color = '#e0e0e0',
  camera 
}) => {
  const patternId = useId();
  
  return (
    <svg className="background-grid" style={getBackgroundStyle(camera)}>
      <defs>
        <pattern
          id={patternId}
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${spacing} 0 L 0 0 0 ${spacing}`}
            fill="none"
            stroke={color}
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
};
```

### Phase 3: インタラクション実装（1週間）

#### 3.1 カスタムフック

```tsx
// packages/react-tools/src/hooks/useInteraction.ts
export const useInteraction = () => {
  const { activeTool } = useToolStore();
  const { addShape, updateShape } = useWhiteboardStore();
  const [isDrawing, setIsDrawing] = useState(false);
  const [preview, setPreview] = useState<Shape | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!activeTool) return;
    
    const point = getCanvasPoint(e);
    activeTool.onPointerDown(point, {
      addShape,
      setPreview,
      setIsDrawing
    });
  }, [activeTool, addShape]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !activeTool) return;
    
    const point = getCanvasPoint(e);
    activeTool.onPointerMove(point, {
      updateShape,
      setPreview
    });
  }, [isDrawing, activeTool, updateShape]);

  return {
    getCanvasProps: () => ({
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    }),
    preview
  };
};
```

#### 3.2 ツールシステム

```tsx
// packages/react-tools/src/tools/RectangleTool.ts
export class RectangleTool implements Tool {
  private startPoint: Point | null = null;
  private currentShapeId: string | null = null;

  onPointerDown(point: Point, context: ToolContext) {
    this.startPoint = point;
    this.currentShapeId = generateId();
    
    const shape: RectangleShape = {
      id: this.currentShapeId,
      type: 'rectangle',
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      fillColor: context.fillColor,
      strokeColor: context.strokeColor,
      strokeWidth: context.strokeWidth,
    };
    
    context.addShape(shape);
    context.setIsDrawing(true);
  }

  onPointerMove(point: Point, context: ToolContext) {
    if (!this.startPoint || !this.currentShapeId) return;
    
    const width = Math.abs(point.x - this.startPoint.x);
    const height = Math.abs(point.y - this.startPoint.y);
    const x = Math.min(point.x, this.startPoint.x);
    const y = Math.min(point.y, this.startPoint.y);
    
    context.updateShape(this.currentShapeId, { x, y, width, height });
  }

  onPointerUp(context: ToolContext) {
    this.startPoint = null;
    this.currentShapeId = null;
    context.setIsDrawing(false);
  }
}
```

### Phase 4: 状態管理の最適化（1週間）

#### 4.1 Zustand Store の React最適化

```tsx
// packages/store/src/whiteboardStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface WhiteboardState {
  shapes: Record<string, Shape>;
  selectedIds: Set<string>;
  camera: Camera;
  
  // Actions
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  selectShapes: (ids: string[]) => void;
  updateCamera: (camera: Partial<Camera>) => void;
}

export const useWhiteboardStore = create<WhiteboardState>()(
  subscribeWithSelector(
    immer((set) => ({
      shapes: {},
      selectedIds: new Set(),
      camera: { x: 0, y: 0, zoom: 1 },
      
      addShape: (shape) => set((state) => {
        state.shapes[shape.id] = shape;
      }),
      
      updateShape: (id, updates) => set((state) => {
        if (state.shapes[id]) {
          Object.assign(state.shapes[id], updates);
        }
      }),
      
      deleteShape: (id) => set((state) => {
        delete state.shapes[id];
        state.selectedIds.delete(id);
      }),
      
      selectShapes: (ids) => set((state) => {
        state.selectedIds = new Set(ids);
      }),
      
      updateCamera: (camera) => set((state) => {
        Object.assign(state.camera, camera);
      }),
    }))
  )
);
```

#### 4.2 パフォーマンス最適化

```tsx
// Selective subscription
export const useShapes = () => {
  return useWhiteboardStore((state) => state.shapes);
};

export const useSelectedShapes = () => {
  const shapes = useWhiteboardStore((state) => state.shapes);
  const selectedIds = useWhiteboardStore((state) => state.selectedIds);
  
  return useMemo(
    () => Array.from(selectedIds).map(id => shapes[id]).filter(Boolean),
    [shapes, selectedIds]
  );
};

// React.memo with custom comparison
export const ShapeComponent = React.memo(
  Shape,
  (prevProps, nextProps) => {
    return (
      prevProps.shape.id === nextProps.shape.id &&
      prevProps.shape.x === nextProps.shape.x &&
      prevProps.shape.y === nextProps.shape.y &&
      // ... other property comparisons
    );
  }
);
```

### Phase 5: 移行とテスト（1週間）

#### 5.1 段階的移行

1. **新しいエントリーポイント作成**
   ```tsx
   // apps/whiteboard-react/src/App.tsx
   import { WhiteboardCanvas } from '@usketch/react-canvas';
   
   export const App = () => {
     return (
       <div className="app">
         <Toolbar />
         <WhiteboardCanvas />
         <PropertyPanel />
       </div>
     );
   };
   ```

2. **ルーティング設定**
   - `/` - 既存のVanilla版（一時的に維持）
   - `/react` - 新しいReact版
   - 動作確認後、React版をデフォルトに切り替え

3. **データ移行**
   - LocalStorageのデータ形式を統一
   - 既存データの変換スクリプト作成

#### 5.2 テスト戦略

```tsx
// Component Testing
describe('WhiteboardCanvas', () => {
  it('should render shapes correctly', () => {
    const { getByTestId } = render(
      <WhiteboardCanvas initialShapes={mockShapes} />
    );
    
    expect(getByTestId('shape-layer')).toBeInTheDocument();
    expect(getByTestId('shape-rect-1')).toBeInTheDocument();
  });
});

// Integration Testing with React Testing Library
describe('Drawing Interaction', () => {
  it('should create rectangle on drag', async () => {
    const { container } = render(<WhiteboardCanvas />);
    const canvas = container.querySelector('.whiteboard-canvas');
    
    await userEvent.pointer([
      { coords: { x: 100, y: 100 }, target: canvas },
      { coords: { x: 200, y: 200 } },
    ]);
    
    expect(screen.getByTestId(/shape-rectangle/)).toBeInTheDocument();
  });
});

// E2E Testing with Playwright
test('complete drawing workflow', async ({ page }) => {
  await page.goto('/react');
  await page.click('[data-tool="rectangle"]');
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(200, 200);
  await page.mouse.up();
  
  const shapes = await page.locator('.shape-rectangle').count();
  expect(shapes).toBe(1);
});
```

### Phase 6: クリーンアップと最適化（3日）

#### 6.1 不要コードの削除
- Vanilla版のコード削除
- 未使用の依存関係削除
- パッケージ構造の整理

#### 6.2 ビルド最適化
```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'state': ['zustand', 'immer'],
          'shapes': ['@usketch/react-shapes'],
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand']
  }
});
```

## 移行チェックリスト

### 必須タスク
- [ ] React版の基本構造実装
- [ ] 全シェイプタイプのReactコンポーネント化
- [ ] ツールシステムのReact Hook化
- [ ] 選択・変形機能の実装
- [ ] Undo/Redo機能の移植
- [ ] キーボードショートカットの実装
- [ ] 背景レンダラーのReact化
- [ ] E2Eテストの全面通過

### 性能目標
- [ ] 1000個のシェイプで60fps維持
- [ ] 初期レンダリング時間 < 100ms
- [ ] バンドルサイズ < 200KB (gzipped)
- [ ] Lighthouse Performance Score > 90

### 品質目標
- [ ] TypeScript strictモード対応
- [ ] ESLint/Prettier準拠
- [ ] テストカバレッジ > 80%
- [ ] アクセシビリティ基準準拠

## リスクと対策

### リスク1: パフォーマンス低下
**対策**: 
- React.memo, useMemo, useCallbackの適切な使用
- 仮想化（react-window）の導入検討
- Web Workers活用の検討

### リスク2: 機能の欠落
**対策**:
- 既存機能の完全なリストアップ
- 段階的なユーザーテスト
- フィーチャーフラグによる段階リリース

### リスク3: 移行期間中の二重メンテナンス
**対策**:
- 重要なバグ修正のみVanilla版に適用
- 新機能はReact版のみに追加
- 明確な移行期限の設定（3ヶ月以内）

## タイムライン

### Week 1
- React基盤構築
- 基本的なキャンバスレンダリング

### Week 2-3
- シェイプコンポーネント実装
- インタラクション機能

### Week 4
- ツールシステム完成
- 状態管理の最適化

### Week 5
- 移行作業
- テスト実装
- バグ修正

### Week 6
- パフォーマンス最適化
- 最終調整
- Vanilla版の廃止

## まとめ

この計画により、uSketchを完全にReactベースのモダンなアプリケーションに移行します。Vanilla版との並行運用を避けることで、開発リソースを集中でき、よりシンプルで保守性の高いコードベースを実現できます。React エコシステムのツールやライブラリを最大限活用し、開発効率と品質の向上を目指します。