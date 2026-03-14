# Effect/EffectTool 疎結合化リファクタリング計画

## 現状の問題

### アーキテクチャ上の問題点

1. **EffectToolとEffectの密結合**
   - EffectToolのステートマシン内にEffect生成ロジックが埋め込まれている
   - ripple, pin, fading-pinなどのEffect typeがハードコードされている
   - 新しいEffectを追加するにはEffectToolを変更する必要がある

2. **グローバルステートの使用**
   ```typescript
   // effect-tool-machine.ts (line 92)
   (window as any).__lastCreatedEffect = effect;

   // tool-manager-adapter.ts (lines 264-270)
   if ((window as any).__lastCreatedEffect) {
       const effect = (window as any).__lastCreatedEffect;
       delete (window as any).__lastCreatedEffect;
       whiteboardStore.getState().addEffect(effect);
   }
   ```
   - `window`オブジェクト経由でステートマシンとアダプター間でデータ受け渡し
   - 型安全性の欠如
   - テストが困難
   - レースコンディションのリスク

3. **既存のEffectRegistryとの乖離**
   - `@usketch/effect-registry`パッケージが既に存在
   - `EffectPlugin`インターフェースに`createDefaultEffect`メソッドあり
   - しかしEffectToolはこのRegistryを利用していない

### ShapeSystemとの設計的不整合

ShapeSystemは既にプラグイン方式で実装されている：

```
ShapeRegistry ← ShapePlugin → Shape Component
    ↓
ShapeDrawingTool (Registryからプラグインを取得して描画)
```

しかしEffectSystemは：

```
❌ EffectTool (Effect生成ロジックを内包)
    ↓
Effect直接生成
```

## 目指すべきアーキテクチャ

### 基本設計思想

**EffectとEffectToolを完全に疎結合化**

- EffectRegistry: Effectプラグインの登録と管理（既存）
- EffectTool: 登録されたEffectを発火するトリガーのみ

```
EffectRegistry (Effect定義の管理)
    ↕ 疎結合
EffectTool (登録されたEffectを発火するだけのトリガー)
```

### 具体的なアーキテクチャ

#### 1. EffectRegistry（既存パッケージを活用）

```typescript
// packages/effect-registry/src/types.ts (既存)
export interface EffectPlugin<T extends Effect = Effect> {
    type: string;
    name?: string;
    component: ComponentType<EffectComponentProps<T>>;
    createDefaultEffect: (props: CreateEffectProps) => T; // ← これを活用
    validate?: (effect: T) => boolean;
    interactive?: boolean;
    // ...
}

// packages/effect-registry/src/effect-registry.ts (既存)
export class EffectRegistry {
    register<T extends Effect>(plugin: EffectPlugin<T>): void;
    getPlugin(type: string): EffectPlugin | undefined;
    getAvailableTypes(): string[];
    // ...
}
```

#### 2. EffectToolの再設計（汎用トリガー化）

```typescript
// packages/tools/src/tools/effect-tool-machine.ts (リファクタリング後)
export interface EffectToolContext {
    selectedEffectType: string; // 現在選択されているEffect type
    effectConfig?: Record<string, any>; // Effect生成時のパラメータ
    previewShape: null;
}

export interface EffectToolInput {
    effectRegistry: EffectRegistry;  // Registryへの参照（DI）
    onEffectCreated?: (effect: Effect) => void; // コールバック
}

export function createEffectTool() {
    return setup({
        types: {
            context: {} as EffectToolContext,
            events: {} as EffectToolEvent,
            input: {} as EffectToolInput,
        },
        actions: {
            triggerEffect: ({ context, event, input }) => {
                if (event.type !== "POINTER_DOWN") return;

                // Registryから選択されたEffectプラグインを取得
                const plugin = input.effectRegistry.getPlugin(context.selectedEffectType);
                if (!plugin) {
                    console.warn(`Effect plugin "${context.selectedEffectType}" not found`);
                    return;
                }

                // プラグインのファクトリー関数でEffect生成
                const effect = plugin.createDefaultEffect({
                    id: `${context.selectedEffectType}-${Date.now()}`,
                    x: event.point.x,
                    y: event.point.y,
                    ...context.effectConfig,
                });

                // コールバック経由でストアに追加（グローバルステート不使用）
                input.onEffectCreated?.(effect);
            },
        },
    }).createMachine({
        id: "effectTool",
        initial: "idle",
        context: {
            selectedEffectType: "ripple", // デフォルト
            effectConfig: {},
            previewShape: null,
        },
        states: {
            idle: {
                on: {
                    POINTER_DOWN: {
                        target: "idle",
                        actions: ["triggerEffect"], // "発火"のみ
                    },
                    SET_EFFECT_TYPE: {
                        actions: assign({
                            selectedEffectType: ({ event }) => event.effectType,
                        }),
                    },
                    SET_EFFECT_CONFIG: {
                        actions: assign({
                            effectConfig: ({ event }) => event.config,
                        }),
                    },
                },
            },
        },
    });
}
```

