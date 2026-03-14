# 統一されたシェイプ抽象化レイヤー設計計画書

## 概要

現在のuSketchでは、SVGベースのシェイプとHTMLベースのカスタムシェイプが別々のアプローチで実装されており、開発者にとって複雑で一貫性のない体験となっています。本計画書では、SVG/HTMLを意識せずに統一的にシェイプを実装できる抽象化レイヤーの設計を提案します。

## 現状の問題点

### 1. 実装の複雑さ
- SVGプレースホルダーとHTML要素の二重管理
- Portal用のコンテナ作成、位置同期の手動実装
- 座標変換の重複実装

### 2. 保守性の課題
- ボイラープレートコードの重複
- イベント処理の不整合
- z-index管理の困難さ

### 3. パフォーマンスの懸念
- 個別DOM要素による描画性能の劣化
- カメラ移動時の全要素更新

## 提案する解決策

### 統一シェイプ抽象化レイヤー (Unified Shape Abstraction Layer)

```
┌─────────────────────────────────────────────────┐
│             アプリケーション層                     │
│          (カスタムシェイプの実装)                  │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│        統一シェイプ抽象化レイヤー                   │
│   ・BaseShape クラス                             │
│   ・自動座標変換                                  │
│   ・統一イベントハンドリング                       │
│   ・レンダリング戦略の自動選択                     │
└────────────────┬────────────────────────────────┘
                 │
     ┌───────────┴───────────┐
     ▼                       ▼
┌─────────────┐       ┌─────────────┐
│ SVGレンダラー │       │ HTMLレンダラー │
│ (foreignObject)│       │  (Portal)    │
└─────────────┘       └─────────────┘
```

## 詳細設計

### 1. BaseShapeクラス

```typescript
// packages/shape-abstraction/src/BaseShape.ts

export interface BaseShapeConfig<T extends Shape = Shape> {
  type: string;
  renderMode?: 'svg' | 'html' | 'hybrid';
  enableInteractivity?: boolean;
}

export abstract class BaseShape<T extends Shape = Shape> {
  protected shape: T;
  protected camera: Camera;
  protected isSelected: boolean;
  
  constructor(config: BaseShapeConfig<T>) {
    // 初期化処理
  }
  
  // 必須実装メソッド
  abstract render(): React.ReactElement;
  abstract getBounds(): Bounds;
  abstract hitTest(point: Point): boolean;
  
  // オプショナルメソッド（デフォルト実装あり）
  onPointerDown?(e: PointerEvent): void;
  onPointerMove?(e: PointerEvent): void;
  onPointerUp?(e: PointerEvent): void;
  onDrag?(delta: Point): void;
  onResize?(handle: ResizeHandle, delta: Point): void;
  
  // 共通ユーティリティ（自動提供）
  protected getScreenCoordinates(): Point {
    // カメラ変換を自動適用
    return transformToScreen(this.shape, this.camera);
  }
  
  protected updateShape(updates: Partial<T>): void {
    // ストアへの更新を自動処理
    whiteboardStore.updateShape(this.shape.id, updates);
  }
}
```

### 2. シェイプファクトリー

```typescript
// packages/shape-abstraction/src/ShapeFactory.ts

export class ShapeFactory {
  private static renderers = new Map<string, typeof BaseShape>();
  
  static register(type: string, renderer: typeof BaseShape) {
    this.renderers.set(type, renderer);
  }
  
  static create(shape: Shape): BaseShape {
    const Renderer = this.renderers.get(shape.type);
    if (!Renderer) {
      throw new Error(`Unknown shape type: ${shape.type}`);
    }
    return new Renderer({ shape });
  }
}
```

### 3. 統一レンダリングコンポーネント

```typescript
// packages/shape-abstraction/src/UnifiedShapeRenderer.tsx

export const UnifiedShapeRenderer: React.FC<{
  shape: Shape;
  isSelected: boolean;
  camera: Camera;
}> = ({ shape, isSelected, camera }) => {
  const renderer = useMemo(
    () => ShapeFactory.create(shape),
    [shape.type, shape.id]
  );
  
  // カメラとselection状態を自動注入
  renderer.camera = camera;
  renderer.isSelected = isSelected;
  
  // レンダリングモードに応じて適切なラッパーを選択
  const renderMode = renderer.config.renderMode || 'svg';
  
  if (renderMode === 'html') {
    return <HtmlWrapper renderer={renderer} />;
  } else if (renderMode === 'hybrid') {
    return <HybridWrapper renderer={renderer} />;
  } else {
    return <SvgWrapper renderer={renderer} />;
  }
};
```

### 4. 実装例：カウンターシェイプ

