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

## Reactコンポーネントとして背景を作成

React版では、JSX/Reactコンポーネントとして背景を作成できます：

```tsx
import type { BackgroundComponent } from "@usketch/react-canvas";

// カスタム背景コンポーネント
const MyBackground: BackgroundComponent = ({ camera, config }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: `linear-gradient(45deg, ${config?.color1 || "#ff0000"}, ${config?.color2 || "#0000ff"})`,
        transform: `translate(${-camera.x}px, ${-camera.y}px) scale(${camera.zoom})`,
        transformOrigin: "0 0",
        pointerEvents: "none",
      }}
    />
  );
};

// 使用方法
<WhiteboardCanvas
  background={{
    type: "component",
    component: MyBackground,
    config: {
      color1: "#667eea",
      color2: "#764ba2",
    }
  }}
/>
```

### SVGを使った背景コンポーネント

```tsx
const SVGPatternBackground: BackgroundComponent = ({ camera }) => {
  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <defs>
        <pattern
          id="custom-pattern"
          x={-camera.x}
          y={-camera.y}
          width={50 * camera.zoom}
          height={50 * camera.zoom}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={25 * camera.zoom} cy={25 * camera.zoom} r={5 * camera.zoom} fill="#007acc" opacity="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#custom-pattern)" />
    </svg>
  );
};
```

### アニメーション付き背景コンポーネント

```tsx
const AnimatedBackground: BackgroundComponent = ({ camera }) => {
  const [time, setTime] = React.useState(0);
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setTime(t => t + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: `hsl(${time % 360}, 50%, 95%)`,
        transition: "background 0.1s",
        pointerEvents: "none",
      }}
    />
  );
};
```

## DOM操作ベースのレンダラー作成

`BackgroundRenderer`インターフェースを実装することで、DOM操作ベースの背景レンダラーを作成できます：

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