#### 3. ToolManager/Adapterの修正

```typescript
// packages/tools/src/tool-manager.ts
export interface ToolManagerOptions {
    effectRegistry?: EffectRegistry;
    onShapeCreated?: (shape: Shape) => void;
    onEffectCreated?: (effect: Effect) => void;
}

export class ToolManager {
    private effectRegistry?: EffectRegistry;
    private callbacks: {
        onShapeCreated?: (shape: Shape) => void;
        onEffectCreated?: (effect: Effect) => void;
    };

    constructor(tools: Tool[], options?: ToolManagerOptions) {
        this.effectRegistry = options?.effectRegistry;
        this.callbacks = {
            onShapeCreated: options?.onShapeCreated,
            onEffectCreated: options?.onEffectCreated,
        };
    }

    setActiveTool(toolId: string): void {
        const tool = this.findTool(toolId);

        // ツールアクター作成時にRegistryとコールバックを注入
        const actor = createActor(tool.machine, {
            input: {
                effectRegistry: this.effectRegistry,
                onEffectCreated: this.callbacks.onEffectCreated,
                onShapeCreated: this.callbacks.onShapeCreated,
            },
        });

        this.currentActor = actor;
        actor.start();
    }
}
```

```typescript
// packages/tools/src/adapters/tool-manager-adapter.ts
export function createToolManagerAdapter(
    whiteboardStore: WhiteboardStore,
    effectRegistry: EffectRegistry
) {
    const toolManager = new ToolManager(defaultTools, {
        effectRegistry, // EffectRegistryを注入
        onShapeCreated: (shape) => {
            whiteboardStore.getState().addShape(shape);
        },
        onEffectCreated: (effect) => {
            whiteboardStore.getState().addEffect(effect);
        },
    });

    // グローバルステートチェックを完全削除
    // ❌ if (window?.__lastCreatedShape) { ... }
    // ❌ if (window?.__lastCreatedEffect) { ... }

    return toolManager;
}
```

#### 4. アプリケーション側での登録

```typescript
// apps/whiteboard/src/effects/ripple-effect.ts
import type { EffectPlugin } from "@usketch/effect-registry";

export const rippleEffectPlugin: EffectPlugin = {
    type: "ripple",
    name: "Ripple Effect",
    component: RippleEffectComponent,
    createDefaultEffect: ({ id, x, y, ...config }) => ({
        id,
        type: "ripple",
        x, y,
        radius: config.radius || 60,
        color: config.color || "#4ECDC4",
        opacity: config.opacity || 1.0,
        createdAt: Date.now(),
        duration: config.duration || 600,
    }),
};

// apps/whiteboard/src/main.tsx
import { globalEffectRegistry } from "@usketch/effect-registry";
import { rippleEffectPlugin } from "./effects/ripple-effect";
import { pinEffectPlugin } from "./effects/pin-effect";

// 標準Effectを登録
globalEffectRegistry.register(rippleEffectPlugin);
globalEffectRegistry.register(pinEffectPlugin);

// カスタムEffectも追加可能！
// globalEffectRegistry.register(myCustomEffectPlugin);

// ToolManagerAdapterに渡す
const toolManager = createToolManagerAdapter(
    whiteboardStore,
    globalEffectRegistry
);
```

## メリット

