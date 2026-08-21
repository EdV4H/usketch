# @edv4h/usketch-plugin-tool-openui

## 1.1.7

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-canvas-engine@1.4.0
  - @edv4h/usketch-shared@4.12.0
  - @edv4h/usketch-store@3.5.4
  - @edv4h/usketch-plugin-export@2.1.7
  - @edv4h/usketch-plugin-shape-openui@1.0.13

## 1.1.6

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-canvas-engine@1.3.5
  - @edv4h/usketch-store@3.5.3
  - @edv4h/usketch-plugin-export@2.1.6
  - @edv4h/usketch-plugin-shape-openui@1.0.12

## 1.1.5

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-canvas-engine@1.3.4
  - @edv4h/usketch-store@3.5.2
  - @edv4h/usketch-plugin-export@2.1.5
  - @edv4h/usketch-plugin-shape-openui@1.0.11

## 1.1.4

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-canvas-engine@1.3.3
  - @edv4h/usketch-store@3.5.1
  - @edv4h/usketch-plugin-export@2.1.4
  - @edv4h/usketch-plugin-shape-openui@1.0.10

## 1.1.3

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-store@3.5.0
  - @edv4h/usketch-canvas-engine@1.3.2
  - @edv4h/usketch-plugin-export@2.1.3
  - @edv4h/usketch-plugin-shape-openui@1.0.9

## 1.1.2

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-canvas-engine@1.3.1
  - @edv4h/usketch-store@3.4.1
  - @edv4h/usketch-plugin-export@2.1.2
  - @edv4h/usketch-plugin-shape-openui@1.0.8

## 1.1.1

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-store@3.4.0
  - @edv4h/usketch-canvas-engine@1.3.0
  - @edv4h/usketch-plugin-export@2.1.1
  - @edv4h/usketch-plugin-shape-openui@1.0.7

## 1.1.0

### Minor Changes

- c295652: Make Real の選択追従フローティングボタン（`openui-make-real` fixed レイヤー）を撤去し、Control HUD の **AI** グループの Action `openui:make-real` に統合。`isEnabled` は「非 openui の shape を選択中」で、実行時に選択範囲を PNG スナップショットして vision リクエストを送る挙動は不変。ホストアプリに追従 UI を足さなくても Control HUD だけで実行できる。

### Patch Changes

- Updated dependencies [a65da25]
- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-plugin-export@2.1.0
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-canvas-engine@1.2.1
  - @edv4h/usketch-store@3.3.1
  - @edv4h/usketch-plugin-shape-openui@1.0.6

## 1.0.5

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0
  - @edv4h/usketch-store@3.3.0
  - @edv4h/usketch-canvas-engine@1.2.0
  - @edv4h/usketch-plugin-export@2.0.5
  - @edv4h/usketch-plugin-shape-openui@1.0.5

## 1.0.4

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0
  - @edv4h/usketch-store@3.2.0
  - @edv4h/usketch-canvas-engine@1.1.5
  - @edv4h/usketch-plugin-export@2.0.4
  - @edv4h/usketch-plugin-shape-openui@1.0.4

## 1.0.3

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0
  - @edv4h/usketch-store@3.1.0
  - @edv4h/usketch-canvas-engine@1.1.4
  - @edv4h/usketch-plugin-export@2.0.3
  - @edv4h/usketch-plugin-shape-openui@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0
  - @edv4h/usketch-canvas-engine@1.1.3
  - @edv4h/usketch-store@3.0.1
  - @edv4h/usketch-plugin-export@2.0.2
  - @edv4h/usketch-plugin-shape-openui@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0
  - @edv4h/usketch-store@3.0.0
  - @edv4h/usketch-canvas-engine@1.1.2
  - @edv4h/usketch-plugin-export@2.0.1
  - @edv4h/usketch-plugin-shape-openui@1.0.1

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
  - @edv4h/usketch-plugin-export@2.0.0
  - @edv4h/usketch-plugin-shape-openui@1.0.0
  - @edv4h/usketch-canvas-engine@1.1.1
  - @edv4h/usketch-store@2.0.1

## 0.2.0

### Minor Changes

- 6a06178: OpenUI: make production-deployable via a server-side proxy.
  - `@edv4h/usketch-plugin-tool-openui` adds `createServerProxyProvider`, which routes LLM calls through your own `/api/ai/openui` endpoint with cookie-based auth (`credentials: "include"`). The existing OpenAI-compatible provider also gains an opt-in `credentials` option.
  - `@edv4h/usketch-plugin-server-ai` adds `registerOpenUIRoute` (mounted at `POST /api/ai/openui`), an OpenAI-compatible Chat Completions proxy that reuses the worker's `OPENAI_API_KEY` secret, enforces board access control when `?boardId=...` is supplied, and streams SSE pass-through.

  `apps/web` now uses `createServerProxyProvider` exclusively, so the OpenAI API key no longer ships in the browser bundle.

### Patch Changes

- 0eb5a50: ✨ OpenUI Generative UI ウィジェットプラグインを追加 (experimental, requires @openuidev/\* 0.2.x):
  - `usketch-plugin-shape-openui`: `openui` shape を `@openuidev/react-lang` の `<Renderer>` でマウント。Zod schema 駆動の library に対して validate された OpenUI Lang のみが render される。
  - `usketch-plugin-tool-openui`: toolbar tool + side-panel prompt UI + 選択上の「Make Real」ボタン (`@edv4h/usketch-plugin-export` の `exportCanvas` で PNG snapshot)。OpenAI 直接と OpenAI 互換 endpoint (Azure / Ollama / LiteLLM / OpenUI server) の 2 provider。
  - デフォルト library に 12 汎用 component (Stack / Heading / Text / Card / Button / Input / Badge / Avatar / Image / List / Row / Spacer) を同梱、host が `defineComponent` + `createLibrary` でブランド component を追加可能。
  - `apps/web` に統合 (default: `http://localhost:7878/v1`、`VITE_OPENUI_PROVIDER=openai` で OpenAI 直叩き)。

- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [0eb5a50]
- Updated dependencies [f8fee37]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-shared@2.0.0
  - @edv4h/usketch-canvas-engine@1.1.0
  - @edv4h/usketch-plugin-shape-openui@0.1.1
  - @edv4h/usketch-store@2.0.0
  - @edv4h/usketch-plugin-export@1.0.1
