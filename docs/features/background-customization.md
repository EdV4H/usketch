# 背景カスタマイズ機能 - 企画書

## 概要

現在のuSketchでは背景がグリッド線で固定されていますが、これをカスタマイズ可能にし、ユーザーが自由に背景を設定できる機能を実装します。

## 現状の課題

### 現在の実装
- 背景はCSSで定義されたグリッド線パターンで固定
- `app.css`の`.grid-background`クラスで実装
- グリッドサイズは20px固定
- カスタマイズ不可

### 問題点
1. すべてのユーザーが同じ背景を使用する必要がある
2. 用途に応じた背景の切り替えができない
3. ブランディングやテーマのカスタマイズができない
4. プレゼンテーションモードなど、背景なしの状態が作れない

## 提案する解決策

### 背景レンダリングシステムの導入

#### 基本設計
```typescript
interface BackgroundRenderer<TConfig = unknown> {
  render(container: HTMLElement, camera: Camera, config?: TConfig): void;
  cleanup?(): void;
}

interface BackgroundOptions<TConfig = unknown> {
  renderer: BackgroundRenderer<TConfig>;  // レンダラーを必須に
  config?: TConfig;   // レンダラー固有の設定
}
```

#### Canvas初期化時の設定
```typescript
// デフォルト（何も描画しない）
const canvas = new Canvas(element);

// プリセットレンダラーを使用
const canvas = new Canvas(element, {
  background: {
    renderer: new GridRenderer(),  // グリッド背景
    config: {
      size: 20,
      color: '#e0e0e0'
    }
  }
});

// カスタムレンダラーを使用
const canvas = new Canvas(element, {
  background: {
    renderer: new MyCustomRenderer(),
    config: { /* custom params */ }
  }
});
```

## プリセットレンダラー

### 1. NoneRenderer (デフォルト)
```typescript
class NoneRenderer implements BackgroundRenderer<void> {
  render() {
    // 何も描画しない（白紙背景）
  }
}
```

### 2. GridRenderer
```typescript
interface GridConfig {
  size?: number;      // グリッドサイズ（デフォルト: 20px）
  color?: string;     // 線の色（デフォルト: #e0e0e0）
  thickness?: number; // 線の太さ（デフォルト: 1px）
}

class GridRenderer implements BackgroundRenderer<GridConfig> {
  private _cachedSize?: number;
  private _cachedColor?: string;
  private _cachedThickness?: number;

  render(container: HTMLElement, camera: Camera, config?: GridConfig) {
    const gridSize = config?.size || 20;
    const size = gridSize * camera.zoom;
    const color = config?.color || '#e0e0e0';
    const thickness = config?.thickness || 1;
    
    // パフォーマンス最適化: 値が変更された場合のみ更新
    if (
      this._cachedSize !== size ||
      this._cachedColor !== color ||
      this._cachedThickness !== thickness
    ) {
      container.style.backgroundImage = `
        linear-gradient(to right, ${color} ${thickness}px, transparent ${thickness}px),
        linear-gradient(to bottom, ${color} ${thickness}px, transparent ${thickness}px)
      `;
      container.style.backgroundSize = `${size}px ${size}px`;
      
      this._cachedSize = size;
      this._cachedColor = color;
      this._cachedThickness = thickness;
    }
  }
}
```

### 3. DotsRenderer
```typescript
interface DotsConfig {
  spacing?: number;  // ドット間隔（デフォルト: 20px）
  size?: number;     // ドットサイズ（デフォルト: 2px）
  color?: string;    // ドットの色（デフォルト: #d0d0d0）
}

class DotsRenderer implements BackgroundRenderer<DotsConfig> {
  private _cachedSpacing?: number;
  private _cachedSize?: number;
  private _cachedColor?: string;
  private _cachedSVG?: string;

  render(container: HTMLElement, camera: Camera, config?: DotsConfig) {
    const spacing = (config?.spacing || 20) * camera.zoom;
    const size = config?.size || 2;
    const color = config?.color || '#d0d0d0';
    
    // パフォーマンス最適化: 値が変更された場合のみSVGを再生成
    if (
      this._cachedSpacing !== spacing ||
      this._cachedSize !== size ||
      this._cachedColor !== color
    ) {
      // SVGまたはcanvasでドットパターンを生成
      const svg = this.generateDotsSVG(spacing, size, color);
      container.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
      
      this._cachedSpacing = spacing;
      this._cachedSize = size;
      this._cachedColor = color;
      this._cachedSVG = svg;
    }
  }

  private generateDotsSVG(spacing: number, size: number, color: string): string {
    // SVGパターン生成のロジック
    return `<svg>...</svg>`;
  }
}
```