### 1. 完全な疎結合
- EffectToolはEffectの種類を知らない
- EffectプラグインはToolSystemを知らない
- 双方が独立して開発・テスト可能

### 2. プラグイン可能性
```typescript
// サードパーティがカスタムEffectを追加可能
const customExplosionEffect: EffectPlugin = {
    type: "explosion",
    name: "Explosion Effect",
    createDefaultEffect: ({ id, x, y }) => ({
        id, type: "explosion", x, y,
        radius: 100, particles: 50,
    }),
    component: ExplosionComponent,
};

effectRegistry.register(customExplosionEffect);
// EffectToolは変更不要で即座に使える！
```

### 3. グローバルステート削除
- `window.__lastCreatedEffect` 完全削除
- 型安全なコールバックパターン
- レースコンディション回避

### 4. ShapeSystemとの設計的一貫性

```
ShapeRegistry ← ShapePlugin → Shape Component
    ↕
ShapeDrawingTool (選択されたShapeを描画)

EffectRegistry ← EffectPlugin → Effect Component
    ↕
EffectTool (選択されたEffectを発火)
```

### 5. テスト容易性
```typescript
// EffectToolのテスト
const mockRegistry = new EffectRegistry();
mockRegistry.register(testEffectPlugin);

const mockCallback = vi.fn();
const actor = createActor(createEffectTool(), {
    input: {
        effectRegistry: mockRegistry,
        onEffectCreated: mockCallback,
    },
});

// グローバルステート不要でテスト可能
```

## 実装手順

### Phase 1: ToolManager基盤整備
1. ToolManagerにEffectRegistry受け取り機能追加
2. ToolManagerにコールバックオプション追加
3. アクター作成時のinput注入実装

### Phase 2: EffectTool汎用化
1. effect-tool-machine.tsリファクタリング
   - Effect生成ロジックを削除
   - EffectRegistry.getPlugin()経由でプラグイン取得
   - plugin.createDefaultEffect()でEffect生成
   - コールバック経由で通知
2. グローバルステート削除

### Phase 3: Adapter/Store統合
1. tool-manager-adapter.tsでEffectRegistryを受け取る
2. onEffectCreatedコールバック設定
3. グローバルステートチェック削除

### Phase 4: アプリケーション側対応
1. 各EffectをEffectPluginとして実装
2. globalEffectRegistryに登録
3. ToolManagerAdapterに渡す

### Phase 5: テスト・ドキュメント
1. EffectToolのユニットテスト更新
2. E2Eテスト確認
3. APIドキュメント更新

## 移行の影響範囲

### 変更が必要なファイル

#### Toolsパッケージ
- `packages/tools/src/tool-manager.ts` - EffectRegistry受け取り
- `packages/tools/src/tools/effect-tool-machine.ts` - 汎用化
- `packages/tools/src/adapters/tool-manager-adapter.ts` - グローバルステート削除

#### Effectsパッケージ
- `apps/whiteboard/src/effects/ripple-effect.ts` - EffectPlugin化
- `apps/whiteboard/src/effects/pin-effect.ts` - EffectPlugin化
- `apps/whiteboard/src/effects/fading-pin-effect.ts` - EffectPlugin化

#### アプリケーション
- `apps/whiteboard/src/main.tsx` - Effect登録処理追加

### 互換性への影響
- ✅ Shape描画は影響なし
- ✅ 既存のEffect表示は影響なし
- ⚠️ EffectToolの内部実装が変わるが、UIは変更なし
- ✅ カスタムツール追加の方法は同じ

## 関連Issue/PR

- PR #151: ToolManager Integration (現在進行中)
  - この設計変更は別PRで実施予定
  - 現PRでは暫定的にEffectToolを無効化

## 参考資料

- `packages/effect-registry/README.md` - EffectRegistry仕様
- `packages/shape-registry/README.md` - ShapeRegistry参考実装
- `docs/implementation/effect-presets-package-design.md` - Effectプリセット設計
- `docs/api/README.md` - API仕様書

## 備考

この設計は既存の`@usketch/effect-registry`パッケージを最大限活用し、ShapeSystemとの設計的一貫性を保ちながら、真にモジュラーで拡張可能なEffect Systemを実現します。
