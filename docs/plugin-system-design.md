# uSketch v2 プラグインシステム設計書

**作成日**: 2026-03-14
**ステータス**: 設計段階

---

## 1. 概要

uSketch v2では、**全ての描画機能をプラグインとして実装**する。
コアフレームワークはプラグインAPI + レイヤーシステム + 一時オブジェクト管理（TransientRegistry）を提供し、具体的な機能（ツール、シェイプ、背景、エクスポート等）は全てプラグインパッケージとして分離する。

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
│  Transient Layer (90)      │  コア組み込み: カーソル、リップル、リアクション等
├────────────────────────────┤
│  Guide Layer (80)          │  プラグイン: スナップガイド、アライメント
├────────────────────────────┤
│  UI Layer (70)             │  プラグイン: 選択ハンドル、リサイズグリップ
├────────────────────────────┤
│  Shape Layer (50)          │  コア: シェイプ描画（メインコンテンツ）
├────────────────────────────┤
│  Background Layer (10)     │  プラグイン: グリッド、ドット等の背景
├────────────────────────────┤
│  Base Layer (0)            │  コア: キャンバス背景色
└────────────────────────────┘  ← 最背面
```

**Transient Layer** はコア組み込みのレイヤーで、一時的・非永続的なオブジェクト（カーソル、エフェクト、リアクション等）を描画する。詳細は [セクション6: 一時オブジェクトシステム](#6-一時オブジェクトシステムtransient) を参照。

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

### プラグイン UI の提供方針

**プラグインは独自の UI シェルを実装しない。UI は必ず HUD に登録する。**

| 提供したいもの | 登録先 |
| --- | --- |
| 操作（ボタン相当） | `ctx.actions.register` — `PluginAction` |
| 設定値（ライブに読み書きする値） | `ctx.hud.registerSettings` — `HudSettingsDescriptor` |
| 選択に追従するコンテキストUI | `ctx.hud.registerContextual` — **未実装**。それまでは actions / settings で代替する |
| 計測値などの独自表示 | `ctx.hud.registerPanel` — `HudPanel` |

`ctx.layers.register({ fixed: true })` に React コンポーネントを載せて、独自のツールバー・プロパティバー・パネルを描くことは**禁止**する。

対象外（従来どおりレイヤー登録でよいもの）:

- 背景（グリッド、ドット）、ガイド、オーバーレイなど**キャンバスそのものの描画**
- ワールド座標に紐づく装飾（コネクタのハンドル、スナップガイド等）

境界は「ワールドを描いているか / コントロールを置いているか」。ページの上に浮かぶコントロールは HUD、キャンバスの一部として描かれるものはレイヤー。

### 操作ロジックは HUD ハンドラに埋めない（ホストから駆動可能にする）

UI は HUD に集約するが、**HUD の `set` / action の `run` クロージャに操作ロジックを書いてはいけない**。ロジックは「`BoardStore` を受け取る純関数」または「module-scope の reactive store」として実装し、**最初から公開 export** する。HUD ハンドラはそれを呼ぶだけの薄い層にする。

理由: HUD は UI の1消費者にすぎない。ホストは独自 UI（ActionRing / ラジアル / 独自ツールバー）やプログラムから操作したいことがあり、ロジックがクロージャに閉じていると再実装を強いられる（#927 tool-state, #946 無限地形はこの後追い対応だった）。

**レジストリは既にホストから到達可能**: `createApp()` が返す `AppInstance` は `app.actions` / `app.hud` / `app.services` をそのまま公開する（全プラグイン横断の singleton、`packages/core/src/create-app.ts`）。`app.actions.get(id).run(args)` や `app.hud.getSettings()` の descriptor `.set(name,value)` でどのプラグインの操作も駆動できる。ただしこれらは stringly-typed で discoverable でない。

**型付きのホスト向け API は `defineService` シームで公開する**（推奨・標準）:

1. 操作を素の関数として実装（例: `enableInfiniteTerrain(store, opts)`）。
2. それらを API オブジェクトに束ね、`ctx.services` に provide する。
   ```ts
   // xxx-service.ts
   import { defineService, type ServiceRegistry, type BoardStore } from "@edv4h/usketch-shared";
   export interface XxxApi { doThing(): void; /* ... */ }
   export const xxxService = defineService<XxxApi>("usketch-plugin-xxx"); // key はプラグイン id
   export function createXxxApi(store: BoardStore): XxxApi { return { doThing: () => op(store) }; }
   export function getXxxApi(services: ServiceRegistry): XxxApi | undefined { return xxxService.get(services); }
   // plugin setup: const off = xxxService.provide(ctx.services, createXxxApi(ctx.store)); // teardown で off()
   ```
3. ホストは `getXxxApi(app.services)?.doThing()` で駆動。プラグイン不在なら `undefined`（optional に扱える）。

`ctx.services` と `app.services` は同一 registry なので、`getXxxApi(services)` は plugin↔plugin でも host↔plugin でも同じアクセサで使える。**参照実装は `usketch-plugin-map` の `map-service.ts`（`mapService` / `getMapApi`）**。

#### なぜ

1. **`order` が手管理のグローバル名前空間になる。** プラグイン同士が番号を取り合い、実際に衝突している（`shape-connector` の labelEditor と `domain-design` のプロパティバーは 82〜84 を手作業で調整している）。HUD に集約すれば、レイヤーの order はコアが持つ1つで済む。
2. **各プラグインが色・影・フォントを再実装する。** 背景色や `boxShadow` をインラインスタイルで直書きすると、テーマもデザイントークンも効かず、バーごとに見た目がずれる。
3. **UI 都合がプラグインのロジックに漏れる。** 「ツールバーが被らないように余白を広げる」といった調整がドメインロジック側の定数として残り、UI を変えたときに壊れる。
4. **キャンバスのイベントと衝突する。** 各プラグインが `pointerdown` の `stopPropagation` などを個別に書くことになり、抜けたものからバグになる。

これらはコアが「殻」（配置・テーマ・z-order・イベント遮断）を所有し、プラグインは「中身」を宣言するだけ、という分担で解消する。

> **既存コードについて**: `fixed: true` レイヤーで UI を描いている箇所が複数残っている。新規実装は上記に従うこと。既存分は `registerContextual` の実装後に個別 Issue で移行する。

---

## 3. 統一プラグインインターフェース

### 3.1 基本型

全てのプラグインが共通で持つインターフェース。

```typescript
/**
 * 全プラグイン共通の基本型
 */
