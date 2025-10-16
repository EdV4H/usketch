# Shape System Refactoring Plan

**作成日**: 2025-10-15
**ステータス**: 提案中
**目的**: Shape管理システムの設計問題を解決し、保守性・テスタビリティ・拡張性を向上させる

---

## 📋 目次

- [背景と動機](#背景と動機)
- [現在の設計分析](#現在の設計分析)
- [問題点の詳細](#問題点の詳細)
- [リファクタリング提案](#リファクタリング提案)
- [リファクタリング効果の比較](#リファクタリング効果の比較)
- [移行計画](#移行計画)
- [期待される効果](#期待される効果)

---

## 🎯 背景と動機

uSketchのShape管理システムは、プラグインアーキテクチャを採用し拡張性を重視した設計となっています。しかし、開発が進むにつれて以下の課題が顕在化してきました：

- **二重登録システム**による管理の複雑化
- **責務の重複**によるコードの冗長性
- **テストの困難さ**（グローバル状態への依存）
- **パフォーマンス懸念**（不要なレンダラー再生成）

本ドキュメントでは、これらの問題を体系的に分析し、段階的なリファクタリング計画を提案します。

---

## 🏗️ 現在の設計分析

### アーキテクチャ概要

```
┌────────────────────────────────────────────────────────────────────┐
│                      Application Layer                             │
│                    (@usketch/app / Canvas)                         │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ↓
┌────────────────────────────────────────────────────────────────────┐
│                  Integration Layer                                 │
│               (@usketch/react-canvas)                              │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  UnifiedShapeRenderer                                    │     │
│  │  - レンダリングモード切替 (SVG/HTML/Hybrid)              │     │
│  │  - ShapeFactory統合                                      │     │
│  └──────────────────────────────────────────────────────────┘     │
└────────────────────────────┬───────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ↓              ↓              ↓
  ┌─────────────────┐ ┌─────────────┐ ┌─────────────┐
  │  ShapeFactory   │ │  Registry   │ │   Plugins   │
  │  (静的Map)      │ │ (インスタンス)│ │             │
  └─────────────────┘ └─────────────┘ └─────────────┘
```

### 主要コンポーネント

#### 1. ShapeFactory（`@usketch/shape-abstraction`）

```typescript
class ShapeFactory {
  private static renderers = new Map<string, ShapeRendererConstructor>();

  static register(type: string, RendererClass: Constructor): void;
  static create(shape: Shape, config?: Config): ShapeRenderer;
  static has(type: string): boolean;
}
```

- **役割**: ShapeRenderer クラスの登録と生成
- **特徴**: 静的メソッド、グローバルな状態管理

#### 2. ShapeRegistry（`@usketch/shape-registry`）

```typescript
class ShapeRegistry {
  private plugins = new Map<string, ShapePlugin>();

  register(plugin: ShapePlugin): void;
  getPlugin(type: string): ShapePlugin | undefined;
  createDefaultShape(type: string, props: any): BaseShape | null;
}
```

- **役割**: ShapePlugin の登録と管理
- **特徴**: インスタンスベース、イベントリスナー対応

#### 3. BaseShape（`@usketch/shape-abstraction`）

```typescript
abstract class BaseShape<T> implements ShapeRenderer<T> {
  abstract render(): React.ReactElement;
  abstract getBounds(): Bounds;
  abstract hitTest(point: Point): boolean;

  onDrag?(delta: Point): void;
  onResize?(handle: ResizeHandle, delta: Point): void;

  protected transformToScreen(point: Point): Point;
  protected transformToWorld(point: Point): Point;
}
```

- **役割**: Shape レンダラーの基底クラス
- **特徴**: 座標変換、ドラッグ・リサイズのデフォルト実装

#### 4. ShapePlugin（`@usketch/shape-registry`）

```typescript
interface ShapePlugin<TShape extends Shape> {
  type: string;
  name?: string;
  component: React.ComponentType<ShapeComponentProps<TShape>>;
  toolComponent?: React.ComponentType<ToolProps>;

  createDefaultShape: (props: CreateShapeProps) => TShape;
  getBounds: (shape: TShape) => Bounds;
  hitTest: (shape: TShape, point: Point) => boolean;

  serialize?: (shape: TShape) => any;
  deserialize?: (data: any) => TShape;
  validate?: (shape: TShape) => boolean;

  getResizeHandles?: (shape: TShape) => Point[];
  getRotationHandle?: (shape: TShape) => Point;
}
```

- **役割**: Shape の振る舞いを定義するプラグインインターフェース
- **特徴**: React コンポーネントと幾何計算を含む

#### 5. UnifiedShapePluginAdapter（`@usketch/shape-registry`）

```typescript
class UnifiedShapePluginAdapter {
  static createPlugin(
    ShapeClass: ShapeRendererConstructor,
    config: { type: string; createDefaultShape: Function }
  ): ShapePlugin {
    // ShapeFactory に登録
    ShapeFactory.register(config.type, ShapeClass);

    // ShapePlugin を返却
    return {
      type: config.type,
      component: (props) => (
        <UnifiedShapeRenderer shape={props.shape} ... />
      ),
      getBounds: (shape) => {
        const renderer = ShapeFactory.create(shape);
        return renderer.getBounds();
      },
      // ...
    };
  }
}
```

- **役割**: BaseShape と ShapePlugin を橋渡し
- **特徴**: 両方のシステムに登録する責任を持つ

---

## ❌ 問題点の詳細

### 1️⃣ 二重登録システムの存在

#### 問題の構造

```
ShapeFactory (静的レジストリ)
├─ Map<string, ShapeRendererConstructor>
├─ グローバルスコープ
└─ 静的メソッドのみ

        ↕ 同期が必要

ShapeRegistry (インスタンスレジストリ)
├─ Map<string, ShapePlugin>
├─ インスタンスごとに状態
└─ イベントリスナー対応
```

#### 具体的な問題

**問題1: 登録の重複**
```typescript
// unified-shape-plugin-adapter.tsx:28-29
ShapeFactory.register(config.type, ShapeClass);  // 1箇所目

// 同時に ShapePlugin も作成 → ShapeRegistry に登録される (2箇所目)
return {
  type: config.type,
  component: (props) => { /* ... */ },
  getBounds: (shape) => {
    // また ShapeFactory を呼び出す...
    const renderer = ShapeFactory.create(shape);
    return renderer.getBounds();
  },
};
```

**問題2: 同期ずれのリスク**
```typescript
// ShapeFactory にのみ登録された場合
ShapeFactory.register('custom', CustomShapeRenderer);
ShapeFactory.has('custom');  // true
registry.hasPlugin('custom');  // false ← 不整合！

// ShapeRegistry にのみ登録された場合
registry.register(customPlugin);
registry.hasPlugin('custom');  // true
ShapeFactory.has('custom');    // false ← 不整合！
```

**問題3: テストでのクリーンアップが複雑**
```typescript
afterEach(() => {
  // 両方をクリアしなければならない
  ShapeFactory.clear();
  registry.clear();
});
```

#### 影響範囲

- **コード**: `UnifiedShapePluginAdapter`, `UnifiedShapeRenderer`, プラグイン登録コード
- **テスト**: すべてのShape関連テスト
- **パフォーマンス**: 二重管理によるメモリオーバーヘッド

---

### 2️⃣ BaseShape と ShapePlugin の役割重複

#### 責務の比較

| 機能 | BaseShape | ShapePlugin | 問題 |
|------|-----------|-------------|------|
| `render()` | 抽象メソッド | `component` プロパティ | 両方で定義 |
| `getBounds()` | 抽象メソッド | メソッド | **重複実装が必要** |
| `hitTest()` | 抽象メソッド | メソッド | **重複実装が必要** |
| `onDrag()` | デフォルト実装 | なし | 片方のみ |
| `createDefaultShape()` | なし | メソッド | 片方のみ |

#### 実装の重複例

**RectanglePlugin の getBounds**
```typescript
// shape-plugins/rectangle/index.ts:25-30
export const rectanglePlugin: ShapePlugin<RectangleShape> = {
  // ...
  getBounds: (shape) => ({
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
  }),
};
```

**Rectangle BaseShape の getBounds**
```typescript
// もし BaseShape を使う場合、こちらも実装が必要
class RectangleRenderer extends BaseShape<RectangleShape> {
  getBounds(): Bounds {
    return {
      x: this.shape.x,
      y: this.shape.y,
      width: this.shape.width,
      height: this.shape.height,
    };
  }
}
```

#### なぜ問題か

1. **DRY原則違反**: 同じロジックを2箇所に書く必要がある
2. **保守コスト**: 変更時に両方を更新しなければならない
3. **不整合リスク**: 片方だけ更新すると動作が異なる
4. **学習コスト**: 新規開発者が「どちらを実装すべきか」混乱

---

### 3️⃣ UnifiedShapeRenderer の過度な責任

#### 現在の実装（63行）

```typescript
export const UnifiedShapeRenderer: React.FC = ({
  shape,
  isSelected,
  camera,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) => {
  // 責任1: ShapeFactory を使ってレンダラーを生成
  const renderer = useMemo(() => {
    try {
      return ShapeFactory.create(shape);
    } catch {
      return null;
    }
  }, [shape.type, shape.id, shape]);  // 複雑な依存配列

  if (!renderer) return null;

  // 責任2: レンダラーの状態を更新
  renderer.camera = camera;
  renderer.isSelected = isSelected;
  renderer.shape = shape;

  // 責任3: レンダリングモードを判定
  const renderMode = renderer.getRenderMode();

  const wrapperProps = {
    renderer,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };

  // 責任4: 適切なラッパーを選択
  switch (renderMode) {
    case "html":
    case "hybrid":
      return <HtmlWrapper {...wrapperProps} />;
    default:
      return <SvgWrapper {...wrapperProps} />;
  }
};
```

#### 問題点

**1. God Component**
- 生成、更新、判定、描画すべてを担当
- 単一責任の原則 (SRP) 違反

**2. useMemo の依存配列が複雑**
```typescript
useMemo(() => { /* ... */ }, [shape.type, shape.id, shape]);
//                              ^^^^^^^^^^^^^^^^^^^^^^^^
//                              shape全体が変わるたびに再生成
```

**3. ミューテーション**
```typescript
renderer.camera = camera;      // レンダラーを直接変更
renderer.isSelected = isSelected;  // React の原則に反する
renderer.shape = shape;
```

**4. ShapeFactory への直接依存**
- テストでモック化が困難
- 静的メソッドのため依存性注入不可

#### パフォーマンス問題

```typescript
// shape の任意のプロパティが変わるたびに...
const renderer = useMemo(() => {
  return ShapeFactory.create(shape);  // 毎回新しいインスタンス生成
}, [shape.type, shape.id, shape]);
```

- Shape の位置が変わるだけで再生成
- 不要なメモリアロケーション
- GC の負荷増大

---

### 4️⃣ HtmlWrapper の複雑すぎる実装

#### 実装の規模

- **284行** の単一コンポーネント
- **2つのレンダリングモード** を1つのコンポーネントで管理
- **複数の useEffect** と DOM 操作

#### レンダリングモードの切り替え

```typescript
export const HtmlWrapper = ({ renderer, ... }) => {
  const [useForeignObject, setUseForeignObject] = useState(true);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  // foreignObject モード
  if (useForeignObject) {
    return (
      <foreignObject x={...} y={...} width={...} height={...}>
        <div>{shapeElement}</div>
      </foreignObject>
    );
  }

  // Portal モード
  return (
    <>
      <rect /* SVG placeholder for hit detection */ />
      {container && ReactDOM.createPortal(
        <div>{shapeElement}</div>,
        container
      )}
    </>
  );
};
```

#### 問題点

**1. 複雑な DOM 操作**
```typescript
useEffect(() => {
  const div = document.createElement("div");
  div.style.position = "absolute";
  div.dataset.shapeId = renderer.shape.id;
  div.className = "html-shape-container";

  // Find the HTML shapes layer
  const canvasContainer =
    document.querySelector(".html-shapes-layer") ||
    document.querySelector(".whiteboard-canvas") ||
    document.querySelector(".whiteboard-container") ||
    document.body;  // フォールバック

  if (canvasContainer) {
    canvasContainer.appendChild(div);
    setContainer(div);
  }

  return () => {
    const divToRemove = document.querySelector(
      `.html-shape-container[data-shape-id="${renderer.shape.id}"]`
    );
    if (divToRemove?.parentNode) {
      divToRemove.parentNode.removeChild(divToRemove);
    }
  };
}, [useForeignObject, renderer.shape.id]);
```

**2. カメラ変換の重複計算**
```typescript
// 親が transform を持っているか確認
const parentHasTransform = container.parentElement?.classList.contains("html-shapes-layer");

if (parentHasTransform) {
  // ケース1: 親の transform を使う
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
} else {
  // ケース2: 自分で transform を計算
  container.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
}
```

- BaseShape にも同様のロジック
- 計算方法が微妙に異なる可能性

**3. テストの困難さ**
- DOM 操作が多い
- `querySelector` に依存
- 非同期のクリーンアップ
- Portal のテストが複雑

---

### 5️⃣ グローバルシングルトンの濫用

#### 現在のグローバル状態

```typescript
// 1. ShapeFactory: 静的 Map
class ShapeFactory {
  private static renderers = new Map<string, Constructor>();
}

// 2. globalShapeRegistry: シングルトンインスタンス
export const globalShapeRegistry = new ShapeRegistry();

// 3. whiteboardStore: Zustand グローバルストア
export const whiteboardStore = create<WhiteboardState>(...);
```

#### 問題点

**1. テストの独立性がない**
```typescript
describe('Shape rendering', () => {
  test('test 1', () => {
    ShapeFactory.register('custom', CustomRenderer);
    // test...
  });

  test('test 2', () => {
    // test 1 の影響が残っている！
    ShapeFactory.has('custom');  // true
  });
});
```

**2. マルチキャンバス対応が困難**
```typescript
// 同一ページに2つのホワイトボードを表示したい
<div>
  <WhiteboardCanvas id="canvas1" />  {/* 同じ ShapeFactory を使う */}
  <WhiteboardCanvas id="canvas2" />  {/* 独立した設定ができない */}
</div>
```

**3. SSR（サーバーサイドレンダリング）の問題**
```typescript
// サーバー側
const html1 = renderToString(<Whiteboard />);
const html2 = renderToString(<Whiteboard />);
// ↑ 2つのレンダリングで状態が共有される
```

**4. モック・スタブの注入が困難**
```typescript
// ShapeFactory の静的メソッドはモック化しにくい
test('with mock', () => {
  // これは難しい...
  jest.spyOn(ShapeFactory, 'create').mockReturnValue(mockRenderer);
});
```

---

### 6️⃣ 座標変換ロジックの分散

#### 実装箇所

```
座標変換の実装が散在:
├─ BaseShape.transformToScreen()           (shape-abstraction/base-shape.ts:73-77)
├─ BaseShape.transformToWorld()            (shape-abstraction/base-shape.ts:80-84)
├─ HtmlWrapper (カメラ変換の手動計算)      (shape-abstraction/html-wrapper.tsx:83-103)
├─ SelectionTool (座標変換)                (tools/...)
└─ PanTool (座標変換)                      (tools/...)
```

#### コードの重複

**BaseShape での実装**
```typescript
protected transformToScreen(point: Point): Point {
  return {
    x: point.x * this.camera.zoom + this.camera.x,
    y: point.y * this.camera.zoom + this.camera.y,
  };
}

protected transformToWorld(point: Point): Point {
  return {
    x: (point.x - this.camera.x) / this.camera.zoom,
    y: (point.y - this.camera.y) / this.camera.zoom,
  };
}
```

**HtmlWrapper での実装**
```typescript
// 親の transform を考慮した計算
if (parentHasTransform) {
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
} else {
  container.style.transform =
    `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
}
```

#### 問題点

1. **DRY原則違反**: 同じ計算式が複数箇所に
2. **不整合のリスク**: 微妙に異なる実装の可能性
3. **テストの重複**: すべての箇所で同じテストが必要
4. **保守性**: カメラ変換のロジック変更時に全箇所を修正

---

## ✅ リファクタリング提案

### 🎯 リファクタリング原則

本リファクタリングは以下の設計原則に基づきます：

1. **単一責任の原則** (SRP): 各クラス・関数は1つの責務のみ
2. **依存性逆転の原則** (DIP): 抽象に依存、具象に依存しない
3. **関心の分離** (SoC): ビジネスロジックと UI/描画を分離
4. **Pure Functions**: 副作用を最小化、テスタビリティを向上
5. **Dependency Injection**: グローバル状態を排除、依存性を注入可能に

---

### 📐 新アーキテクチャ提案

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│                    (@usketch/app)                           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│              Canvas Layer (@usketch/react-canvas)           │
│  ┌────────────────────────────────────────────────────┐     │
│  │  ShapeRenderer (Simplified)                        │     │
│  │  - Plugin から直接コンポーネント取得               │     │
│  │  - Factory 不要                                    │     │
│  │  - Pure Component として実装                       │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│         Unified Plugin System (@usketch/shape-system)       │
│  ┌────────────────────────────────────────────────────┐     │
│  │  ShapePlugin (Enhanced)                            │     │
│  │  - component: React.ComponentType                  │     │
│  │  - createDefaultShape(props): Shape                │     │
│  │  - getBounds(shape): Bounds                        │     │
│  │  - hitTest(shape, point): boolean                  │     │
│  │  - すべて Pure Function で実装                     │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  ShapeRegistry (Improved)                          │     │
│  │  - 単一のレジストリ（Factory を廃止）             │     │
│  │  - Context 経由で注入可能                          │     │
│  │  - イベント駆動の変更通知                          │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│       Core Services (@usketch/core)                         │
│  ┌──────────────────┐  ┌────────────────────────────┐       │
│  │ CoordinateSystem │  │  ShapeBoundsCalculator     │       │
│  │ (座標変換の統一) │  │  (幾何計算の統一)          │       │
│  └──────────────────┘  └────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

### 🔧 具体的リファクタリング案

#### 案1: ShapeFactory を廃止、Registry に一本化

**Before**
```typescript
// ❌ 二重登録が必要
ShapeFactory.register('rectangle', RectangleRenderer);
registry.register(rectanglePlugin);

// ❌ 2箇所を確認
if (ShapeFactory.has('rectangle') && registry.hasPlugin('rectangle')) {
  // ...
}
```

**After**
```typescript
// ✅ ShapeFactory を完全削除

// ✅ ShapeRegistry を拡張して Factory 機能を統合
class ShapeRegistry {
  private plugins = new Map<string, ShapePlugin>();

  register(plugin: ShapePlugin): void {
    this.plugins.set(plugin.type, plugin);
  }

  registerMultiple(plugins: ShapePlugin[]): void {
    plugins.forEach(plugin => this.register(plugin));
  }

  // Factory 機能を統合
  getComponent(type: string): React.ComponentType | undefined {
    return this.plugins.get(type)?.component;
  }

  createDefaultShape(type: string, props: CreateShapeProps): Shape | null {
    const plugin = this.plugins.get(type);
    return plugin ? plugin.createDefaultShape(props) : null;
  }

  getBounds(shape: Shape): Bounds {
    const plugin = this.plugins.get(shape.type);
    if (!plugin) throw new Error(`Unknown shape type: ${shape.type}`);
    return plugin.getBounds(shape);
  }

  hitTest(shape: Shape, point: Point): boolean {
    const plugin = this.plugins.get(shape.type);
    if (!plugin) return false;
    return plugin.hitTest(shape, point);
  }
}
```

**メリット**
- ✅ 登録が1箇所で完結
- ✅ 同期ずれの心配なし
- ✅ API がシンプルに
- ✅ テストのクリーンアップが簡単

---

#### 案2: BaseShape を廃止、Pure Function に移行

**Before**
```typescript
// ❌ BaseShape を継承してクラスを作る
class RectangleRenderer extends BaseShape<RectangleShape> {
  render(): React.ReactElement {
    return <Rectangle shape={this.shape} />;
  }

  getBounds(): Bounds {
    return {
      x: this.shape.x,
      y: this.shape.y,
      width: this.shape.width,
      height: this.shape.height,
    };
  }

  hitTest(point: Point): boolean {
    return (
      point.x >= this.shape.x &&
      point.x <= this.shape.x + this.shape.width &&
      point.y >= this.shape.y &&
      point.y <= this.shape.y + this.shape.height
    );
  }
}

// ❌ Plugin も定義（重複）
export const rectanglePlugin: ShapePlugin<RectangleShape> = {
  type: "rectangle",
  component: Rectangle,
  getBounds: (shape) => ({ /* 同じロジック */ }),
  hitTest: (shape, point) => { /* 同じロジック */ },
};
```

**After**
```typescript
// ✅ BaseShape クラスを完全削除

// ✅ Plugin は Pure Function のみで実装
export const rectanglePlugin: ShapePlugin<RectangleShape> = {
  type: "rectangle",
  name: "Rectangle",
  component: Rectangle,  // Pure React Component

  // ✅ Factory: Pure Function
  createDefaultShape: ({ id, x, y }) => ({
    id,
    type: "rectangle",
    x,
    y,
    width: DEFAULT_SHAPE_SIZE.width,
    height: DEFAULT_SHAPE_SIZE.height,
    rotation: 0,
    opacity: DEFAULT_SHAPE_STYLES.opacity,
    strokeColor: DEFAULT_SHAPE_STYLES.strokeColor,
    fillColor: DEFAULT_SHAPE_STYLES.fillColor,
    strokeWidth: DEFAULT_SHAPE_STYLES.strokeWidth,
  }),

  // ✅ 幾何計算: Pure Function
  getBounds: (shape) => ({
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
  }),

  // ✅ 当たり判定: Pure Function
  hitTest: (shape, point) => (
    point.x >= shape.x &&
    point.x <= shape.x + shape.width &&
    point.y >= shape.y &&
    point.y <= shape.y + shape.height
  ),

  // ✅ シリアライズ: Pure Function
  serialize: (shape) => ({ ...shape }),
  deserialize: (data) => ({ ...data, type: "rectangle" }),

  // ✅ バリデーション: Pure Function
  validate: (shape) => (
    shape.type === "rectangle" &&
    typeof shape.width === "number" &&
    typeof shape.height === "number" &&
    shape.width > 0 &&
    shape.height > 0
  ),
};
```

**メリット**
- ✅ クラス不要 → シンプル
- ✅ 責務の重複解消
- ✅ テストが容易（Pure Function）
- ✅ Tree Shaking 可能（未使用コードを削除）
- ✅ 学習コストが低い

---

#### 案3: UnifiedShapeRenderer を簡素化

**Before (63行)**
```tsx
export const UnifiedShapeRenderer: React.FC = ({
  shape,
  isSelected,
  camera,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) => {
  // ❌ Factory でレンダラー生成
  const renderer = useMemo(() => {
    try {
      return ShapeFactory.create(shape);
    } catch {
      return null;
    }
  }, [shape.type, shape.id, shape]);

  if (!renderer) return null;

  // ❌ ミューテーション
  renderer.camera = camera;
  renderer.isSelected = isSelected;
  renderer.shape = shape;

  // ❌ レンダリングモード判定
  const renderMode = renderer.getRenderMode();

  const wrapperProps = {
    renderer,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };

  // ❌ ラッパー選択
  switch (renderMode) {
    case "html":
    case "hybrid":
      return <HtmlWrapper {...wrapperProps} />;
    default:
      return <SvgWrapper {...wrapperProps} />;
  }
};
```

**After (~25行)**
```tsx
// ✅ シンプルな実装
export const ShapeRenderer: React.FC<ShapeRendererProps> = ({
  shape,
  isSelected = false,
  camera,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) => {
  const registry = useShapeRegistry();

  // ✅ Plugin から直接コンポーネント取得
  const ShapeComponent = registry.getComponent(shape.type);

  if (!ShapeComponent) {
    console.warn(`Unknown shape type: ${shape.type}`);
    return null;
  }

  // ✅ Component をそのまま描画
  return (
    <ShapeComponent
      shape={shape}
      isSelected={isSelected}
      camera={camera}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
};
```

**メリット**
- ✅ 責務が明確（描画のみ）
- ✅ Factory 不要
- ✅ ミューテーションなし（React の原則に従う）
- ✅ useMemo 不要（React が最適化）
- ✅ レンダリングモード判定は Component 内で
- ✅ テストが簡単

---

#### 案4: 座標変換を独立サービスに

**Before**
```typescript
// ❌ BaseShape に実装
protected transformToScreen(point: Point): Point {
  return {
    x: point.x * this.camera.zoom + this.camera.x,
    y: point.y * this.camera.zoom + this.camera.y,
  };
}

// ❌ HtmlWrapper にも実装
if (parentHasTransform) {
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
} else {
  container.style.transform =
    `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
}
```

**After**
```typescript
// ✅ 新パッケージ: @usketch/coordinate-system
export class CoordinateTransformer {
  constructor(private camera: Camera) {}

  /**
   * ワールド座標をスクリーン座標に変換
   */
  worldToScreen(point: Point): Point {
    return {
      x: point.x * this.camera.zoom + this.camera.x,
      y: point.y * this.camera.zoom + this.camera.y,
    };
  }

  /**
   * スクリーン座標をワールド座標に変換
   */
  screenToWorld(point: Point): Point {
    return {
      x: (point.x - this.camera.x) / this.camera.zoom,
      y: (point.y - this.camera.y) / this.camera.zoom,
    };
  }

  /**
   * Bounds をスクリーン座標に変換
   */
  transformBounds(bounds: Bounds): Bounds {
    const topLeft = this.worldToScreen({ x: bounds.x, y: bounds.y });
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bounds.width * this.camera.zoom,
      height: bounds.height * this.camera.zoom,
    };
  }

  /**
   * CSS transform 文字列を生成
   */
  toCSSTransform(): string {
    return `translate(${this.camera.x}px, ${this.camera.y}px) scale(${this.camera.zoom})`;
  }
}

// ✅ React フック
export function useCoordinateTransform(): CoordinateTransformer {
  const camera = useWhiteboardStore(state => state.camera);
  return useMemo(
    () => new CoordinateTransformer(camera),
    [camera.x, camera.y, camera.zoom]
  );
}

// ✅ 使用例
function MyShape({ shape }: { shape: Shape }) {
  const transform = useCoordinateTransform();
  const screenPos = transform.worldToScreen({ x: shape.x, y: shape.y });

  return (
    <div
      style={{
        left: screenPos.x,
        top: screenPos.y,
      }}
    />
  );
}
```

**メリット**
- ✅ ロジックが1箇所に集約
- ✅ テストが容易（Pure Class）
- ✅ どこからでも利用可能
- ✅ 計算の最適化がしやすい

---

#### 案5: HtmlWrapper を分割

**Before (284行)**
```tsx
// ❌ 1つのコンポーネントで2つのモードを管理
export const HtmlWrapper: React.FC = ({ renderer, ... }) => {
  const [useForeignObject, setUseForeignObject] = useState(true);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  // foreignObject モード
  if (useForeignObject) {
    return <foreignObject>...</foreignObject>;
  }

  // Portal モード
  return (
    <>
      <rect /* placeholder */ />
      {container && createPortal(..., container)}
    </>
  );
};
```

**After**
```tsx
// ✅ ForeignObject 専用コンポーネント (~80行)
export const ForeignObjectShape: React.FC<ForeignObjectShapeProps> = ({
  shape,
  bounds,
  isSelected,
  onClick,
  onPointerDown,
  children,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // インタラクティブ要素なら Shape 選択をスキップ
    if (isInteractiveElement(target)) {
      e.stopPropagation();
    } else if (onClick) {
      onClick(e);
    }
  };

  return (
    <foreignObject
      x={bounds.x}
      y={bounds.y}
      width={bounds.width}
      height={bounds.height}
      style={{ overflow: "visible", pointerEvents: "all" }}
      data-shape-id={shape.id}
      data-shape-type={shape.type}
    >
      <div
        className="shape-container"
        onClick={handleClick}
        onPointerDown={onPointerDown}
      >
        {children}
      </div>
    </foreignObject>
  );
};

// ✅ Portal 専用コンポーネント (~80行)
// 必要な場合のみ使用
export const PortalShape: React.FC<PortalShapeProps> = ({
  shape,
  bounds,
  camera,
  children,
}) => {
  const transform = useCoordinateTransform();
  const container = usePortalContainer(shape.id);

  useEffect(() => {
    if (container) {
      // CSS transform を適用
      const cssTransform = transform.toCSSTransform();
      container.style.transform = cssTransform;
      container.style.left = `${shape.x}px`;
      container.style.top = `${shape.y}px`;
    }
  }, [container, shape, transform]);

  return (
    <>
      {/* SVG placeholder for hit detection */}
      <rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        fill="transparent"
        data-shape-id={shape.id}
      />
      {/* HTML content via portal */}
      {container && createPortal(children, container)}
    </>
  );
};
```

**メリット**
- ✅ 関心の分離（foreignObject vs Portal）
- ✅ 各コンポーネントがシンプル（~80行）
- ✅ テストが容易
- ✅ 使い分けが明確
- ✅ カスタムフック化（`usePortalContainer`）

---

#### 案6: Dependency Injection 導入

**Before**
```tsx
// ❌ グローバルシングルトン
export const globalShapeRegistry = new ShapeRegistry();

// ❌ アプリで直接使用
function App() {
  useEffect(() => {
    globalShapeRegistry.register(rectanglePlugin);
  }, []);

  return <WhiteboardCanvas />;
}

// ❌ テストで状態が残る
test('test 1', () => {
  globalShapeRegistry.register(customPlugin);
});

test('test 2', () => {
  // test 1 の影響が残る！
});
```

**After**
```tsx
// ✅ グローバルシングルトンを削除

// ✅ Context 経由で Registry を注入
function App() {
  const registry = useMemo(() => new ShapeRegistry(), []);

  useEffect(() => {
    // プラグイン登録
    registry.registerMultiple([
      rectanglePlugin,
      ellipsePlugin,
      linePlugin,
      textPlugin,
      freedrawPlugin,
    ]);
  }, [registry]);

  return (
    <ShapeRegistryProvider registry={registry}>
      <WhiteboardCanvas />
    </ShapeRegistryProvider>
  );
}

// ✅ コンポーネントで Context 経由で使用
function ShapeRenderer({ shape }: { shape: Shape }) {
  const registry = useShapeRegistry();  // Context から取得
  const ShapeComponent = registry.getComponent(shape.type);

  return ShapeComponent ? <ShapeComponent shape={shape} /> : null;
}

// ✅ テスト時はモックを注入
describe('ShapeRenderer', () => {
  test('renders rectangle', () => {
    const mockRegistry = new ShapeRegistry();
    mockRegistry.register(mockRectanglePlugin);

    render(
      <ShapeRegistryProvider registry={mockRegistry}>
        <ShapeRenderer shape={testRectangle} />
      </ShapeRegistryProvider>
    );

    expect(screen.getByTestId('rectangle')).toBeInTheDocument();
  });

  test('handles unknown shape', () => {
    const emptyRegistry = new ShapeRegistry();

    render(
      <ShapeRegistryProvider registry={emptyRegistry}>
        <ShapeRenderer shape={unknownShape} />
      </ShapeRegistryProvider>
    );

    expect(screen.queryByTestId('shape')).not.toBeInTheDocument();
  });
});
```

**メリット**
- ✅ グローバルシングルトン廃止
- ✅ テストの独立性確保
- ✅ マルチキャンバス対応可能
- ✅ SSR 対応
- ✅ モック・スタブの注入が容易

---

## 📊 リファクタリング効果の比較

| 項目 | 現在 | リファクタ後 | 改善率 |
|------|------|-------------|-------|
| **レジストリ数** | 2個 (Factory + Registry) | 1個 (Registry のみ) | **-50%** |
| **抽象クラス** | BaseShape (必須) | なし (Pure Function) | **-100%** |
| **UnifiedShapeRenderer 行数** | 63行 | 25行 | **-60%** |
| **HtmlWrapper 行数** | 284行 | 2個 × 80行 = 160行 | **-44%** |
| **座標変換実装箇所** | 4箇所 | 1箇所 | **-75%** |
| **グローバル変数** | 3個 | 0個 (DI) | **-100%** |
| **テストのセットアップ** | 複雑 (2箇所クリア) | シンプル (1箇所) | **-50%** |
| **型安全性** | 中 (any多用) | 高 (ジェネリクス活用) | **+30%** |
| **新 Shape 追加コスト** | クラス + Plugin | Plugin のみ | **-50%** |

**総行数削減**: 約 **40%** の削減（推定）

---

## 🚀 移行計画

### 段階的リファクタリング戦略

リファクタリングは **3つのフェーズ** に分けて実施します。各フェーズは独立しており、中断・ロールバックが可能です。

---

### Phase 1: 基盤整備 (1-2週間)

**目標**: 新しいサービス層を構築し、既存コードとの共存を確立

#### タスク

**1.1 座標変換サービスの作成**
- [ ] 新パッケージ `@usketch/coordinate-system` 作成
- [ ] `CoordinateTransformer` クラス実装
- [ ] `useCoordinateTransform` フック実装
- [ ] ユニットテスト作成（カバレッジ 100%）

**1.2 ShapeRegistry の拡張**
- [ ] `getComponent()` メソッド追加
- [ ] `getBounds()`, `hitTest()` メソッド追加（Plugin に委譲）
- [ ] 後方互換性の確保（既存の API は残す）
- [ ] ユニットテスト追加

**1.3 テストインフラの整備**
- [ ] `createMockRegistry()` ヘルパー作成
- [ ] `createMockShape()` ヘルパー作成
- [ ] テストユーティリティのドキュメント作成

**成果物**
- ✅ `@usketch/coordinate-system` パッケージ
- ✅ 拡張された `ShapeRegistry`
- ✅ テストヘルパー関数

**リスク対策**
- 既存コードは一切変更しない（新規追加のみ）
- すべての変更に対してユニットテストを追加
- Phase 1 完了時点でロールバック可能

---

### Phase 2: コンポーネント簡素化 (1-2週間)

**目標**: React コンポーネントを Pure Function ベースにリファクタリング

#### タスク

**2.1 新しい ShapeRenderer の作成**
- [ ] `ShapeRenderer` コンポーネント実装（25行程度）
- [ ] `UnifiedShapeRenderer` を非推奨化（Deprecated）
- [ ] 段階的な移行ガイドを作成
- [ ] E2E テスト作成

**2.2 ForeignObjectShape の作成**
- [ ] `ForeignObjectShape` コンポーネント実装
- [ ] `useInteractiveElementDetection` フック実装
- [ ] `HtmlWrapper` から段階的に移行
- [ ] コンポーネントテスト作成

**2.3 PortalShape の作成**
- [ ] `PortalShape` コンポーネント実装（必要な場合のみ）
- [ ] `usePortalContainer` フック実装
- [ ] DOM クリーンアップの確実性を確保
- [ ] コンポーネントテスト作成

**2.4 Plugin を Pure Function に移行**
- [ ] `rectanglePlugin` を Pure Function 化
- [ ] `ellipsePlugin` を Pure Function 化
- [ ] `linePlugin` を Pure Function 化
- [ ] `textPlugin` を Pure Function 化
- [ ] `freedrawPlugin` を Pure Function 化
- [ ] 各 Plugin のテストを更新

**成果物**
- ✅ 新しい `ShapeRenderer`
- ✅ `ForeignObjectShape`, `PortalShape`
- ✅ Pure Function ベースの Plugin
- ✅ 移行ガイド

**リスク対策**
- 旧コンポーネントは残す（非推奨化のみ）
- Feature Flag で新旧を切り替え可能に
- 段階的な移行（1 Plugin ずつ）

---

### Phase 3: クリーンアップ (1週間)

**目標**: 旧コードの削除とドキュメント整備

#### タスク

**3.1 ShapeFactory の削除**
- [ ] `ShapeFactory.create()` の使用箇所をすべて削除
- [ ] `ShapeFactory` クラスを削除
- [ ] `UnifiedShapePluginAdapter` を削除
- [ ] 関連テストを削除

**3.2 BaseShape の削除**
- [ ] `BaseShape` 抽象クラスを削除
- [ ] `ShapeRenderer` インターフェースを削除（不要）
- [ ] 関連テストを削除

**3.3 旧コンポーネントの削除**
- [ ] `UnifiedShapeRenderer` を削除
- [ ] `HtmlWrapper` を削除（`ForeignObjectShape` に置き換え）
- [ ] `SvgWrapper` を簡素化または削除

**3.4 グローバルシングルトンの削除**
- [ ] `globalShapeRegistry` を削除
- [ ] すべてのコンポーネントで DI を使用
- [ ] テストの更新（モック注入方式に）

**3.5 ドキュメント更新**
- [ ] アーキテクチャドキュメント更新
- [ ] API リファレンス更新
- [ ] サンプルコード更新
- [ ] 移行ガイド（v1 → v2）作成

**成果物**
- ✅ クリーンなコードベース
- ✅ 更新されたドキュメント
- ✅ 移行完了レポート

**リスク対策**
- すべての E2E テストをパス
- パフォーマンス計測（リグレッションなし）
- 段階的なロールアウト（カナリアリリース）

---

### マイルストーン

| マイルストーン | 完了予定 | 成果物 |
|--------------|---------|-------|
| M1: Phase 1 完了 | Week 2 | 座標変換サービス、拡張 Registry |
| M2: Phase 2 完了 | Week 4 | 新コンポーネント、Pure Function Plugins |
| M3: Phase 3 完了 | Week 5 | 旧コード削除、ドキュメント完成 |
| M4: リリース準備 | Week 6 | リリースノート、マイグレーションガイド |

---

## 🎯 期待される効果

### 1. コードの保守性向上

**Before**
```typescript
// ❌ 複雑な依存関係
UnifiedShapeRenderer
  ↓ 依存
ShapeFactory (static)
  ↓ 依存
BaseShape (abstract class)
  ↓ 実装
RectangleRenderer (concrete class)

// 同時に...
ShapeRegistry
  ↓ 依存
ShapePlugin
  ↓ 参照
Rectangle (React Component)
```

**After**
```typescript
// ✅ シンプルな依存関係
ShapeRenderer
  ↓ 依存
ShapeRegistry (injected)
  ↓ 参照
rectanglePlugin
  ├─ component: Rectangle (React)
  ├─ getBounds: (shape) => Bounds
  └─ hitTest: (shape, point) => boolean
```

**効果**
- ✅ 依存関係が直線的に
- ✅ 循環依存なし
- ✅ モジュールの責務が明確

---

### 2. テスタビリティの向上

**Before**
```tsx
// ❌ テストが困難
test('renders shape', () => {
  // グローバル状態のセットアップ
  ShapeFactory.clear();
  globalShapeRegistry.clear();

  ShapeFactory.register('rectangle', RectangleRenderer);
  globalShapeRegistry.register(rectanglePlugin);

  render(<UnifiedShapeRenderer shape={testShape} />);

  // クリーンアップ
  ShapeFactory.clear();
  globalShapeRegistry.clear();
});
```

**After**
```tsx
// ✅ テストが簡単
test('renders shape', () => {
  const registry = createMockRegistry([rectanglePlugin]);

  render(
    <ShapeRegistryProvider registry={registry}>
      <ShapeRenderer shape={testShape} />
    </ShapeRegistryProvider>
  );
});
```

**効果**
- ✅ テストコードが 50% 削減
- ✅ セットアップが簡単
- ✅ テスト間の独立性確保

---

### 3. パフォーマンスの向上

**Before**
```typescript
// ❌ shape が変わるたびに再生成
const renderer = useMemo(() => {
  return ShapeFactory.create(shape);  // 新しいインスタンス
}, [shape.type, shape.id, shape]);  // shape 全体が依存

// shape.x が変わるだけで...
// → renderer 再生成
// → render() 再実行
// → 不要な DOM 更新
```

**After**
```tsx
// ✅ コンポーネントはメモ化不要
const ShapeComponent = registry.getComponent(shape.type);

return <ShapeComponent shape={shape} />;
// → React が自動的に最適化
// → shape.x が変わっても ShapeComponent は再利用
```

**効果**
- ✅ 不要なインスタンス生成を削減
- ✅ メモリ使用量の削減
- ✅ レンダリング速度の向上（推定 10-20%）

---

### 4. 拡張性の向上

**Before**
```tsx
// ❌ 新しい Shape を追加するには...
// 1. BaseShape を継承したクラスを作る
class TriangleRenderer extends BaseShape<TriangleShape> {
  render() { /* ... */ }
  getBounds() { /* ... */ }
  hitTest() { /* ... */ }
}

// 2. ShapePlugin を作る（重複実装）
export const trianglePlugin: ShapePlugin = {
  component: Triangle,
  getBounds: (shape) => { /* 同じロジック */ },
  hitTest: (shape) => { /* 同じロジック */ },
};

// 3. UnifiedShapePluginAdapter で橋渡し
const plugin = UnifiedShapePluginAdapter.createPlugin(
  TriangleRenderer,
  { type: 'triangle', createDefaultShape: ... }
);

// 4. 両方に登録
ShapeFactory.register('triangle', TriangleRenderer);
globalShapeRegistry.register(plugin);
```

**After**
```tsx
// ✅ Plugin を1つ定義するだけ
export const trianglePlugin: ShapePlugin<TriangleShape> = {
  type: "triangle",
  name: "Triangle",
  component: Triangle,  // React Component

  createDefaultShape: ({ id, x, y }) => ({
    id, type: "triangle", x, y,
    width: 100, height: 100, /* ... */
  }),

  getBounds: (shape) => ({
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
  }),

  hitTest: (shape, point) => {
    // 三角形の内部判定
    return isPointInTriangle(point, shape);
  },
};

// 登録
registry.register(trianglePlugin);
```

**効果**
- ✅ 新 Shape 追加コストが **50%** 削減
- ✅ 学習コストが低い
- ✅ Pure Function なのでテストが簡単

---

### 5. 型安全性の向上

**Before**
```typescript
// ❌ any が多用される
const plugin = UnifiedShapePluginAdapter.createPlugin(
  ShapeClass,
  config as any  // ← 型安全性の喪失
);

getBounds: (shape) => {
  const renderer = ShapeFactory.create(shape as any);  // ← any
  return renderer.getBounds();
}
```

**After**
```tsx
// ✅ 完全な型推論
export const rectanglePlugin: ShapePlugin<RectangleShape> = {
  //                                      ^^^^^^^^^^^^^^
  //                                      型パラメータで型安全

  createDefaultShape: ({ id, x, y }) => ({
    id, type: "rectangle", x, y,
    width: 100,  // ← RectangleShape の型でチェック
    height: 100,
    // 必須プロパティの漏れがあればコンパイルエラー
  }),

  getBounds: (shape) => {
    //       ^^^^^ RectangleShape 型
    return {
      x: shape.x,
      y: shape.y,
      width: shape.width,  // ← 型チェックされる
      height: shape.height,
    };
  },
};
```

**効果**
- ✅ `any` の使用を **80%** 削減
- ✅ コンパイル時エラー検出
- ✅ IDE の補完が効く

---

## 📋 チェックリスト

### Phase 1 完了条件
- [ ] `@usketch/coordinate-system` パッケージが作成され、すべてのテストがパス
- [ ] `ShapeRegistry` に `getComponent()`, `getBounds()`, `hitTest()` が追加
- [ ] テストヘルパー関数が作成され、ドキュメント化
- [ ] すべての既存テストがパス（リグレッションなし）

### Phase 2 完了条件
- [ ] 新しい `ShapeRenderer` が実装され、E2E テストがパス
- [ ] `ForeignObjectShape` と `PortalShape` が実装され、テストがパス
- [ ] すべての標準 Plugin が Pure Function 化
- [ ] 移行ガイドが作成され、サンプルコードが動作

### Phase 3 完了条件
- [ ] `ShapeFactory`, `BaseShape`, `UnifiedShapePluginAdapter` が削除
- [ ] `globalShapeRegistry` が削除され、すべて DI に移行
- [ ] すべてのドキュメントが更新
- [ ] パフォーマンス計測で 10% 以上の改善を確認

---

## 🚨 リスクと対策

### リスク1: 既存コードの破壊

**対策**
- 段階的リファクタリング（3フェーズに分割）
- 各フェーズでロールバック可能
- Feature Flag での新旧切り替え
- すべての変更に対してテストを追加

### リスク2: パフォーマンス低下

**対策**
- 各フェーズ完了時にベンチマーク実行
- React Profiler での計測
- 問題があれば即座にロールバック

### リスク3: テストカバレッジの低下

**対策**
- リファクタリング前にカバレッジ計測
- 新コードは 100% カバレッジを目標
- E2E テストで実際の動作を確認

### リスク4: ドキュメントの陳腐化

**対策**
- 各フェーズでドキュメント更新
- 移行ガイドの作成
- サンプルコードの更新

---

## 📚 参考資料

### 設計原則
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [React Documentation - Thinking in React](https://react.dev/learn/thinking-in-react)

### 関連ドキュメント
- [アーキテクチャ設計書](../architecture/README.md)
- [API仕様書](../api/README.md)
- [開発ガイド](../development/README.md)

---

## 📞 問い合わせ

本リファクタリング計画について質問や提案がある場合は、以下の方法で連絡してください：

- **GitHub Issue**: [新しい Issue を作成](https://github.com/EdV4H/usketch/issues/new/choose)
- **Discussion**: [GitHub Discussions](https://github.com/EdV4H/usketch/discussions)
- **Pull Request**: [新しい PR を作成](https://github.com/EdV4H/usketch/compare) — 部分的な改善提案は PR で歓迎します

---

**最終更新**: 2025-10-15
**ステータス**: 提案中（レビュー待ち）
