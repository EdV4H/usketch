# EffectLayer 実装計画書

## 1. 概要

EffectLayerは、ホワイトボードアプリケーションにおいて一時的に表示される視覚的要素を管理するための新しいレイヤーです。このレイヤーは、通常の図形とは異なり、一時的な視覚フィードバック、アニメーション、コミュニケーション要素などを扱います。

**重要**: ShapePluginやBackgroundRegistryと同様のプラグインアーキテクチャを採用し、カスタムエフェクトの拡張を最初から設計に組み込みます。

### 主な用途
- **視覚的フィードバック**: クリック時のリップルエフェクト、ホバー時のハイライト
- **コミュニケーション要素**: コメントピン、カーソル位置の共有、一時的な注釈
- **一時的なインジケーター**: 選択範囲のプレビュー、ドラッグ中のゴースト表示
- **アニメーション**: 図形追加/削除時のトランジション効果
- **カスタムエフェクト**: プラグインシステムによる独自エフェクトの追加

## 2. 現在のアーキテクチャ分析

### 既存のレイヤー構成
現在のWhiteboardCanvasは以下の4つのレイヤーで構成されています：

```tsx
<WhiteboardCanvas>
  <BackgroundLayer />    // グリッド、ドットなどの背景
  <ShapeLayer />        // 実際の図形を表示
  <SelectionLayer />    // 選択状態の表示
  <InteractionLayer />  // 描画中のプレビュー
</WhiteboardCanvas>
```

### 既存のStore構造
```typescript
interface WhiteboardStore {
  shapes: Record<string, Shape>;
  selectedShapeIds: Set<string>;
  camera: Camera;
  activeTool: string;
  // ... その他のプロパティ
}
```

## 3. EffectLayerプラグインアーキテクチャ設計

### 3.1 Effect型定義とプラグインシステム

```typescript
// packages/shared-types/src/effects.ts
export interface BaseEffect {
  id: string;
  type: string;
  x: number;
  y: number;
  duration?: number;      // ミリ秒単位、undefinedは永続表示
  createdAt: number;      // タイムスタンプ
  zIndex?: number;        // 表示順序
  metadata?: Record<string, any>;
}

// 標準エフェクトの型定義
export interface RippleEffect extends BaseEffect {
  type: 'ripple';
  radius: number;
  color: string;
  opacity: number;
}

export interface PinEffect extends BaseEffect {
  type: 'pin';
  label?: string;
  color: string;
  authorId?: string;
  message?: string;
}

export interface CursorEffect extends BaseEffect {
  type: 'cursor';
  userId: string;
  userName: string;
  color: string;
}

export interface HighlightEffect extends BaseEffect {
  type: 'highlight';
  width: number;
  height: number;
  color: string;
  opacity: number;
  pulseAnimation?: boolean;
}

export type Effect = RippleEffect | PinEffect | CursorEffect | HighlightEffect | CustomEffect;

// カスタムエフェクト用の拡張可能な型
export interface CustomEffect extends BaseEffect {
  type: string; // カスタムタイプ
  [key: string]: any; // 追加のプロパティ
}
```

### 3.2 EffectPluginインターフェース

```typescript
// packages/effect-registry/src/types.ts
import type { BaseEffect, Camera } from "@usketch/shared-types";
import type { ComponentType } from "react";

/**
 * エフェクトコンポーネントのProps
 */
export interface EffectComponentProps<T extends BaseEffect = BaseEffect> {
  effect: T;
  camera: Camera;
  onComplete?: () => void;  // アニメーション完了時のコールバック
  onInteraction?: (event: InteractionEvent) => void;
}

/**
 * エフェクトプラグイン定義（ShapePluginと同様の設計）
 */
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
    /** エフェクトが追加された時 */
    onMount?: (effect: T) => void;
    /** エフェクトが削除される時 */
    onUnmount?: (effect: T) => void;
    /** エフェクトが更新された時 */
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

export interface CreateEffectProps {
  id: string;
  x: number;
  y: number;
  [key: string]: any;
}
```

### 3.3 EffectRegistry実装