```typescript
// apps/whiteboard/src/shapes/CounterShape.ts

import { BaseShape, BaseShapeConfig } from '@usketch/shape-abstraction';

export class CounterShape extends BaseShape<CounterShapeData> {
  constructor(config: BaseShapeConfig<CounterShapeData>) {
    super({
      ...config,
      renderMode: 'hybrid', // 通常はSVG、インタラクション時はHTML
      enableInteractivity: true
    });
  }
  
  render(): React.ReactElement {
    const { count } = this.shape;
    const { x, y } = this.getScreenCoordinates();
    
    // レンダリングモードに応じて自動的に適切な要素が選択される
    return (
      <div className="counter-shape" style={{ 
        transform: `translate(${x}px, ${y}px)`,
        // transformは自動適用されるため、開発者は気にしない
      }}>
        <button onClick={() => this.updateShape({ count: count - 1 })}>
          -
        </button>
        <span>{count}</span>
        <button onClick={() => this.updateShape({ count: count + 1 })}>
          +
        </button>
      </div>
    );
  }
  
  getBounds(): Bounds {
    // シンプルな境界ボックスの定義
    return {
      x: this.shape.x,
      y: this.shape.y,
      width: this.shape.width,
      height: this.shape.height
    };
  }
  
  hitTest(point: Point): boolean {
    // 自動的にカメラ変換が適用された座標でテスト
    const bounds = this.getBounds();
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
           point.y >= bounds.y && point.y <= bounds.y + bounds.height;
  }
}

// 登録
ShapeFactory.register('counter', CounterShape);
```

## レンダリング戦略

### 1. SVGモード（デフォルト）
- 静的なシェイプに最適
- 高速な描画性能
- SVG要素として出力

### 2. HTMLモード
- インタラクティブな要素に最適
- フォーム要素、リッチテキストなど
- foreignObjectまたはPortalで実装

### 3. ハイブリッドモード
- 状況に応じて自動切り替え
- 通常時：SVG
- 編集/ホバー時：HTML
- 最適なパフォーマンスとインタラクティビティ

## 実装フェーズ

### フェーズ1: 基盤構築（1週間）
- [ ] BaseShapeクラスの実装
- [ ] ShapeFactoryの実装
- [ ] 座標変換ユーティリティの統合

### フェーズ2: レンダラー実装（1週間）
- [ ] SVGWrapperコンポーネント
- [ ] HtmlWrapperコンポーネント（foreignObject版）
- [ ] HybridWrapperコンポーネント

### フェーズ3: 既存シェイプの移行（2週間）
- [ ] Rectangleシェイプの移行
- [ ] HTMLCounterシェイプの移行
- [ ] その他のシェイプの段階的移行

### フェーズ4: 最適化とテスト（1週間）
- [ ] パフォーマンステスト
- [ ] E2Eテストの更新
- [ ] ドキュメント更新

## 利点

### 開発者体験の向上
- **統一的なAPI**: SVG/HTMLの違いを意識せずに実装可能
- **ボイラープレート削減**: 共通処理の自動化により、コード量が50%以上削減
- **型安全性**: TypeScriptによる完全な型サポート

### パフォーマンス改善
- **レンダリング最適化**: 必要な時だけHTMLを使用
- **バッチ更新**: 座標変換の最適化
- **メモリ使用量削減**: 不要なDOM要素の削減

### 保守性の向上
- **単一責任の原則**: 各シェイプが自己完結
- **テスタビリティ**: 独立したユニットテストが容易
- **拡張性**: 新しいレンダリングモードの追加が簡単

## 移行戦略

### 1. 後方互換性の維持
- 既存のShapePluginインターフェースは維持
- 段階的な移行をサポート
- 旧実装と新実装の共存期間を設ける

### 2. 移行ツールの提供
```bash
# CLIツールで自動変換
npx @usketch/migration-tool migrate-shape ./src/shapes/MyShape.tsx
```

### 3. 段階的ロールアウト
1. 新規シェイプから新システムを適用
2. 既存シェイプを優先度順に移行
3. 完全移行後に旧システムを廃止

## リスクと対策

### リスク1: foreignObjectのブラウザ互換性
- **対策**: Portalへのフォールバック実装

### リスク2: パフォーマンス劣化
- **対策**: レンダリングモードの動的切り替え

### リスク3: 既存コードの大規模変更
- **対策**: 段階的移行と自動化ツール

## 成功指標

- **開発速度**: 新規シェイプ実装時間が50%短縮
- **コード量**: ボイラープレートコードが60%削減
- **パフォーマンス**: 100個のHTMLシェイプで60fps維持
- **開発者満足度**: 内部アンケートで満足度80%以上

## まとめ

統一シェイプ抽象化レイヤーの導入により、開発者はSVG/HTMLの実装詳細を意識することなく、宣言的にシェイプを定義できるようになります。これにより、開発効率の向上、コードの保守性改善、そして最終的にはより豊かなユーザー体験の提供が可能となります。

## 参考資料

- [現在のShapePlugin実装](../api/drawing-tools.md)
- [React Portal公式ドキュメント](https://react.dev/reference/react-dom/createPortal)
- [SVG foreignObject仕様](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/foreignObject)
- [tldrawのアーキテクチャ](https://github.com/tldraw/tldraw)