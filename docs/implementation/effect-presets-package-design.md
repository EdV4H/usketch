# Effect Presets パッケージ設計書

## 概要

`@usketch/effect-presets`パッケージは、標準的なエフェクトプラグインのコレクションを提供します。`@usketch/background-presets`と同様のアーキテクチャを採用し、プリセットエフェクトの管理と配布を行います。

## パッケージ構造

```
packages/effect-presets/
├── src/
│   ├── plugins/           # エフェクトプラグイン実装
│   │   ├── ripple/
│   │   │   ├── index.tsx
│   │   │   └── types.ts
│   │   ├── pin/
│   │   │   ├── index.tsx
│   │   │   └── types.ts
│   │   ├── highlight/
│   │   │   ├── index.tsx
│   │   │   └── types.ts
│   │   ├── cursor/
│   │   │   ├── index.tsx
│   │   │   └── types.ts
│   │   ├── tooltip/
│   │   │   ├── index.tsx
│   │   │   └── types.ts
│   │   └── fade/
│   │       ├── index.tsx
│   │       └── types.ts
│   ├── index.ts          # メインエクスポート
│   ├── metadata.ts       # プリセットメタデータ
│   └── types.ts         # 共通型定義
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## package.json

```json
{
  "name": "@usketch/effect-presets",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "dev": "vite build --watch",
    "build": "tsc --noEmit && vite build && tsc --emitDeclarationOnly",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@usketch/effect-registry": "workspace:*",
    "@usketch/shared-types": "workspace:*",
    "framer-motion": "^11.0.0"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "19.1.12",
    "@types/react-dom": "19.1.9",
    "@usketch/tsconfig": "workspace:*",
    "@usketch/vite-config": "workspace:*",
    "@vitejs/plugin-react": "5.0.2",
    "typescript": "5.9.2",
    "vite": "7.1.5"
  }
}
```

## 実装例

### src/plugins/ripple/index.tsx

```typescript
import type { EffectComponentProps, EffectPlugin } from "@usketch/effect-registry";
import type { RippleEffect } from "@usketch/shared-types";
import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";

export interface RippleEffectConfig {
  radius?: number;
  color?: string;
  duration?: number;
  opacity?: number;
}

const RippleComponent: React.FC<EffectComponentProps<RippleEffect>> = ({
  effect,
  camera,
  onComplete,
}) => {
  const [isAnimating, setIsAnimating] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
      onComplete?.();
    }, effect.duration || 500);
    
    return () => clearTimeout(timer);
  }, [effect.duration, onComplete]);
  
  const x = effect.x * camera.zoom + camera.x;
  const y = effect.y * camera.zoom + camera.y;
  
  return (
    <motion.div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
      initial={{ scale: 0, opacity: effect.opacity }}
      animate={{ 
        scale: isAnimating ? 2 : 0,
        opacity: isAnimating ? 0 : effect.opacity,
      }}
      transition={{ duration: (effect.duration || 500) / 1000 }}
    >
      <div
        style={{
          width: effect.radius * 2,
          height: effect.radius * 2,
          borderRadius: "50%",
          backgroundColor: effect.color,
        }}
      />
    </motion.div>
  );
};

export const ripplePlugin: EffectPlugin<RippleEffect> = {
  type: "ripple",
  name: "Ripple Effect",
  component: RippleComponent,
  
  createDefaultEffect: ({ id, x, y, ...config }) => ({
    id,
    type: "ripple",
    x,
    y,
    radius: config.radius || 20,
    color: config.color || "#007bff",
    opacity: config.opacity || 0.5,
    duration: config.duration || 500,
    createdAt: Date.now(),
  }),
  
  validate: (effect) => {
    return effect.type === "ripple" && 
           typeof effect.radius === "number" &&
           effect.radius > 0;
  },
  
  animation: {
    duration: 500,
    easing: "easeOut",
  },
};
```

### src/metadata.ts

```typescript
/**
 * uSketchプリセットエフェクトのメタデータ
 */
export const PRESET_EFFECTS_METADATA = {
  "usketch.ripple": {
    name: "リップル",
    description: "クリック時の波紋エフェクト",
    defaultConfig: {
      radius: 20,
      color: "#007bff",
      duration: 500,
      opacity: 0.5,
    },
  },
  "usketch.pin": {
    name: "ピン",
    description: "コメントや注釈用のピン",
    defaultConfig: {
      color: "#ff6b6b",
      size: 24,
    },
  },
  "usketch.highlight": {
    name: "ハイライト",
    description: "要素を強調表示",
    defaultConfig: {
      color: "#ffeb3b",
      opacity: 0.3,
      pulseAnimation: false,
    },
  },
  "usketch.cursor": {
    name: "カーソル",
    description: "他ユーザーのカーソル表示",
    defaultConfig: {
      size: 16,
      showName: true,
    },
  },
  "usketch.tooltip": {
    name: "ツールチップ",
    description: "ホバー時の情報表示",
    defaultConfig: {
      backgroundColor: "#333",
      textColor: "#fff",
      fontSize: 14,
    },
  },
  "usketch.fade": {
    name: "フェード",
    description: "フェードイン/アウトエフェクト",
    defaultConfig: {
      duration: 300,
      fadeIn: true,
      fadeOut: true,
    },
  },
} as const;

/**
 * すべてのプリセットIDを取得
 */
export function getAllPresetIds(): string[] {
  return Object.keys(PRESET_EFFECTS_METADATA);
}

/**
 * プリセットのメタデータを取得
 */