```typescript
// packages/effect-registry/src/effect-registry.ts
export class EffectRegistry {
  private plugins = new Map<string, EffectPlugin>();
  private listeners = new Set<RegistryEventListener>();

  /**
   * プラグインを登録（ShapeRegistryと同様のパターン）
   */
  register<T extends BaseEffect>(plugin: EffectPlugin<T>): void {
    if (this.plugins.has(plugin.type)) {
      console.warn(`Effect plugin "${plugin.type}" is already registered`);
    }
    this.plugins.set(plugin.type, plugin as EffectPlugin);
    this.notifyListeners({ type: 'register', effectType: plugin.type, plugin });
  }

  /**
   * 複数のプラグインを一括登録
   */
  registerMultiple(plugins: EffectPlugin[]): void {
    plugins.forEach(plugin => this.register(plugin));
  }

  /**
   * プラグインを取得
   */
  getPlugin(type: string): EffectPlugin | undefined {
    return this.plugins.get(type);
  }

  /**
   * 利用可能なエフェクトタイプを取得
   */
  getAvailableTypes(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * プラグインの登録を解除
   */
  unregister(type: string): void {
    const plugin = this.plugins.get(type);
    if (plugin) {
      this.plugins.delete(type);
      this.notifyListeners({ type: 'unregister', effectType: type, plugin });
    }
  }

  // イベントリスナー管理
  addEventListener(listener: RegistryEventListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(listener: RegistryEventListener): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(event: RegistryEvent): void {
    this.listeners.forEach(listener => listener(event));
  }
}

// グローバルインスタンス
export const globalEffectRegistry = new EffectRegistry();
```

### 3.4 EffectRegistryProvider（React Context）

```typescript
// packages/effect-registry/src/context.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { EffectRegistry, globalEffectRegistry } from "./effect-registry";
import type { EffectPlugin } from "./types";

interface EffectRegistryContextValue {
  registry: EffectRegistry;
  availableTypes: string[];
}

const EffectRegistryContext = createContext<EffectRegistryContextValue | null>(null);

export interface EffectRegistryProviderProps {
  children: React.ReactNode;
  plugins?: EffectPlugin[];
  registry?: EffectRegistry;
}

export const EffectRegistryProvider: React.FC<EffectRegistryProviderProps> = ({
  children,
  plugins = [],
  registry = globalEffectRegistry,
}) => {
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);

  useEffect(() => {
    // プラグインを登録
    plugins.forEach(plugin => registry.register(plugin));

    // 利用可能なタイプを更新
    const updateTypes = () => {
      setAvailableTypes(registry.getAvailableTypes());
    };

    updateTypes();

    // レジストリの変更を監視
    const listener = () => updateTypes();
    registry.addEventListener(listener);

    return () => {
      registry.removeEventListener(listener);
    };
  }, [plugins, registry]);

  return (
    <EffectRegistryContext.Provider value={{ registry, availableTypes }}>
      {children}
    </EffectRegistryContext.Provider>
  );
};

// Hooks
export const useEffectRegistry = () => {
  const context = useContext(EffectRegistryContext);
  if (!context) {
    throw new Error("useEffectRegistry must be used within EffectRegistryProvider");
  }
  return context.registry;
};

export const useEffectPlugin = (type: string) => {
  const registry = useEffectRegistry();
  return registry.getPlugin(type);
};

export const useAvailableEffectTypes = () => {
  const context = useContext(EffectRegistryContext);
  if (!context) {
    throw new Error("useAvailableEffectTypes must be used within EffectRegistryProvider");
  }
  return context.availableTypes;
};
```

### 3.5 Store拡張

```typescript
// packages/store/src/effect-store.ts
export interface EffectStore {
  effects: Record<string, Effect>;
  
  // Actions
  addEffect: (effect: Effect) => void;
  removeEffect: (id: string) => void;
  updateEffect: (id: string, updates: Partial<Effect>) => void;
  clearEffects: (type?: string) => void;
  clearExpiredEffects: () => void;
}

// WhiteboardStoreに統合
export interface WhiteboardStore extends WhiteboardState, EffectStore {
  // 既存のプロパティ...
}
```

### 3.6 EffectLayerコンポーネント