### 4. LinesRenderer
```typescript
interface LinesConfig {
  direction?: 'horizontal' | 'vertical' | 'both';  // 線の方向
  spacing?: number;    // 線の間隔（デフォルト: 25px）
  color?: string;      // 線の色（デフォルト: #e0e0e0）
  thickness?: number;  // 線の太さ（デフォルト: 1px）
}

class LinesRenderer implements BackgroundRenderer<LinesConfig> {
  private _cachedDirection?: string;
  private _cachedSpacing?: number;
  private _cachedColor?: string;
  private _cachedThickness?: number;

  render(container: HTMLElement, camera: Camera, config?: LinesConfig) {
    const direction = config?.direction || 'horizontal';
    const spacing = (config?.spacing || 25) * camera.zoom;
    const color = config?.color || '#e0e0e0';
    const thickness = config?.thickness || 1;
    
    // パフォーマンス最適化: 値が変更された場合のみ更新
    if (
      this._cachedDirection !== direction ||
      this._cachedSpacing !== spacing ||
      this._cachedColor !== color ||
      this._cachedThickness !== thickness
    ) {
      let gradient = '';
      if (direction === 'horizontal' || direction === 'both') {
        gradient += `linear-gradient(to bottom, ${color} ${thickness}px, transparent ${thickness}px)`;
      }
      if (direction === 'vertical' || direction === 'both') {
        if (gradient) gradient += ', ';
        gradient += `linear-gradient(to right, ${color} ${thickness}px, transparent ${thickness}px)`;
      }
      
      container.style.backgroundImage = gradient;
      container.style.backgroundSize = `${spacing}px ${spacing}px`;
      
      this._cachedDirection = direction;
      this._cachedSpacing = spacing;
      this._cachedColor = color;
      this._cachedThickness = thickness;
    }
  }
}
```

### 5. IsometricRenderer
```typescript
interface IsometricConfig {
  size?: number;   // グリッドサイズ（デフォルト: 30px）
  color?: string;  // 線の色（デフォルト: #e0e0e0）
}

class IsometricRenderer implements BackgroundRenderer<IsometricConfig> {
  private _cachedSize?: number;
  private _cachedColor?: string;
  private _cachedSVG?: string;

  render(container: HTMLElement, camera: Camera, config?: IsometricConfig) {
    const size = (config?.size || 30) * camera.zoom;
    const color = config?.color || '#e0e0e0';
    
    // パフォーマンス最適化: 値が変更された場合のみSVGを再生成
    if (this._cachedSize !== size || this._cachedColor !== color) {
      // アイソメトリック（30度）グリッドのSVGパターンを生成
      const svg = this.generateIsometricSVG(size, color);
      container.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
      
      this._cachedSize = size;
      this._cachedColor = color;
      this._cachedSVG = svg;
    }
  }

  private generateIsometricSVG(size: number, color: string): string {
    // アイソメトリックグリッドのSVGパターン生成ロジック
    return `<svg>...</svg>`;
  }
}
```

## プリセットレンダラーのエクスポート

```typescript
// @usketch/backgrounds パッケージとして提供
export {
  NoneRenderer,
  GridRenderer,
  DotsRenderer,
  LinesRenderer,
  IsometricRenderer
};

// 使いやすいプリセットとしても提供
export const Backgrounds = {
  none: () => new NoneRenderer(),
  grid: () => new GridRenderer(),
  dots: () => new DotsRenderer(),
  lines: () => new LinesRenderer(),
  isometric: () => new IsometricRenderer()
};
```

## 実装計画

### フェーズ1: 基本アーキテクチャ
1. `BackgroundRenderer`インターフェースの定義
2. `Canvas`クラスでの背景オプション受け取り
3. デフォルトで`NoneRenderer`を適用

### フェーズ2: プリセットレンダラー実装
1. `NoneRenderer`（白紙）
2. `GridRenderer`（現在のグリッドを移植）
3. `DotsRenderer`
4. `LinesRenderer`
5. `IsometricRenderer`

### フェーズ3: レンダラー管理
1. レンダラーのライフサイクル管理
2. カメラ変更時の再レンダリング
3. パフォーマンス最適化

