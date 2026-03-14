# 拡張可能な図形システム実装計画

## 1. 現状の問題点

### 1.1 型定義の不整合
- **`shared-types`**: 5つの図形タイプを定義 (`rectangle`, `ellipse`, `line`, `text`, `freedraw`)
- **`tools/types.ts`**: 6つの図形タイプを定義 (`rectangle`, `ellipse`, `path`, `text`, `arrow`, `freedraw`)
- **`react-canvas`**: 3つの図形のみ実装 (`rectangle`, `ellipse`, `freedraw`)

### 1.2 ハードコーディングされた実装
```typescript
// 現在のShape.tsx - 拡張が困難
switch (shape.type) {
  case "rectangle": return <Rectangle ... />;
  case "ellipse": return <Ellipse ... />;
  case "freedraw": return <Freedraw ... />;
  default: return null; // line, textは未実装
}
```

### 1.3 拡張性の欠如
- 新しい図形タイプの追加時に複数箇所の修正が必要
- サードパーティやカスタム図形の追加が困難
- 図形ごとの振る舞いのカスタマイズが難しい

## 2. 提案する拡張可能な設計

### 2.1 プラグインベースのアーキテクチャ

```typescript
// Shape Registry Pattern
interface ShapePlugin<T extends BaseShape = BaseShape> {
  type: string;
  component: React.ComponentType<ShapeComponentProps<T>>;
  toolComponent?: React.ComponentType<ToolProps>;
  createDefaultShape: (props: CreateShapeProps) => T;
  getBounds: (shape: T) => Bounds;
  hitTest: (shape: T, point: Point) => boolean;
  serialize?: (shape: T) => any;
  deserialize?: (data: any) => T;
  icon?: React.ComponentType;
  name?: string;
}
```

### 2.2 図形レジストリシステム

```typescript
class ShapeRegistry {
  private plugins = new Map<string, ShapePlugin>();
  
  register<T extends BaseShape>(plugin: ShapePlugin<T>): void {
    this.plugins.set(plugin.type, plugin);
  }
  
  unregister(type: string): void {
    this.plugins.delete(type);
  }
  
  getPlugin(type: string): ShapePlugin | undefined {
    return this.plugins.get(type);
  }
  
  getAllPlugins(): ShapePlugin[] {
    return Array.from(this.plugins.values());
  }
}
```

### 2.3 動的な図形コンポーネント

```typescript
// 新しいShape.tsx - 完全に拡張可能
export const Shape: React.FC<ShapeProps> = ({ shape, ...props }) => {
  const plugin = useShapeRegistry().getPlugin(shape.type);
  
  if (!plugin) {
    console.warn(`No plugin registered for shape type: ${shape.type}`);
    return null;
  }
  
  const Component = plugin.component;
  return <Component shape={shape} {...props} />;
};
```

### 2.4 初期図形の設定サポート

```typescript
// WhiteboardCanvasの新しいProps
interface WhiteboardCanvasProps {
  // 初期図形の設定
  initialShapes?: Shape[];
  
  // プラグインの動的登録
  plugins?: ShapePlugin[];
  
  // 図形の変更コールバック
  onShapesChange?: (shapes: Shape[]) => void;
  
  // コントロールモード
  controlled?: boolean;
  shapes?: Shape[];
}

// 使用例
<WhiteboardCanvas 
  initialShapes={[
    {
      id: 'rect-1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      fillColor: '#ff0000',
      strokeColor: '#000000',
      strokeWidth: 2,
      rotation: 0,
      opacity: 1
    },
    {
      id: 'text-1',
      type: 'text',
      x: 350,
      y: 200,
      text: 'Hello World',
      fontSize: 24,
      fontFamily: 'Arial',
      fillColor: '#000000',
      strokeColor: 'transparent',
      strokeWidth: 0,
      rotation: 0,
      opacity: 1
    }
  ]}
  plugins={[customHeartPlugin, customStarPlugin]}
  onShapesChange={(shapes) => console.log('Shapes updated:', shapes)}
/>
```

### 2.5 Controlled/Uncontrolled Component パターン

```typescript
// Uncontrolled Mode (内部で状態管理)
function UncontrolledExample() {
  return (
    <WhiteboardCanvas 
      initialShapes={defaultShapes}
      onShapesChange={(shapes) => {
        // 変更の通知のみ受け取る
        saveToBackend(shapes);
      }}
    />
  );
}

// Controlled Mode (外部で状態管理)
function ControlledExample() {
  const [shapes, setShapes] = useState<Shape[]>(defaultShapes);
  
  return (
    <WhiteboardCanvas 
      controlled
      shapes={shapes}
      onShapesChange={setShapes}
    />
  );
}

// Hybrid Mode (初期値 + 外部制御)
function HybridExample() {
  const [externalShapes, setExternalShapes] = useState<Shape[]>([]);
  const [mode, setMode] = useState<'local' | 'sync'>('local');
  
  return (
    <WhiteboardCanvas 
      controlled={mode === 'sync'}
      initialShapes={mode === 'local' ? localShapes : undefined}
      shapes={mode === 'sync' ? externalShapes : undefined}
      onShapesChange={(shapes) => {
        if (mode === 'sync') {
          setExternalShapes(shapes);
          syncWithServer(shapes);
        }
      }}
    />
  );
}
```

