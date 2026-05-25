# @edv4h/usketch-plugin-tool-openui

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