### フェーズ4: UI統合
1. 背景選択UI
2. パラメータ調整UI
3. プリセットの保存/読み込み

## 技術的考慮事項

### パフォーマンス
- 背景レンダリングはカメラ変更時のみ実行
- CSS/SVGを活用して再描画を最小化
- カスタムレンダラーのパフォーマンス監視

### 互換性
- 既存のグリッド背景との後方互換性を維持
- 段階的な移行パス

### 拡張性
- プラグインシステムとして設計
- サードパーティレンダラーの追加を容易に

## 使用例

### 基本的な使用
```typescript
import { Canvas } from '@usketch/canvas-core';
import { GridRenderer, DotsRenderer, Backgrounds } from '@usketch/backgrounds';

// デフォルト（白紙）
const canvas = new Canvas(element);

// グリッド背景（直接インスタンス化）
const canvas = new Canvas(element, {
  background: {
    renderer: new GridRenderer(),
    config: { size: 30, color: '#e0e0e0' }
  }
});

// プリセットヘルパーを使用
const canvas = new Canvas(element, {
  background: {
    renderer: Backgrounds.grid(),
    config: { size: 30 }
  }
});
```

### カスタムレンダラー
```typescript
interface BlueprintConfig {
  gridSize?: number;
  primaryColor?: string;
  backgroundColor?: string;
}

class BlueprintRenderer implements BackgroundRenderer<BlueprintConfig> {
  private _cachedSize?: number;
  private _cachedPrimaryColor?: string;
  private _cachedBackgroundColor?: string;

  render(container: HTMLElement, camera: Camera, config?: BlueprintConfig) {
    const size = (config?.gridSize || 25) * camera.zoom;
    const primaryColor = config?.primaryColor || '#1e3a5f';
    const backgroundColor = config?.backgroundColor || '#0d1929';
    
    // パフォーマンス最適化: 値が変更された場合のみ更新
    if (
      this._cachedSize !== size ||
      this._cachedPrimaryColor !== primaryColor ||
      this._cachedBackgroundColor !== backgroundColor
    ) {
      // 青写真風の背景
      container.style.backgroundColor = backgroundColor;
      container.style.backgroundImage = `
        linear-gradient(to right, ${primaryColor} 1px, transparent 1px),
        linear-gradient(to bottom, ${primaryColor} 1px, transparent 1px)
      `;
      container.style.backgroundSize = `${size}px ${size}px`;
      
      this._cachedSize = size;
      this._cachedPrimaryColor = primaryColor;
      this._cachedBackgroundColor = backgroundColor;
    }
  }
  
  cleanup() {
    // 必要に応じてクリーンアップ
  }
}

const canvas = new Canvas(element, {
  background: {
    renderer: new BlueprintRenderer(),
    config: { gridSize: 30 }
  }
});
```

### 動的な背景変更
```typescript
// 実行時に背景を変更
canvas.setBackground({
  renderer: new DotsRenderer(),
  config: { spacing: 15, size: 3 }
});

// プリセットを使って変更
canvas.setBackground({
  renderer: Backgrounds.lines(),
  config: {
    direction: 'horizontal',
    spacing: 25
  }
});

// 背景を削除（白紙に）
canvas.setBackground({
  renderer: new NoneRenderer()
});
```

## 期待される効果

1. **ユーザビリティ向上**: 用途に応じた最適な背景を選択可能
2. **ブランディング**: 企業やプロジェクト固有の背景を設定可能
3. **アクセシビリティ**: 視覚的な好みや要件に対応
4. **拡張性**: 将来的な背景タイプの追加が容易

## リスクと対策

### リスク
1. パフォーマンスへの影響
2. 複雑性の増加
3. 既存コードとの互換性問題

### 対策
1. レンダリング最適化とキャッシング
2. シンプルなAPIデザイン
3. 段階的な実装と十分なテスト

## タイムライン

- **Week 1**: 基本アーキテクチャの実装
- **Week 2**: プリセットレンダラーの実装
- **Week 3**: カスタムレンダラー対応とテスト
- **Week 4**: UI統合とドキュメント作成

## 成功指標

1. すべてのプリセット背景が正常に動作
2. カスタムレンダラーの登録と実行が可能
3. パフォーマンスの劣化なし（60fps維持）
4. 既存機能との完全な互換性