```typescript
// packages/react-canvas/src/components/effect-layer.tsx
import { useEffectRegistry } from "@usketch/effect-registry";
import type { Effect, Camera } from "@usketch/shared-types";
import React from "react";
import { useEffectLifecycle } from "../hooks/use-effect-lifecycle";

export interface EffectLayerProps {
  effects: Record<string, Effect>;
  camera: Camera;
  className?: string;
}

export const EffectLayer: React.FC<EffectLayerProps> = ({
  effects,
  camera,
  className = "",
}) => {
  const registry = useEffectRegistry();
  
  // 効果の自動削除処理
  useEffectLifecycle(effects);
  
  // 効果をz-indexでソート
  const sortedEffects = Object.values(effects).sort((a, b) => 
    (a.zIndex || 0) - (b.zIndex || 0)
  );
  
  return (
    <div 
      className={`effect-layer ${className}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none", // デフォルトではポインターイベントを無効化
      }}
    >
      {sortedEffects.map(effect => {
        const plugin = registry.getPlugin(effect.type);
        if (!plugin) {
          console.warn(`No plugin found for effect type: ${effect.type}`);
          return null;
        }
        
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
              onComplete={() => {
                // アニメーション完了時の処理
                if (effect.duration && effect.duration > 0) {
                  // Storeから削除
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
```

## 4. 標準エフェクトプラグインの実装例

### 4.1 RippleEffectプラグイン

```typescript
// packages/effect-plugins/src/ripple/index.tsx
import type { EffectPlugin, RippleEffect } from "@usketch/effect-registry";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

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
  
  createDefaultEffect: ({ id, x, y }) => ({
    id,
    type: "ripple",
    x,
    y,
    radius: 20,
    color: "#007bff",
    opacity: 0.5,
    duration: 500,
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

### 4.2 PinEffectプラグイン

```typescript
// packages/effect-plugins/src/pin/index.tsx
import type { EffectPlugin, PinEffect } from "@usketch/effect-registry";
import React, { useState } from "react";
import { Popover } from "@usketch/ui-components";

const PinComponent: React.FC<EffectComponentProps<PinEffect>> = ({
  effect,
  camera,
  onInteraction,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const x = effect.x * camera.zoom + camera.x;
  const y = effect.y * camera.zoom + camera.y;
  
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          backgroundColor: effect.color,
          border: "2px solid white",
          cursor: "pointer",
        }}
      >
        {effect.label}
      </button>
      
      {isOpen && effect.message && (
        <Popover>
          <div>{effect.message}</div>
          {effect.authorId && <div>By: {effect.authorId}</div>}
        </Popover>
      )}
    </div>
  );
};

export const pinPlugin: EffectPlugin<PinEffect> = {
  type: "pin",
  name: "Comment Pin",
  component: PinComponent,
  interactive: true,
  
  createDefaultEffect: ({ id, x, y, message, authorId }) => ({
    id,
    type: "pin",
    x,
    y,
    color: "#ff6b6b",
    message,
    authorId,
    createdAt: Date.now(),
  }),
  
  hitTest: (effect, point) => {
    const dx = point.x - effect.x;
    const dy = point.y - effect.y;
    return Math.sqrt(dx * dx + dy * dy) <= 12; // 12px radius
  },
};
```

## 5. 実装手順

### Phase 1: 基盤構築とプラグインシステム (Week 1)
1. **Effect Registry パッケージの作成**
   - `packages/effect-registry/`を新規作成
   - EffectPlugin型定義とRegistry実装
   - React Context とHooksの実装

2. **型定義の追加**
   - `packages/shared-types/src/effects.ts`を作成
   - BaseEffectと標準エフェクトの型定義

3. **Store拡張**
   - `packages/store/src/effect-store.ts`を作成
   - EffectStore機能を実装
   - WhiteboardStoreに統合

4. **EffectLayerコンポーネント**
   - `packages/react-canvas/src/components/effect-layer.tsx`を作成
   - プラグインベースのレンダリング実装
   - WhiteboardCanvasに統合

### Phase 2: 標準エフェクトプラグイン (Week 2)
1. **Effect Plugins パッケージの作成**
   - `packages/effect-plugins/`を新規作成
   - 標準エフェクトプラグインの実装

2. **基本エフェクトプラグイン**
   - RippleEffectプラグイン
   - HighlightEffectプラグイン
   - FadeEffectプラグイン

3. **エフェクト管理Hook**
   - `useEffectLifecycle`: 期限切れエフェクトの自動削除
   - `useEffectAnimation`: アニメーション制御
   - `useEffectInteraction`: インタラクション管理

### Phase 3: インタラクティブエフェクト (Week 3)
1. **PinEffectプラグイン**
   - コメントピン機能
   - ポップオーバー表示
   - 永続化オプション

2. **CursorEffectプラグイン**
   - リアルタイムカーソル表示
   - ユーザー識別
   - スムーズな追従アニメーション

3. **TooltipEffectプラグイン**
   - ホバー時のツールチップ
   - カスタマイズ可能な表示

### Phase 4: 高度な機能と最適化 (Week 4)
1. **パフォーマンス最適化**
   - 仮想化によるレンダリング最適化
   - React.memoによるメモ化
   - requestAnimationFrameの活用

2. **カスタムエフェクトサポート**
   - サードパーティプラグインのサンプル
   - プラグイン開発ガイド
   - APIドキュメント

3. **統合テスト**
   - 既存レイヤーとの統合テスト
   - パフォーマンステスト
   - E2Eテスト

## 6. 技術的考慮事項

### 6.1 パフォーマンス
- **仮想化**: 画面外のエフェクトはレンダリングしない
- **バッチ更新**: requestAnimationFrameを使用した効率的な更新
- **メモリ管理**: 期限切れエフェクトの自動クリーンアップ

### 6.2 アニメーション
- **CSS vs JS**: 軽量なエフェクトはCSS、複雑なものはframer-motion
- **GPUアクセラレーション**: transform、opacityを優先使用
- **60fps維持**: パフォーマンスモニタリング

### 6.3 アクセシビリティ
- **モーション設定**: prefers-reduced-motionの尊重
- **代替表現**: 視覚的エフェクトの代替テキスト
- **キーボード操作**: ピンなどのインタラクティブ要素のサポート

### 6.4 プラグインシステムの利点
- **拡張性**: サードパーティによるカスタムエフェクトの追加が容易
- **保守性**: エフェクトごとに独立したモジュールとして管理
- **再利用性**: プラグインを他のプロジェクトでも使用可能
- **型安全性**: TypeScriptによる厳密な型定義

## 7. API設計

### 7.1 エフェクト追加API
```typescript
// 使用例
const { addEffect } = useWhiteboardStore();

// リップルエフェクト
addEffect({
  id: uuidv4(),
  type: 'ripple',
  x: clickX,
  y: clickY,
  radius: 50,
  color: '#007bff',
  opacity: 0.5,
  duration: 500,
  createdAt: Date.now(),
});

// コメントピン
addEffect({
  id: uuidv4(),
  type: 'pin',
  x: position.x,
  y: position.y,
  label: 'Comment',
  message: 'This needs review',
  color: '#ff6b6b',
  createdAt: Date.now(),
});
```

### 7.2 プラグイン登録API
```typescript
// プラグインの登録（アプリケーション初期化時）
import { globalEffectRegistry } from "@usketch/effect-registry";
import { ripplePlugin, pinPlugin, highlightPlugin } from "@usketch/effect-plugins";
import { customEffectPlugin } from "./custom-effects";

// 標準プラグインの登録
globalEffectRegistry.registerMultiple([
  ripplePlugin,
  pinPlugin,
  highlightPlugin,
]);

// カスタムプラグインの登録
globalEffectRegistry.register(customEffectPlugin);

// Reactコンポーネントでの使用
function App() {
  return (
    <EffectRegistryProvider plugins={[customEffectPlugin]}>
      <WhiteboardCanvas />
    </EffectRegistryProvider>
  );
}
```

### 7.3 カスタムエフェクトプラグインの作成
```typescript
// カスタムエフェクトプラグインの例
import type { EffectPlugin, CustomEffect } from "@usketch/effect-registry";

interface ParticleEffect extends CustomEffect {
  type: 'particle';
  particleCount: number;
  spread: number;
  colors: string[];
}

const ParticleComponent: React.FC<EffectComponentProps<ParticleEffect>> = ({
  effect,
  camera,
}) => {
  // パーティクルアニメーションの実装
  return <div>...</div>;
};

export const particlePlugin: EffectPlugin<ParticleEffect> = {
  type: "particle",
  name: "Particle Effect",
  component: ParticleComponent,
  
  createDefaultEffect: ({ id, x, y }) => ({
    id,
    type: "particle",
    x,
    y,
    particleCount: 20,
    spread: 50,
    colors: ["#ff0000", "#00ff00", "#0000ff"],
    duration: 1000,
    createdAt: Date.now(),
  }),
  
  animation: {
    duration: 1000,
    easing: "easeOutQuad",
  },
};
```

## 8. テスト戦略

### 8.1 ユニットテスト
- Effect Registry のプラグイン登録/解除
- Effect Store のアクション
- エフェクトライフサイクル管理
- 座標変換ロジック

### 8.2 統合テスト
- WhiteboardCanvasとの統合
- プラグインベースのレンダリング
- エフェクトの追加/削除フロー
- パフォーマンステスト

### 8.3 E2Eテスト
- ユーザーインタラクションによるエフェクト表示
- アニメーション動作確認
- マルチエフェクトの同時表示
- カスタムプラグインの動作

## 9. 将来の拡張性

### 9.1 マルチユーザー対応
- WebSocketによるエフェクト同期
- ユーザー固有のエフェクト表示
- 権限管理

### 9.2 AI統合
- スマート注釈
- 自動ハイライト提案
- コンテキスト認識エフェクト

### 9.3 エクスポート機能
- エフェクト付き画像エクスポート
- アニメーションGIF生成
- ビデオ録画機能

### 9.4 プラグインエコシステム
- プラグインマーケットプレイス
- コミュニティ製プラグイン
- プラグイン開発キット（SDK）

## 10. 実装優先順位

1. **必須機能** (MVP)
   - Effect Registryの実装
   - プラグインシステムの基盤
   - 基本的なEffectLayer実装
   - RippleEffectとHighlightEffectプラグイン
   - Store統合

2. **重要機能**
   - PinEffectプラグイン（コメント機能）
   - エフェクトライフサイクル管理
   - 基本的なアニメーション
   - プラグイン開発ドキュメント

3. **Nice to Have**
   - CursorEffectプラグイン（マルチユーザー向け）
   - 高度なアニメーション
   - パフォーマンス最適化
   - プラグインサンプル集

## 11. リスクと対策

### リスク1: パフォーマンス低下
**対策**: 
- エフェクト数の上限設定
- デバウンス/スロットリング
- パフォーマンスモニタリング

### リスク2: 既存機能との競合
**対策**:
- z-indexの適切な管理
- イベントバブリングの制御
- 段階的な統合

### リスク3: ブラウザ互換性
**対策**:
- プログレッシブエンハンスメント
- フォールバック実装
- ブラウザ機能検出

### リスク4: プラグイン互換性
**対策**:
- 明確なAPIバージョニング
- 後方互換性の維持
- プラグインテストスイート

## まとめ

EffectLayerの実装により、uSketchは以下の価値を提供できるようになります：

1. **向上したユーザー体験**: 視覚的フィードバックによる直感的な操作
2. **コラボレーション機能**: コメントやカーソル共有による協働作業
3. **無限の拡張性**: プラグインシステムによる柔軟なカスタマイズ
4. **エコシステムの構築**: サードパーティ開発者によるプラグイン提供

### プラグインアーキテクチャの採用理由

ShapePluginやBackgroundRegistryと同様のプラグインアーキテクチャを採用することで：

- **統一されたアーキテクチャ**: プロジェクト全体で一貫したプラグインパターン
- **開発者にとって親しみやすい**: 既存のプラグイン開発知識を活用可能
- **保守性の向上**: 各エフェクトが独立したモジュールとして管理される
- **スケーラビリティ**: 新しいエフェクトの追加が容易

実装は段階的に進め、最初からプラグインシステムを組み込むことで、将来的な拡張に対して柔軟に対応できる基盤を構築します。