## 3. 実装ロードマップ

### Phase 1: 基盤構築（Week 1）

#### 1.1 型定義の統一
- [ ] `shared-types`に図形プラグインインターフェースを追加
- [ ] 既存の図形型定義をプラグインシステムに対応
- [ ] レジストリ型の定義

#### 1.2 レジストリシステムの実装
- [ ] `ShapeRegistry`クラスの実装
- [ ] React Context経由でのレジストリ提供
- [ ] レジストリフックの作成

#### 1.3 初期化システム
- [ ] `initialShapes` propの実装
- [ ] Controlled/Uncontrolled モードの実装
- [ ] 図形の初期化とバリデーション

### Phase 2: 既存図形の移行（Week 2）

#### 2.1 コア図形プラグインの作成
- [ ] Rectangle プラグイン
- [ ] Ellipse プラグイン  
- [ ] Freedraw プラグイン

#### 2.2 未実装図形の追加
- [ ] Line プラグイン
- [ ] Text プラグイン
- [ ] Arrow プラグイン（toolsパッケージとの整合）

### Phase 3: ツールシステムとの統合（Week 3）

#### 3.1 ツール連携
- [ ] 各図形プラグインにツールコンポーネントを追加
- [ ] XStateマシンとの連携
- [ ] ツールバーの動的生成

#### 3.2 インタラクション強化
- [ ] 図形ごとのカスタムハンドル
- [ ] リサイズ・回転の振る舞いカスタマイズ
- [ ] コンテキストメニューのカスタマイズ

### Phase 4: 高度な機能（Week 4）

#### 4.1 カスタム図形サポート
- [ ] カスタム図形の登録API
- [ ] サンプルカスタム図形の実装
- [ ] ドキュメント作成

#### 4.2 永続化とシリアライゼーション
- [ ] 図形データの保存・復元
- [ ] インポート・エクスポート機能
- [ ] バージョニング対応

## 4. ディレクトリ構造

```
packages/
├── shape-registry/           # 新規パッケージ
│   ├── src/
│   │   ├── ShapeRegistry.ts
│   │   ├── context.tsx
│   │   ├── hooks.ts
│   │   └── types.ts
│   └── package.json
│
├── shape-plugins/            # 新規パッケージ
│   ├── src/
│   │   ├── core/            # コア図形
│   │   │   ├── rectangle/
│   │   │   ├── ellipse/
│   │   │   ├── line/
│   │   │   ├── text/
│   │   │   └── freedraw/
│   │   ├── extended/        # 拡張図形
│   │   │   ├── arrow/
│   │   │   ├── polygon/
│   │   │   └── star/
│   │   └── index.ts
│   └── package.json
│
└── react-canvas/            # 既存パッケージを更新
    ├── src/
    │   ├── components/
    │   │   ├── Shape.tsx    # プラグインベースに書き換え
    │   │   └── ...
    │   └── providers/
    │       └── ShapeProvider.tsx
    └── package.json
```

## 5. 実装例

### 5.1 図形プラグインの実装例

```typescript
// packages/shape-plugins/src/core/rectangle/index.ts
import { RectangleComponent } from './RectangleComponent';
import { RectangleTool } from './RectangleTool';
import type { RectangleShape, ShapePlugin } from '@usketch/shared-types';

export const rectanglePlugin: ShapePlugin<RectangleShape> = {
  type: 'rectangle',
  name: 'Rectangle',
  component: RectangleComponent,
  toolComponent: RectangleTool,
  icon: RectangleIcon,
  
  createDefaultShape: ({ id, x, y }) => ({
    id,
    type: 'rectangle',
    x,
    y,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    strokeColor: '#000000',
    fillColor: '#ffffff',
    strokeWidth: 2,
  }),
  
  getBounds: (shape) => ({
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
  }),
  
  hitTest: (shape, point) => {
    return (
      point.x >= shape.x &&
      point.x <= shape.x + shape.width &&
      point.y >= shape.y &&
      point.y <= shape.y + shape.height
    );
  },
};
```

### 5.2 カスタム図形の登録例

```typescript
// アプリケーションレベルでのカスタム図形登録
import { useShapeRegistry } from '@usketch/shape-registry';
import { customHeartShape } from './custom-shapes/heart';

function App() {
  const registry = useShapeRegistry();
  
  useEffect(() => {
    // カスタム図形を登録
    registry.register(customHeartShape);
    
    return () => {
      // クリーンアップ時に登録解除
      registry.unregister('heart');
    };
  }, []);
  
  return <WhiteboardCanvas />;
}
```

### 5.3 初期図形を使った実装例

