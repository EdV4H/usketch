# uSketch v2 プラグインシステム設計書

**作成日**: 2026-03-14
**ステータス**: 設計段階

---

## 1. 概要

uSketch v2では、**全ての描画機能をプラグインとして実装**する。
コアフレームワークは薄いプラグインAPI + レイヤーシステムのみを提供し、具体的な機能（ツール、シェイプ、背景、エクスポート等）は全てプラグインパッケージとして分離する。

### 設計目標

- **統一インターフェース**: ツール、シェイプ、背景、機能拡張の全てが同じ `UsketchPlugin` 型で定義される
- **自己完結型**: shape + それを作成するtoolは1つのプラグインにバンドル
- **動的ロード**: プラグインは動的インポートでき、コード分割が自然にできる
- **型安全**: 全プラグインの設定・データがZodスキーマで検証される

---

## 2. レイヤーシステム

ホワイトボードの描画は **レイヤーの積み重ね** として構成される。
プラグインは必要なレイヤーを登録し、コアが `order` 順に描画する。

### レイヤー構造

```
┌────────────────────────────┐  ← 最前面
│  Overlay Layer (100)       │  カーソル、プレゼンス表示
├────────────────────────────┤
│  Guide Layer (80)          │  スナップガイド、アライメント
├────────────────────────────┤
│  UI Layer (70)             │  選択ハンドル、リサイズグリップ
├────────────────────────────┤
│  Shape Layer (50)          │  シェイプ描画（メインコンテンツ）
├────────────────────────────┤
│  Background Layer (10)     │  グリッド、ドット等の背景
├────────────────────────────┤
│  Base Layer (0)            │  キャンバス背景色
└────────────────────────────┘  ← 最背面
```

### レイヤーAPI

```typescript
interface Layer {
  id: string
  order: number                            // 描画順（小さいほど背面）
  render: (ctx: LayerRenderContext) => React.ReactElement | null
  interactable?: boolean                   // ポインタイベントを受け取るか
}

interface LayerRenderContext {
  viewport: Viewport                       // パン・ズーム状態
  shapes: ReadonlyMap<string, ShapeData>   // 全シェイプデータ
  selection: ReadonlySet<string>           // 選択中のシェイプID
  theme: Theme                             // テーマ設定
}

interface LayerManager {
  register(layer: Layer): void
  unregister(layerId: string): void
  getLayers(): Layer[]                      // order順にソート済み
}
```

---

## 3. 統一プラグインインターフェース

### 3.1 基本型

全てのプラグインが共通で持つインターフェース。

```typescript
/**
 * 全プラグイン共通の基本型
 */
interface UsketchPlugin {
  /** プラグインの一意識別子（例: "usketch-plugin-shape-rect"） */
  id: string

  /** 表示名 */
  name: string

  /** プラグイン種別 */
  type: 'tool' | 'shape' | 'background' | 'feature'

  /** プラグインの設定スキーマ（Zod） */
  configSchema?: z.ZodType

  /** プラグイン初期化 */
  setup(ctx: PluginContext): void | Promise<void>

  /** プラグイン破棄 */
  teardown?(): void
}

/**
 * プラグインが利用できるコンテキスト
 */
interface PluginContext {
  store: BoardStore                        // 状態管理
  layers: LayerManager                     // レイヤー登録
  tools: ToolRegistry                      // ツール登録
  shapes: ShapeRegistry                    // シェイプ登録
  commands: CommandRegistry                // コマンド登録（undo/redo対応）
  shortcuts: ShortcutRegistry              // キーボードショートカット登録
  events: EventBus                         // プラグイン間イベント通信
}
```

### 3.2 ツールプラグイン

シェイプを持たない汎用ツール（選択、パン等）。

```typescript
interface ToolPlugin extends UsketchPlugin {
  type: 'tool'

  /** XState状態マシン定義 */
  machine: StateMachine

  /** ツールバーに表示するアイコン */
  icon: React.ComponentType

  /** キーボードショートカット（例: "v" で選択ツール） */
  shortcut?: string

  /** ツールバーでの表示順 */
  order?: number
}
```

