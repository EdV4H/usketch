# EffectLayer 実装計画書（更新版）

## 1. 概要

EffectLayerは、ホワイトボードアプリケーションにおいて一時的に表示される視覚的要素を管理するための新しいレイヤーです。このレイヤーは、通常の図形とは異なり、一時的な視覚フィードバック、アニメーション、コミュニケーション要素などを扱います。

**重要**: ShapePluginやBackgroundRegistryと同様のプラグインアーキテクチャを採用し、カスタムエフェクトの拡張を最初から設計に組み込みます。

### 主な用途
- **視覚的フィードバック**: クリック時のリップルエフェクト、ホバー時のハイライト
- **コミュニケーション要素**: コメントピン、カーソル位置の共有、一時的な注釈
- **一時的なインジケーター**: 選択範囲のプレビュー、ドラッグ中のゴースト表示
- **アニメーション**: 図形追加/削除時のトランジション効果
- **カスタムエフェクト**: プラグインシステムによる独自エフェクトの追加

## 2. パッケージ構成

### 新規パッケージ

#### @usketch/effect-registry
プラグインシステムのコア実装
```
packages/effect-registry/
├── src/
│   ├── effect-registry.ts    # レジストリクラス
│   ├── context.tsx           # React Context
│   ├── hooks.ts              # カスタムフック
│   ├── types.ts              # 型定義
│   └── index.ts
├── package.json
└── tsconfig.json
```

#### @usketch/effect-presets
標準エフェクトプラグインのコレクション（background-presetsと同様の構成）
```
packages/effect-presets/
├── src/
│   ├── plugins/              # 各エフェクトプラグイン
│   │   ├── ripple/
│   │   ├── pin/
│   │   ├── highlight/
│   │   ├── cursor/
│   │   ├── tooltip/
│   │   └── fade/
│   ├── metadata.ts          # プリセットメタデータ
│   └── index.ts
├── package.json
└── tsconfig.json
```

### 既存パッケージの拡張

#### @usketch/shared-types
```typescript
// src/effects.ts を追加
export interface BaseEffect {
  id: string;
  type: string;
  x: number;
  y: number;
  duration?: number;
  createdAt: number;
  zIndex?: number;
  metadata?: Record<string, any>;
}

// 標準エフェクトの型定義
export interface RippleEffect extends BaseEffect {
  type: 'ripple';
  radius: number;
  color: string;
  opacity: number;
}

// ... その他のエフェクト型
```

#### @usketch/store
```typescript
// EffectStore機能を追加
export interface EffectStore {
  effects: Record<string, Effect>;
  
  // Actions
  addEffect: (effect: Effect) => void;
  removeEffect: (id: string) => void;
  updateEffect: (id: string, updates: Partial<Effect>) => void;
  clearEffects: (type?: string) => void;
  clearExpiredEffects: () => void;
}
```

## 3. EffectLayerプラグインアーキテクチャ

### 3.1 EffectPluginインターフェース

```typescript
// packages/effect-registry/src/types.ts
export interface EffectPlugin<T extends BaseEffect = BaseEffect> {
  /** エフェクトタイプの一意識別子 */
  type: string;

  /** エフェクトの表示名 */
  name?: string;

  /** エフェクトをレンダリングするReactコンポーネント */
  component: ComponentType<EffectComponentProps<T>>;

  /** デフォルトエフェクトの作成 */
  createDefaultEffect: (props: CreateEffectProps) => T;

  /** エフェクトの有効性を検証 */
  validate?: (effect: T) => boolean;

  /** エフェクトのライフサイクル管理 */
  lifecycle?: {
    onMount?: (effect: T) => void;
    onUnmount?: (effect: T) => void;
    onUpdate?: (oldEffect: T, newEffect: T) => void;
  };

  /** インタラクション可能かどうか */
  interactive?: boolean;

  /** ヒットテスト（インタラクティブな場合） */
  hitTest?: (effect: T, point: Point) => boolean;

  /** カスタムアニメーション設定 */
  animation?: {
    duration?: number;
    easing?: string;
    loop?: boolean;
  };
}
```

### 3.2 EffectRegistry実装

```typescript
// packages/effect-registry/src/effect-registry.ts
export class EffectRegistry {
  private plugins = new Map<string, EffectPlugin>();
  private listeners = new Set<RegistryEventListener>();

  register<T extends BaseEffect>(plugin: EffectPlugin<T>): void {
    this.plugins.set(plugin.type, plugin as EffectPlugin);
    this.notifyListeners({ type: 'register', effectType: plugin.type, plugin });
  }

  registerMultiple(plugins: EffectPlugin[]): void {
    plugins.forEach(plugin => this.register(plugin));
  }

  getPlugin(type: string): EffectPlugin | undefined {
    return this.plugins.get(type);
  }

  getAvailableTypes(): string[] {
    return Array.from(this.plugins.keys());
  }

  // ... その他のメソッド
}

export const globalEffectRegistry = new EffectRegistry();
```

## 4. effect-presetsパッケージ詳細

### 4.1 プリセットエフェクト一覧

| エフェクト | 説明 | インタラクティブ | 永続性 |
|-----------|------|-----------------|--------|
| ripple | クリック時の波紋 | ❌ | 一時的 |
| pin | コメントピン | ✅ | オプション |
| highlight | ハイライト表示 | ❌ | 一時的 |
| cursor | カーソル共有 | ❌ | リアルタイム |
| tooltip | ツールチップ | ✅ | 一時的 |
| fade | フェード効果 | ❌ | 一時的 |

### 4.2 メタデータ管理

