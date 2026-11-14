# @edv4h/usketch-plugin-shape-openui

## 1.0.26

### Patch Changes

- 5916c16: Shape の 3D をコアのデータにしました（3D 標準対応 P4a、#1473）。絵は変わりません。
  
  - **shared**
    - `ShapeData.view3d`（stand / box / float、高さ、向き、影、当たり判定）を追加
    - 読み書きの純関数（`readShapeView3d`、`resolveShapeView3d`、`storedShapeView3d`、`shapeView3dPatch` など）を追加
    - `ShapeDefinition.view3d`（`modes` / `default` / `render3d`）を追加
    - 次のメジャーまで、書くときは `view3d` と `x-shape-3d` の両方に書きます。読むときは、まだ `x-shape-3d` があればそちらを読みます（古いクライアントはそちらにしか書かないため）
  - **core**: `ctx.shapes.configureView3d(type, view3d)` で、ホストが種別ごとの 3D を上書きできます（`getView3d` / `subscribeView3d` も追加。次のメジャーまで省略可）
  - **shape-3d**: 各種別の宣言とホストの上書きを読みます。`types` オプション・`registerType`・組み込みの表は、まだ宣言していない種別のため次のメジャーまで残します
  - **各 Shape プラグイン**: 自分の 3D を宣言します
    - rectangle・rounded-rect・sticky・card・frame・image は箱にもなれます
    - embed・openui は 3D にしません
- Updated dependencies [4a0ff52]
- Updated dependencies [8ff6829]
- Updated dependencies [1884f5a]
- Updated dependencies [2f8aab7]
- Updated dependencies [1db8c0c]
- Updated dependencies [34232b1]
- Updated dependencies [458decc]
- Updated dependencies [b86508c]
- Updated dependencies [77babb1]
- Updated dependencies [4846cdc]
- Updated dependencies [7b1ec3c]
- Updated dependencies [cf04198]
- Updated dependencies [5916c16]
- Updated dependencies [b41ea96]
- Updated dependencies [d0635ab]
  - @edv4h/usketch-shared@4.25.0

## 1.0.25

### Patch Changes

- Updated dependencies [b16cfe8]
- Updated dependencies [d81aad4]
  - @edv4h/usketch-shared@4.24.0

## 1.0.24

### Patch Changes

- Updated dependencies [55459fd]
  - @edv4h/usketch-shared@4.23.0

## 1.0.23

### Patch Changes

- Updated dependencies [9ffa649]
  - @edv4h/usketch-shared@4.22.0

## 1.0.22

### Patch Changes

- Updated dependencies [abc7f44]
  - @edv4h/usketch-shared@4.21.0

## 1.0.21

### Patch Changes

- Updated dependencies [df6edda]
  - @edv4h/usketch-shared@4.20.0

## 1.0.20

### Patch Changes

- Updated dependencies [2fa13a5]
- Updated dependencies [2fe644e]
  - @edv4h/usketch-shared@4.19.0

## 1.0.19

### Patch Changes

- Updated dependencies [1962032]
- Updated dependencies [8cb3482]
  - @edv4h/usketch-shared@4.18.0

## 1.0.18

### Patch Changes

- Updated dependencies [dc5d8d1]
  - @edv4h/usketch-shared@4.17.0

## 1.0.17

### Patch Changes

- Updated dependencies [bfba838]
  - @edv4h/usketch-shared@4.16.0

## 1.0.16

### Patch Changes

- Updated dependencies [38ca865]
- Updated dependencies [b71dd10]
  - @edv4h/usketch-shared@4.15.0

## 1.0.15

### Patch Changes

- Updated dependencies [fa69bfb]
- Updated dependencies [f4b7387]
  - @edv4h/usketch-shared@4.14.0

## 1.0.14

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0

## 1.0.13

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0

## 1.0.12

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0

## 1.0.11

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0

## 1.0.10

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0

## 1.0.9

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0

## 1.0.8

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0

## 1.0.7

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0

## 1.0.6

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0

## 1.0.5

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0

## 1.0.4

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0

## 1.0.3

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0

## 1.0.2

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0

## 1.0.1

### Patch Changes

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0

## 1.0.0

### Major Changes

- ee6fc3e: **BREAKING**: Plugin lifecycle reworked for React StrictMode safety. Fixes #609.

  `UsketchPlugin.setup(ctx)` now returns the teardown function directly; the `teardown` property on `UsketchPlugin` has been removed. All plugins that previously exported a module-level singleton object (e.g. `selectToolPlugin`, `panToolPlugin`, `gridBgPlugin`) are now factory functions (`createSelectToolPlugin()`, `createPanToolPlugin()`, `createGridBgPlugin()`). Each `createApp` call now owns its own plugin instance and teardown closure, so a second mount cannot overwrite the first's cleanup state.

  `createApp` collects per-instance teardowns and runs them in LIFO order on `destroy()`. `destroy()` is idempotent — repeated calls are no-ops. If a later plugin's `setup` throws, the teardowns collected so far roll back in LIFO order.

  **Migration**:
  1. Replace singleton imports with factory calls at the call site:

     ```diff
     - import { selectToolPlugin, panToolPlugin, gridBgPlugin } from "@edv4h/usketch-plugin-...";
     + import { createSelectToolPlugin, createPanToolPlugin, createGridBgPlugin } from "@edv4h/usketch-plugin-...";

       const app = await createApp({
         store,
     -   plugins: [selectToolPlugin, panToolPlugin, gridBgPlugin],
     +   plugins: [createSelectToolPlugin(), createPanToolPlugin(), createGridBgPlugin()],
       });
     ```

  2. When authoring a custom plugin, return the cleanup from `setup` instead of assigning it to `this.teardown`:
     ```diff
       setup(ctx) {
         const off = ctx.events.on("…", handler);
     -   (this as UsketchPlugin).teardown = () => off();
     +   return () => off();
       },
     - teardown() { … },
     ```
  3. Build plugin arrays inside `useEffect` (or any per-mount scope), not at module level — even with factory functions, sharing a single instance across mounts undoes StrictMode safety.

  Plugins that already shipped as `createXxxPlugin()` (e.g. `createDomRendererPlugin`, `createPresenceCursorPlugin`) keep their factory names; only the `teardown` property has moved to the `setup` return value.

### Patch Changes

- Updated dependencies [ee6fc3e]
  - @edv4h/usketch-shared@3.0.0

## 0.1.1

### Patch Changes

- 0eb5a50: ✨ OpenUI Generative UI ウィジェットプラグインを追加 (experimental, requires @openuidev/\* 0.2.x):
  - `usketch-plugin-shape-openui`: `openui` shape を `@openuidev/react-lang` の `<Renderer>` でマウント。Zod schema 駆動の library に対して validate された OpenUI Lang のみが render される。
  - `usketch-plugin-tool-openui`: toolbar tool + side-panel prompt UI + 選択上の「Make Real」ボタン (`@edv4h/usketch-plugin-export` の `exportCanvas` で PNG snapshot)。OpenAI 直接と OpenAI 互換 endpoint (Azure / Ollama / LiteLLM / OpenUI server) の 2 provider。
  - デフォルト library に 12 汎用 component (Stack / Heading / Text / Card / Button / Input / Badge / Avatar / Image / List / Row / Spacer) を同梱、host が `defineComponent` + `createLibrary` でブランド component を追加可能。
  - `apps/web` に統合 (default: `http://localhost:7878/v1`、`VITE_OPENUI_PROVIDER=openai` で OpenAI 直叩き)。

- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-shared@2.0.0