**例: 選択ツールプラグイン**

```typescript
// plugins/usketch-plugin-tool-select/src/index.ts
import { selectToolMachine } from './machine'
import { SelectIcon } from './icon'

export const selectToolPlugin: ToolPlugin = {
  id: 'usketch-plugin-tool-select',
  name: '選択',
  type: 'tool',
  machine: selectToolMachine,
  icon: SelectIcon,
  shortcut: 'v',
  order: 0,

  setup(ctx) {
    // 選択UIレイヤーを登録
    ctx.layers.register({
      id: 'select-handles',
      order: 70,
      render: (renderCtx) => <SelectionHandles {...renderCtx} />,
      interactable: true,
    })

    // ドラッグ選択レイヤーを登録
    ctx.layers.register({
      id: 'drag-selection',
      order: 75,
      render: (renderCtx) => <DragSelectionBox {...renderCtx} />,
    })

    // コマンド登録
    ctx.commands.register('select-all', selectAllCommand)
    ctx.commands.register('delete-selected', deleteSelectedCommand)

    // ショートカット登録
    ctx.shortcuts.register('Ctrl+A', 'select-all')
    ctx.shortcuts.register('Delete', 'delete-selected')
    ctx.shortcuts.register('Backspace', 'delete-selected')
  },
}
```

### 3.3 シェイププラグイン

**シェイプ定義 + それを作成するツールを1パッケージにバンドル**。
ツールが不要なシェイプ（例: APIから生成されるシェイプ）は `tool` を省略可能。

```typescript
interface ShapePlugin extends UsketchPlugin {
  type: 'shape'

  /** シェイプデータのZodスキーマ（ランタイム検証） */
  dataSchema: z.ZodType<ShapeData>

  /** シェイプの描画 */
  render: (data: ShapeData) => React.ReactElement

  /** バウンディングボックス算出 */
  getBounds: (data: ShapeData) => BoundingBox

  /** ヒットテスト */
  hitTest: (data: ShapeData, point: Point) => boolean

  /** リサイズ処理 */
  resize: (data: ShapeData, handle: ResizeHandle, delta: Point) => ShapeData

  /** デフォルト値での新規シェイプ生成 */
  createDefault: (params: { id: string; x: number; y: number }) => ShapeData

  /** このシェイプを作成するツール（オプション） */
  tool?: {
    machine: StateMachine
    icon: React.ComponentType
    shortcut?: string
    order?: number
  }

  /** プロパティパネルUI（オプション） */
  propertyPanel?: React.ComponentType<{ data: ShapeData; onChange: (data: ShapeData) => void }>
}
```

**例: 矩形シェイプ+ツールプラグイン**

```typescript
// plugins/usketch-plugin-shape-rect/src/index.ts
import { z } from 'zod'
import { rectDrawMachine } from './machine'
import { RectIcon } from './icon'
import { RectRenderer } from './renderer'
import { RectPropertyPanel } from './property-panel'

const rectDataSchema = z.object({
  id: z.string(),
  type: z.literal('rectangle'),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  style: shapeStyleSchema,
  cornerRadius: z.number().default(0),
})

type RectData = z.infer<typeof rectDataSchema>

export const rectPlugin: ShapePlugin = {
  id: 'usketch-plugin-shape-rect',
  name: '矩形',
  type: 'shape',
  dataSchema: rectDataSchema,

  render: (data) => <RectRenderer data={data} />,

  getBounds: (data) => ({
    x: data.x, y: data.y,
    width: data.width, height: data.height,
  }),

  hitTest: (data, point) =>
    point.x >= data.x && point.x <= data.x + data.width &&
    point.y >= data.y && point.y <= data.y + data.height,

  resize: (data, handle, delta) => resizeRect(data, handle, delta),

  createDefault: ({ id, x, y }) => ({
    id, type: 'rectangle' as const,
    x, y, width: 100, height: 80,
    style: defaultStyle,
    cornerRadius: 0,
  }),

  // ツールをバンドル
  tool: {
    machine: rectDrawMachine,
    icon: RectIcon,
    shortcut: 'r',
    order: 10,
  },

  // プロパティパネルをバンドル
  propertyPanel: RectPropertyPanel,

  setup(ctx) {
    // シェイプをレジストリに登録
    ctx.shapes.register('rectangle', this)
    // ツールをツールバーに登録
    if (this.tool) {
      ctx.tools.register('rectangle-draw', this.tool)
    }
  },
}
```