export function getPresetMetadata(id: string) {
  return PRESET_EFFECTS_METADATA[id as keyof typeof PRESET_EFFECTS_METADATA];
}
```

### src/index.ts

```typescript
// プラグインのエクスポート
export { ripplePlugin } from "./plugins/ripple";
export type { RippleEffectConfig } from "./plugins/ripple";

export { pinPlugin } from "./plugins/pin";
export type { PinEffectConfig } from "./plugins/pin";

export { highlightPlugin } from "./plugins/highlight";
export type { HighlightEffectConfig } from "./plugins/highlight";

export { cursorPlugin } from "./plugins/cursor";
export type { CursorEffectConfig } from "./plugins/cursor";

export { tooltipPlugin } from "./plugins/tooltip";
export type { TooltipEffectConfig } from "./plugins/tooltip";

export { fadePlugin } from "./plugins/fade";
export type { FadeEffectConfig } from "./plugins/fade";

// メタデータのエクスポート
export { 
  PRESET_EFFECTS_METADATA, 
  getAllPresetIds, 
  getPresetMetadata 
} from "./metadata";

// レジストリに登録する関数
import type { EffectRegistry } from "@usketch/effect-registry";
import { cursorPlugin } from "./plugins/cursor";
import { fadePlugin } from "./plugins/fade";
import { highlightPlugin } from "./plugins/highlight";
import { pinPlugin } from "./plugins/pin";
import { ripplePlugin } from "./plugins/ripple";
import { tooltipPlugin } from "./plugins/tooltip";

/**
 * uSketchプリセットエフェクトをレジストリに登録
 */
export function registerPresetEffects(registry: EffectRegistry): void {
  registry.registerMultiple([
    ripplePlugin,
    pinPlugin,
    highlightPlugin,
    cursorPlugin,
    tooltipPlugin,
    fadePlugin,
  ]);
}

/**
 * すべてのプリセットプラグインを配列で取得
 */
export function getAllPresetPlugins() {
  return [
    ripplePlugin,
    pinPlugin,
    highlightPlugin,
    cursorPlugin,
    tooltipPlugin,
    fadePlugin,
  ];
}
```

## 使用例

### アプリケーションでの使用

```typescript
import { EffectRegistryProvider } from "@usketch/effect-registry";
import { getAllPresetPlugins } from "@usketch/effect-presets";
import { WhiteboardCanvas } from "@usketch/react-canvas";

function App() {
  return (
    <EffectRegistryProvider plugins={getAllPresetPlugins()}>
      <WhiteboardCanvas />
    </EffectRegistryProvider>
  );
}
```

### 個別プラグインの使用

```typescript
import { globalEffectRegistry } from "@usketch/effect-registry";
import { ripplePlugin, pinPlugin } from "@usketch/effect-presets";

// 必要なプラグインのみを登録
globalEffectRegistry.register(ripplePlugin);
globalEffectRegistry.register(pinPlugin);
```

### エフェクトの追加

```typescript
import { useWhiteboardStore } from "@usketch/store";
import { v4 as uuidv4 } from "uuid";

const { addEffect } = useWhiteboardStore();

// リップルエフェクトを追加
addEffect({
  id: uuidv4(),
  type: "ripple",
  x: 100,
  y: 100,
  radius: 30,
  color: "#00ff00",
  opacity: 0.6,
  duration: 600,
  createdAt: Date.now(),
});

// ピンエフェクトを追加
addEffect({
  id: uuidv4(),
  type: "pin",
  x: 200,
  y: 200,
  color: "#ff0000",
  message: "重要なポイント",
  authorId: "user123",
  createdAt: Date.now(),
});
```

## パッケージの利点

### 1. モジュラー設計
- 各エフェクトが独立したプラグインとして実装
- 必要なエフェクトのみを選択的に使用可能
- ツリーシェイキングによるバンドルサイズ最適化

### 2. 一貫性のあるAPI
- `background-presets`と同様の設計パターン
- 統一されたメタデータ管理
- 標準化された登録方法

### 3. 拡張性
- カスタムエフェクトの追加が容易
- プラグインインターフェースに準拠すれば互換性を維持
- コミュニティプラグインとの共存が可能

### 4. 保守性
- 各エフェクトが独立してテスト可能
- バージョン管理が容易
- 依存関係の明確化

## テスト戦略

### ユニットテスト
```typescript
// plugins/ripple/ripple.test.tsx
import { render } from "@testing-library/react";
import { ripplePlugin } from "./index";

describe("RipplePlugin", () => {
  it("should create default effect with correct properties", () => {
    const effect = ripplePlugin.createDefaultEffect({
      id: "test-id",
      x: 100,
      y: 200,
    });
    
    expect(effect).toMatchObject({
      id: "test-id",
      type: "ripple",
      x: 100,
      y: 200,
      radius: 20,
      color: "#007bff",
      opacity: 0.5,
      duration: 500,
    });
  });
  
  it("should validate effect correctly", () => {
    const validEffect = {
      id: "test",
      type: "ripple" as const,
      x: 0,
      y: 0,
      radius: 10,
      color: "#000",
      opacity: 1,
      createdAt: Date.now(),
    };
    
    expect(ripplePlugin.validate?.(validEffect)).toBe(true);
  });
});
```

### 統合テスト
- レジストリへの登録確認
- 複数プラグインの共存確認
- エフェクトレンダリングの確認

## まとめ

`@usketch/effect-presets`パッケージは、`@usketch/background-presets`の成功パターンを踏襲し、エフェクトプラグインの標準コレクションを提供します。モジュラー設計により、必要なエフェクトのみを選択的に使用でき、アプリケーションのパフォーマンスを最適化しながら豊富な視覚効果を提供できます。