```typescript
// 初期図形を持つホワイトボードの実装
import { WhiteboardCanvas } from '@usketch/react-canvas';
import { generateDefaultShapes } from './utils/shapes';

function DiagramEditor() {
  // テンプレートから初期図形を生成
  const templateShapes = useMemo(() => {
    return [
      {
        id: 'title',
        type: 'text',
        x: 400,
        y: 50,
        text: 'System Architecture',
        fontSize: 32,
        fontFamily: 'Arial',
        fillColor: '#000',
        strokeColor: 'transparent',
        strokeWidth: 0,
        rotation: 0,
        opacity: 1
      },
      {
        id: 'server',
        type: 'rectangle',
        x: 100,
        y: 150,
        width: 150,
        height: 100,
        fillColor: '#4A90E2',
        strokeColor: '#2E5C8A',
        strokeWidth: 2,
        rotation: 0,
        opacity: 1
      },
      {
        id: 'database',
        type: 'ellipse',
        x: 350,
        y: 150,
        width: 150,
        height: 100,
        fillColor: '#50C878',
        strokeColor: '#2D7A4F',
        strokeWidth: 2,
        rotation: 0,
        opacity: 1
      },
      {
        id: 'connection',
        type: 'line',
        x: 250,
        y: 200,
        x2: 350,
        y2: 200,
        fillColor: 'transparent',
        strokeColor: '#666',
        strokeWidth: 2,
        rotation: 0,
        opacity: 1
      }
    ];
  }, []);

  return (
    <WhiteboardCanvas
      initialShapes={templateShapes}
      onShapesChange={(shapes) => {
        console.log('Diagram updated:', shapes.length, 'shapes');
      }}
    />
  );
}

// JSONやAPIから図形を読み込む例
function SavedDiagramLoader({ diagramId }: { diagramId: string }) {
  const [initialShapes, setInitialShapes] = useState<Shape[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // APIから保存された図形を取得
    fetch(`/api/diagrams/${diagramId}`)
      .then(res => res.json())
      .then(data => {
        setInitialShapes(data.shapes);
        setLoading(false);
      });
  }, [diagramId]);
  
  if (loading) {
    return <div>Loading diagram...</div>;
  }
  
  return (
    <WhiteboardCanvas
      initialShapes={initialShapes}
      onShapesChange={async (shapes) => {
        // 変更を自動保存
        await fetch(`/api/diagrams/${diagramId}`, {
          method: 'PUT',
          body: JSON.stringify({ shapes }),
          headers: { 'Content-Type': 'application/json' }
        });
      }}
    />
  );
}
```

## 6. 利点

### 6.1 開発者体験の向上
- **プラグイン開発**: 新しい図形を独立して開発可能
- **型安全性**: TypeScriptによる完全な型サポート
- **テスタビリティ**: 各プラグインを独立してテスト可能

### 6.2 ユーザー体験の向上
- **動的な図形追加**: 実行時に新しい図形タイプを追加可能
- **カスタマイズ性**: アプリケーション固有の図形を簡単に追加
- **パフォーマンス**: 必要な図形のみをロード（コード分割対応）
- **初期状態の設定**: テンプレートや保存データから簡単に開始
- **柔軟な状態管理**: Controlled/Uncontrolledモードで様々なユースケースに対応

### 6.3 保守性
- **単一責任原則**: 各図形が独自のロジックをカプセル化
- **疎結合**: 図形間の依存関係を最小化
- **段階的移行**: 既存コードを段階的に新システムに移行可能

## 7. 考慮事項

### 7.1 後方互換性
- 既存の図形データとの互換性を維持
- 段階的な移行パスを提供
- deprecation警告の実装

### 7.2 パフォーマンス
- 動的インポートによるバンドルサイズの最適化
- 図形レンダリングの最適化
- メモリ使用量の監視

### 7.3 開発者向けドキュメント
- プラグイン開発ガイド
- APIリファレンス
- サンプルコード集

## 8. 成功指標

- [ ] すべての既存図形タイプが動作する
- [ ] 新しい図形を5分以内に追加できる
- [ ] バンドルサイズが10%以上増加しない
- [ ] 既存のテストがすべてパスする
- [ ] カスタム図形のサンプルが3つ以上動作する
- [ ] 初期図形の設定が正しく動作する
- [ ] Controlled/Uncontrolledモードが両方動作する
- [ ] APIからの図形読み込みが可能

## 9. リスクと軽減策

| リスク | 影響度 | 軽減策 |
|--------|--------|--------|
| 既存コードとの非互換性 | 高 | フィーチャーフラグによる段階的リリース |
| パフォーマンス劣化 | 中 | プロファイリングと最適化の実施 |
| 開発期間の延長 | 中 | MVPを定義し、段階的に機能追加 |
| プラグインの品質管理 | 低 | プラグインバリデーションの実装 |

## 10. 次のステップ

1. **技術的検証（3日間）**
   - プロトタイプの作成
   - パフォーマンステスト
   - 既存システムとの統合テスト

2. **詳細設計（2日間）**
   - APIの最終化
   - エラーハンドリングの設計
   - テスト戦略の策定

3. **実装開始**
   - Phase 1から順次実装
   - 各フェーズごとにレビューとテスト

---

*この計画書は随時更新され、実装の進捗に応じて調整されます。*