### 3.4 背景プラグイン

```typescript
interface BackgroundPlugin extends UsketchPlugin {
  type: 'background'

  /** 背景の描画 */
  render: (ctx: BackgroundRenderContext) => React.ReactElement

  /** 設定UIコンポーネント */
  settingsPanel?: React.ComponentType
}

interface BackgroundRenderContext {
  viewport: Viewport
  config: Record<string, unknown>   // プラグイン固有の設定
}
```

**例: グリッド背景プラグイン**

```typescript
// plugins/usketch-plugin-bg-grid/src/index.ts
export const gridBgPlugin: BackgroundPlugin = {
  id: 'usketch-plugin-bg-grid',
  name: 'グリッド',
  type: 'background',

  configSchema: z.object({
    size: z.number().default(20),
    color: z.string().default('#e0e0e0'),
    opacity: z.number().min(0).max(1).default(0.5),
  }),

  render: (ctx) => <GridBackground viewport={ctx.viewport} config={ctx.config} />,

  settingsPanel: GridSettings,

  setup(ctx) {
    ctx.layers.register({
      id: 'bg-grid',
      order: 10,
      render: (renderCtx) => this.render({
        viewport: renderCtx.viewport,
        config: ctx.store.getPluginConfig(this.id),
      }),
    })
  },
}
```

### 3.5 機能プラグイン

横断的な機能拡張（スナップ、エクスポート等）。

```typescript
interface FeaturePlugin extends UsketchPlugin {
  type: 'feature'
}
```

**例: スナッププラグイン**

```typescript
// plugins/usketch-plugin-snap/src/index.ts
export const snapPlugin: FeaturePlugin = {
  id: 'usketch-plugin-snap',
  name: 'スナップ & ガイド',
  type: 'feature',

  setup(ctx) {
    // スナップガイド表示レイヤーを登録
    ctx.layers.register({
      id: 'snap-guides',
      order: 80,
      render: (renderCtx) => <SnapGuides {...renderCtx} />,
    })

    // ツールイベントを購読し、スナップ計算を実行
    ctx.events.on('tool:drag', (event) => {
      const snapped = snapEngine.calculate(event.point, event.shapes)
      ctx.store.setSnapState(snapped)
    })

    ctx.events.on('tool:drag-end', () => {
      ctx.store.clearSnapState()
    })
  },
}
```

---

## 4. プラグイン登録とライフサイクル

### 4.1 アプリケーション初期化

```typescript
// apps/web/src/main.tsx
import { createApp } from '@usketch/core'

// コアプラグイン（MVPに必須）
import { selectToolPlugin } from 'usketch-plugin-tool-select'
import { panToolPlugin } from 'usketch-plugin-tool-pan'
import { rectPlugin } from 'usketch-plugin-shape-rect'
import { ellipsePlugin } from 'usketch-plugin-shape-ellipse'
import { freedrawPlugin } from 'usketch-plugin-shape-freedraw'
import { textPlugin } from 'usketch-plugin-shape-text'
import { gridBgPlugin } from 'usketch-plugin-bg-grid'
import { snapPlugin } from 'usketch-plugin-snap'
import { exportPlugin } from 'usketch-plugin-export'

const app = createApp({
  plugins: [
    // ツール
    selectToolPlugin,
    panToolPlugin,
    // シェイプ（ツール付き）
    rectPlugin,
    ellipsePlugin,
    freedrawPlugin,
    textPlugin,
    // 背景
    gridBgPlugin,
    // 機能
    snapPlugin,
    exportPlugin,
  ],
})

app.mount(document.getElementById('root')!)
```