```typescript
// packages/effect-presets/src/metadata.ts
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
  // ... その他のプリセット
} as const;
```

### 4.3 プラグイン実装例

```typescript
// packages/effect-presets/src/plugins/ripple/index.tsx
import type { EffectComponentProps, EffectPlugin } from "@usketch/effect-registry";
import type { RippleEffect } from "@usketch/shared-types";
import { motion } from "framer-motion";

const RippleComponent: React.FC<EffectComponentProps<RippleEffect>> = ({
  effect,
  camera,
  onComplete,
}) => {
  // アニメーション実装
  return (
    <motion.div
      initial={{ scale: 0, opacity: effect.opacity }}
      animate={{ scale: 2, opacity: 0 }}
      transition={{ duration: (effect.duration || 500) / 1000 }}
      onAnimationComplete={onComplete}
      // ... スタイル設定
    />
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

### 4.4 登録ヘルパー関数

```typescript
// packages/effect-presets/src/index.ts
import type { EffectRegistry } from "@usketch/effect-registry";

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

## 5. EffectLayerコンポーネント実装

```typescript
// packages/react-canvas/src/components/effect-layer.tsx
export const EffectLayer: React.FC<EffectLayerProps> = ({
  effects,
  camera,
  className = "",
}) => {
  const registry = useEffectRegistry();
  
  // エフェクトライフサイクル管理
  useEffectLifecycle(effects);
  
  // z-indexでソート
  const sortedEffects = Object.values(effects).sort((a, b) => 
    (a.zIndex || 0) - (b.zIndex || 0)
  );
  
  return (
    <div className={`effect-layer ${className}`}>
      {sortedEffects.map(effect => {
        const plugin = registry.getPlugin(effect.type);
        if (!plugin) return null;
        
        const Component = plugin.component;
        return (
          <div
            key={effect.id}
            style={{
              pointerEvents: plugin.interactive ? "auto" : "none",
            }}
          >
            <Component 
              effect={effect} 
              camera={camera}
              onComplete={() => handleEffectComplete(effect.id)}
            />
          </div>
        );
      })}
    </div>
  );
};
```

## 6. 使用例

### 6.1 アプリケーションでの初期化

```typescript
// apps/whiteboard/src/app.tsx
import { EffectRegistryProvider } from "@usketch/effect-registry";
import { getAllPresetPlugins } from "@usketch/effect-presets";

function App() {
  return (
    <EffectRegistryProvider plugins={getAllPresetPlugins()}>
      <WhiteboardCanvas />
    </EffectRegistryProvider>
  );
}
```

### 6.2 エフェクトの追加

```typescript
const { addEffect } = useWhiteboardStore();

// リップルエフェクトを追加
const handleClick = (e: MouseEvent) => {
  addEffect({
    id: uuidv4(),
    type: "ripple",
    x: e.clientX,
    y: e.clientY,
    radius: 30,
    color: "#00ff00",
    opacity: 0.6,
    duration: 600,
    createdAt: Date.now(),
  });
};
```

### 6.3 カスタムエフェクトの追加

```typescript
// カスタムエフェクトプラグイン
const customEffectPlugin: EffectPlugin = {
  type: "custom-glow",
  name: "Glow Effect",
  component: GlowComponent,
  // ... 実装
};

// 登録
globalEffectRegistry.register(customEffectPlugin);
```

## 7. 実装スケジュール

### Phase 1: 基盤構築（Week 1）
- [ ] effect-registryパッケージ作成
- [ ] effect-presetsパッケージ作成
- [ ] shared-typesへの型追加
- [ ] Storeへの機能追加

### Phase 2: プリセット実装（Week 2）
- [ ] rippleプラグイン実装
- [ ] pinプラグイン実装
- [ ] highlightプラグイン実装
- [ ] その他のプリセット実装

### Phase 3: 統合（Week 3）
- [ ] EffectLayerコンポーネント実装
- [ ] WhiteboardCanvasへの統合
- [ ] エフェクトライフサイクル管理
- [ ] パフォーマンス最適化

### Phase 4: テストとドキュメント（Week 4）
- [ ] ユニットテスト作成
- [ ] 統合テスト作成
- [ ] APIドキュメント作成
- [ ] 使用例とサンプル作成

## 8. パフォーマンス考慮事項

### 最適化戦略
1. **仮想化**: 画面外のエフェクトはレンダリングしない
2. **バッチ処理**: requestAnimationFrameでの更新統合
3. **メモ化**: React.memoによるコンポーネント最適化
4. **自動クリーンアップ**: 期限切れエフェクトの自動削除

### パフォーマンス目標
- 100個のエフェクト同時表示で60fps維持
- メモリ使用量: エフェクトあたり最大1KB
- 初期化時間: 10ms以下

## 9. テスト戦略

### ユニットテスト
- プラグインの登録/解除
- エフェクトの作成/検証
- ライフサイクル管理

### 統合テスト
- レジストリとコンポーネントの統合
- 複数プラグインの共存
- Store連携

### E2Eテスト
- ユーザーインタラクション
- アニメーション動作
- パフォーマンス測定

## 10. まとめ

この実装計画により、uSketchは以下を実現します：

1. **統一されたプラグインアーキテクチャ**: Shape、Background、Effectで一貫した設計
2. **高い拡張性**: effect-presetsパッケージによる標準実装と容易なカスタム拡張
3. **優れたパフォーマンス**: 最適化された描画とライフサイクル管理
4. **開発者フレンドリー**: 明確なAPIと豊富なプリセット

background-presetsパッケージの成功パターンを踏襲し、エフェクト機能を独立したパッケージとして管理することで、保守性と再利用性を高めます。