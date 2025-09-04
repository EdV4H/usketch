# @usketch/backgrounds

背景レンダリングシステムのパッケージです。プリセットの背景パターンとカスタム背景レンダラーの作成をサポートします。

## プリセット背景

以下のプリセット背景が利用可能です：

- **Dots**: ドットパターン
- **Grid**: グリッドパターン  
- **Lines**: ライン（横線、縦線、両方）
- **Isometric**: アイソメトリックグリッド
- **None**: 背景なし

## 使用方法

### React版での使用

```typescript
import { WhiteboardCanvas } from "@usketch/react-canvas";

// プリセット背景の使用
<WhiteboardCanvas
  background={{
    type: "dots",
    spacing: 20,
    size: 2,
    color: "#d0d0d0"
  }}
/>

// グリッド背景
<WhiteboardCanvas
  background={{
    type: "grid",
    size: 20,
    color: "#e0e0e0",
    thickness: 1
  }}
/>
```

### カスタムレンダラーの使用

```typescript
import { WhiteboardCanvas } from "@usketch/react-canvas";
import { GradientRenderer } from "@usketch/backgrounds";

// カスタムレンダラーのインスタンスを作成
const gradientRenderer = new GradientRenderer();

// カスタムレンダラーを使用
<WhiteboardCanvas
  background={{
    type: "custom",
    renderer: gradientRenderer,
    config: {
      startColor: "#ff0000",
      endColor: "#0000ff",
      angle: 45
    }
  }}
/>
```

## カスタムレンダラーの作成

`BackgroundRenderer`インターフェースを実装することで、独自の背景レンダラーを作成できます：

```typescript
import type { Camera } from "@usketch/shared-types";
import type { BackgroundRenderer } from "@usketch/backgrounds";

interface MyConfig {
  // カスタム設定
  pattern?: string;
  opacity?: number;
}

export class MyCustomRenderer implements BackgroundRenderer<MyConfig> {
  render(container: HTMLElement, camera: Camera, config?: MyConfig): void {
    // 背景のレンダリングロジック
    const pattern = config?.pattern || "default";
    const opacity = config?.opacity || 1;
    
    // カメラのズームと位置に応じて背景を調整
    container.style.backgroundImage = `url(${pattern})`;
    container.style.opacity = String(opacity);
    container.style.transform = `scale(${camera.zoom})`;
    container.style.backgroundPosition = `${-camera.x}px ${-camera.y}px`;
  }

  cleanup(container: HTMLElement): void {
    // リソースのクリーンアップ
    container.style.backgroundImage = "";
    container.style.opacity = "";
    container.style.transform = "";
    container.style.backgroundPosition = "";
  }
}
```

## サンプルカスタムレンダラー

パッケージには2つのサンプルカスタムレンダラーが含まれています：

### GradientRenderer

グラデーション背景を描画します：

```typescript
import { GradientRenderer } from "@usketch/backgrounds";

const renderer = new GradientRenderer();

// 使用例
{
  type: "custom",
  renderer: renderer,
  config: {
    startColor: "#ff0000",
    endColor: "#0000ff",
    angle: 45
  }
}
```

### PulseRenderer

パルスアニメーション効果のある背景を描画します：

```typescript
import { PulseRenderer } from "@usketch/backgrounds";

const renderer = new PulseRenderer();

// 使用例
{
  type: "custom",
  renderer: renderer,
  config: {
    color: "#007acc",
    speed: 2000 // ミリ秒
  }
}
```

## API リファレンス

### BackgroundRenderer<TConfig>

```typescript
interface BackgroundRenderer<TConfig = unknown> {
  render(container: HTMLElement, camera: Camera, config?: TConfig): void;
  cleanup?(container: HTMLElement): void;
}
```

- `render`: 背景をレンダリングするメソッド
- `cleanup`: オプション。リソースをクリーンアップするメソッド

### Camera

```typescript
interface Camera {
  x: number;      // X座標
  y: number;      // Y座標  
  zoom: number;   // ズームレベル
}
```

## ベストプラクティス

1. **パフォーマンス**: 重い計算は避け、可能な限りCSSを使用する
2. **クリーンアップ**: `cleanup`メソッドを実装して、DOM要素やイベントリスナーを適切に削除する
3. **カメラ対応**: カメラのズームと位置に応じて背景を調整する
4. **再利用性**: レンダラーインスタンスは再利用可能にする