### 4.2 ライフサイクル

```
createApp({ plugins })
  │
  ├─ 1. PluginRegistry にプラグインを登録
  │
  ├─ 2. 各プラグインの setup(ctx) を呼び出し
  │     ├─ レイヤー登録
  │     ├─ ツール登録
  │     ├─ シェイプ登録
  │     ├─ コマンド登録
  │     └─ イベント購読
  │
  ├─ 3. React ツリーのマウント
  │     ├─ Canvas コンポーネント
  │     │   └─ レイヤーを order 順に描画
  │     ├─ Toolbar（登録されたツールを表示）
  │     └─ PropertyPanel（選択シェイプに応じたパネル表示）
  │
  └─ [アンマウント時]
      └─ 各プラグインの teardown() を呼び出し
```

### 4.3 動的ロード（将来対応）

```typescript
// 将来的にはプラグインの動的ロードにも対応
const app = createApp({
  plugins: [
    selectToolPlugin,
    panToolPlugin,
    // 重いプラグインは動的ロード
    () => import('usketch-plugin-shape-rect'),
    () => import('usketch-plugin-export'),
  ],
})
```

---

## 5. プラグイン間通信

プラグイン間は `EventBus` を介して疎結合に通信する。

```typescript
interface EventBus {
  on<T>(event: string, handler: (data: T) => void): () => void
  emit<T>(event: string, data: T): void
}

// 標準イベント
type CoreEvents = {
  'tool:activate': { toolId: string }
  'tool:deactivate': { toolId: string }
  'tool:drag': { point: Point; shapes: ShapeData[] }
  'tool:drag-end': { point: Point }
  'shape:created': { shape: ShapeData }
  'shape:updated': { shape: ShapeData; prev: ShapeData }
  'shape:deleted': { shapeId: string }
  'selection:changed': { selected: string[] }
  'viewport:changed': { viewport: Viewport }
}
```

---

## 6. 命名規則

| 種別 | パッケージ名パターン | 例 |
|------|---------------------|-----|
| ツールプラグイン | `usketch-plugin-tool-{name}` | `usketch-plugin-tool-select` |
| シェイププラグイン | `usketch-plugin-shape-{name}` | `usketch-plugin-shape-rect` |
| 背景プラグイン | `usketch-plugin-bg-{name}` | `usketch-plugin-bg-grid` |
| 機能プラグイン | `usketch-plugin-{name}` | `usketch-plugin-snap` |

npmスコープ: `@usketch/plugin-tool-select` 等でも可（モノレポ内では短い名前を使用）。

---

## 7. サードパーティプラグイン（将来構想）

```typescript
// ユーザーが独自プラグインを作成
// npm install usketch-plugin-shape-diamond

import { diamondPlugin } from 'usketch-plugin-shape-diamond'

const app = createApp({
  plugins: [
    ...corePlugins,
    diamondPlugin,  // サードパーティプラグインをそのまま追加
  ],
})
```

**公開プラグインに必要なもの**:
- `UsketchPlugin` インターフェースの実装
- Zodスキーマによるデータ検証
- `package.json` の `usketch-plugin` フィールド（メタデータ）

---

## 8. まとめ

| 設計判断 | 理由 |
|----------|------|
| 統一 `UsketchPlugin` 型 | ツール/シェイプ/背景/機能の境界を曖昧にせず、同じAPIで扱える |
| shapeプラグインにtoolをバンドル | 「矩形」という概念は「矩形データ」+「矩形を描くツール」で完結すべき |
| 背景をプラグイン化 | コアから分離することで、不要な背景をバンドルから除外できる |
| レイヤーベース描画 | プラグインが描画に参加する明確な仕組み。order値で描画順を制御 |
| EventBus | プラグイン間の疎結合な通信。スナップがツールの動きを監視する等のユースケース |
| Zodスキーマ必須 | プラグインデータのランタイム検証。CRDT同期時のデータ整合性保証 |