type PluginTeardown = () => void | Promise<void>

interface UsketchPlugin {
  /** プラグインの一意識別子（例: "usketch-plugin-shape-rect"） */
  id: string

  /** 表示名 */
  name: string

  /** プラグイン種別 */
  type: 'tool' | 'shape' | 'background' | 'feature'

  /** プラグインの設定スキーマ（Zod） */
  configSchema?: z.ZodType

  /**
   * プラグイン初期化
   *
   * 戻り値で teardown 関数を返すことで、createApp().destroy() 時に
   * per-instance のクリーンアップを行える。`this` への代入は React StrictMode
   * 下で 2 回目の setup が 1 回目の closure を上書きしてしまうため禁止。
   */
  setup(ctx: PluginContext): PluginTeardown | void | Promise<PluginTeardown | void>
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
  transient: TransientRegistry             // 一時オブジェクト管理（コア組み込み）
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

プラグインは **必ずファクトリ関数で公開する**（`createXxxPlugin()`）。同一 plugin instance が複数の `createApp` に渡されると React StrictMode の二重マウントで teardown closure が破壊されるため、毎回 fresh な instance を返す形に統一する。

```typescript
// plugins/usketch-plugin-tool-select/src/index.ts
import { selectToolMachine } from './machine'
import { SelectIcon } from './icon'

export function createSelectToolPlugin(): ToolPlugin {
  return {
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
      const offSelectAll = ctx.shortcuts.register('Ctrl+A', 'select-all')
      const offDelete = ctx.shortcuts.register('Delete', 'delete-selected')
      const offBackspace = ctx.shortcuts.register('Backspace', 'delete-selected')

      // teardown を return する（this.teardown への代入は禁止）
      return () => {
        offSelectAll()
        offDelete()
        offBackspace()
        ctx.layers.unregister('select-handles')
        ctx.layers.unregister('drag-selection')
      }
    },
  }
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

// コアプラグイン（MVPに必須）— 全て factory 関数として import
import { createSelectToolPlugin } from 'usketch-plugin-tool-select'
import { createPanToolPlugin } from 'usketch-plugin-tool-pan'
import { createBasicShapePlugin } from 'usketch-plugin-shape-basic'
import { createTextPlugin } from 'usketch-plugin-shape-text'
import { createGridBgPlugin } from 'usketch-plugin-bg-grid'
import { createSnapPlugin } from 'usketch-plugin-snap'
import { createExportPlugin } from 'usketch-plugin-export'

// 重要: plugin 配列は useEffect 等の per-mount スコープで毎回組み立てる
// （モジュールトップで const にすると StrictMode 二重マウントで instance が共有され危険）
useEffect(() => {
  let app: AppInstance | null = null
  let cancelled = false

  createApp({
    plugins: [
      // ツール
      createSelectToolPlugin(),
      createPanToolPlugin(),
      // シェイプ
      createBasicShapePlugin(),
      createTextPlugin(),
      // 背景
      createGridBgPlugin(),
      // 機能
      createSnapPlugin(),
      createExportPlugin(),
    ],
  }).then((instance) => {
    if (cancelled) {
      instance.destroy()
      return
    }
    app = instance
  })

  return () => {
    cancelled = true
    app?.destroy()
  }
}, [])
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
  │     ├─ イベント購読
  │     └─ setup の戻り値 (teardown 関数) を per-instance に蓄積
  │
  ├─ 3. React ツリーのマウント
  │     ├─ Canvas コンポーネント
  │     │   └─ レイヤーを order 順に描画
  │     ├─ Toolbar（登録されたツールを表示）
  │     └─ PropertyPanel（選択シェイプに応じたパネル表示）
  │
  └─ [destroy() 時 / アンマウント時]
      ├─ destroyed フラグで idempotent 化 (2 回目以降の destroy() は no-op)
      └─ 蓄積された teardown を LIFO 順 (逆順) で実行
```

> setup が throw した場合、それまでに収集した teardown を LIFO 順でロールバック実行する（partial set-up を leak させない）。

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

## 6. 一時オブジェクトシステム（Transient）

### 6.1 概要

コラボレーションツールにおいて、**一時的に表示され、永続化されず、編集不可能なオブジェクト**はコアの関心事である。v1ではこれを「エフェクト」と呼んでいたが、実際にはより広い概念。

| 例 | 特性 |
|----|------|
| カーソル・プレゼンス | 接続中のみ表示 |
| リップルエフェクト | 数秒で自動消滅 |
| ピンエフェクト | 手動で消すまで表示 |
| リアクション（絵文字） | 数秒で自動消滅 |
| レーザーポインター | 軌跡が徐々に消える |
| 「入力中...」インジケータ | 状態に連動して消滅 |

**共通する特性**:
- Yjsドキュメント（永続データ）に**保存しない**
- Undo/Redoの対象**ではない**
- 選択・移動・リサイズ**できない**
- 他のユーザーに**伝播する**（Yjs Awarenessチャネル経由）
- 一定時間経過やイベントで**自動消滅する**

### 6.2 データの性質による分類

```
┌────────────────────────────────────────┐
│  Persistent（永続）     Transient（一時） │
│  ┌──────────────┐    ┌──────────────┐  │
│  │ シェイプ       │    │ カーソル       │  │
│  │ レイヤー順序    │    │ プレゼンス     │  │
│  │ スタイル       │    │ リップル       │  │
│  │ ボード設定     │    │ ピン          │  │
│  │              │    │ レーザー       │  │
│  │ → Yjs Doc    │    │ リアクション    │  │
│  │ → Undo/Redo  │    │              │  │
│  │ → IndexedDB  │    │ → Awareness  │  │
│  │              │    │ → 自動消滅     │  │
│  │              │    │ → 編集不可     │  │
│  └──────────────┘    └──────────────┘  │
└────────────────────────────────────────┘
```

### 6.3 TransientRegistry API

コアが提供する一時オブジェクトの管理API。

```typescript
interface TransientRegistry {
  /** 一時オブジェクトの種別を登録（プラグインがレンダラーを提供） */
  registerType(type: string, renderer: TransientRenderer): void

  /** 一時オブジェクトを表示（他ユーザーにも伝播） */
  emit(obj: TransientObject): void

  /** 一時オブジェクトを削除 */
  dismiss(id: string): void

  /** 現在表示中の一時オブジェクト一覧 */
  getAll(): ReadonlyMap<string, TransientObject>
}

interface TransientObject {
  id: string
  type: string                    // 登録された種別（"cursor", "ripple", "reaction" 等）
  sourceUserId: string            // 発信元ユーザー
  position: Point                 // 表示位置
  data: Record<string, unknown>   // 種別固有のデータ
  ttl?: number                    // 自動消滅までのms（省略 = 手動消滅）
  createdAt: number
}

interface TransientRenderer {
  render: (obj: TransientObject, ctx: LayerRenderContext) => React.ReactElement
}
```

### 6.4 コア組み込みの Transient Layer

コアが `order: 90` で組み込みレイヤーを管理する。プラグインがレイヤーを登録する必要はない。

```typescript
// core/src/transient-layer.ts（コア内部実装）
const transientLayer: Layer = {
  id: 'transient',
  order: 90,
  render: (renderCtx) => {
    const objects = transientRegistry.getAll()
    return (
      <>
        {[...objects.values()].map(obj => {
          const renderer = transientRegistry.getRenderer(obj.type)
          return renderer ? renderer.render(obj, renderCtx) : null
        })}
      </>
    )
  },
}
```

### 6.5 同期チャネル

一時オブジェクトは **Yjs Awareness Protocol** で同期する。Yjsドキュメントとは別チャネル。

```
TransientObject
  → Yjs Awareness (local state)
  → WebSocket
  → Durable Object
  → 他クライアントの Awareness
  → TransientRegistry.getAll() で描画

TTL経過 → TransientRegistry が自動削除 → 再描画で消滅
```

### 6.6 プラグインでの利用例

**リップルエフェクトプラグイン**:

```typescript
// plugins/usketch-plugin-effect-ripple/src/index.ts
export const ripplePlugin: FeaturePlugin = {
  id: 'usketch-plugin-effect-ripple',
  name: 'リップル',
  type: 'feature',

  setup(ctx) {
    // 一時オブジェクトの種別をコアに登録
    ctx.transient.registerType('ripple', {
      render: (obj, renderCtx) => (
        <RippleAnimation
          position={obj.position}
          color={obj.data.color as string}
          startTime={obj.createdAt}
        />
      ),
    })

    // ダブルクリックでリップルを発信
    ctx.events.on('canvas:dblclick', (event) => {
      ctx.transient.emit({
        id: nanoid(),
        type: 'ripple',
        sourceUserId: ctx.store.currentUserId,
        position: event.point,
        data: { color: ctx.store.currentUserColor },
        ttl: 2000,
        createdAt: Date.now(),
      })
    })
  },
}
```

**リアクションプラグイン**:

```typescript
// plugins/usketch-plugin-reaction/src/index.ts
export const reactionPlugin: FeaturePlugin = {
  id: 'usketch-plugin-reaction',
  name: 'リアクション',
  type: 'feature',

  setup(ctx) {
    ctx.transient.registerType('reaction', {
      render: (obj) => (
        <FloatingEmoji
          emoji={obj.data.emoji as string}
          position={obj.position}
          userName={obj.data.userName as string}
        />
      ),
    })

    ctx.commands.register('send-reaction', (emoji: string) => {
      ctx.transient.emit({
        id: nanoid(),
        type: 'reaction',
        sourceUserId: ctx.store.currentUserId,
        position: ctx.store.viewport.center,
        data: {
          emoji,
          userName: ctx.store.currentUserName,
        },
        ttl: 3000,
        createdAt: Date.now(),
      })
    })
  },
}
```

**カーソル・プレゼンス（コア組み込み）**:

```typescript
// core/src/presence.ts（コア内部で登録）
transientRegistry.registerType('cursor', {
  render: (obj) => (
    <UserCursor
      position={obj.position}
      userName={obj.data.name as string}
      color={obj.data.color as string}
    />
  ),
})

// ポインタ移動のたびに自身のカーソルを更新
canvas.on('pointermove', (event) => {
  transientRegistry.emit({
    id: `cursor-${currentUserId}`,
    type: 'cursor',
    sourceUserId: currentUserId,
    position: event.worldPoint,
    data: { name: currentUserName, color: currentUserColor },
    // ttl なし = 手動管理（接続切断時に消える）
    createdAt: Date.now(),
  })
})
```

### 6.7 設計判断

| 判断 | 理由 |
|------|------|
| コア組み込み | コラボレーションツールの基本機能。カーソル、リアクション、エフェクトは全てこの仕組みの上に乗る |
| Yjs Awareness で同期 | Yjsドキュメント（永続データ）を汚さない。プレゼンス情報と同じチャネルで自然 |
| 単一レイヤー（order: 90） | 複数の一時オブジェクト種別が同じレイヤーで合成される。order競合問題が発生しない |
| TTLによる自動消滅 | コアが保証するので、プラグインがタイマー管理を自前実装する必要がない |
| `registerType` + `emit` の分離 | 種別の定義（レンダラー登録）と発信（オブジェクト生成）を分離。異なるプラグインが同じ種別を発信することも可能 |

---

## 7. 命名規則


| 種別 | パッケージ名パターン | 例 |
|------|---------------------|-----|
| ツールプラグイン | `usketch-plugin-tool-{name}` | `usketch-plugin-tool-select` |
| シェイププラグイン | `usketch-plugin-shape-{name}` | `usketch-plugin-shape-rect` |
| 背景プラグイン | `usketch-plugin-bg-{name}` | `usketch-plugin-bg-grid` |
| 機能プラグイン | `usketch-plugin-{name}` | `usketch-plugin-snap` |

npmスコープ: `@usketch/plugin-tool-select` 等でも可（モノレポ内では短い名前を使用）。

---

## 8. サードパーティプラグイン（将来構想）

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

## 9. まとめ

| 設計判断 | 理由 |
|----------|------|
| 統一 `UsketchPlugin` 型 | ツール/シェイプ/背景/機能の境界を曖昧にせず、同じAPIで扱える |
| shapeプラグインにtoolをバンドル | 「矩形」という概念は「矩形データ」+「矩形を描くツール」で完結すべき |
| 背景をプラグイン化 | コアから分離することで、不要な背景をバンドルから除外できる |
| レイヤーベース描画 | プラグインが描画に参加する明確な仕組み。order値で描画順を制御 |
| EventBus | プラグイン間の疎結合な通信。スナップがツールの動きを監視する等のユースケース |
| Zodスキーマ必須 | プラグインデータのランタイム検証。CRDT同期時のデータ整合性保証 |
| TransientRegistry（コア組み込み） | カーソル、エフェクト、リアクション等の一時オブジェクトはコラボレーションの基本機能。Yjs Awarenessで同期、TTLで自動消滅 |
