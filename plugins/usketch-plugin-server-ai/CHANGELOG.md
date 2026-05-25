# @edv4h/usketch-plugin-server-ai

## 1.1.0

### Minor Changes

- 6a06178: OpenUI: make production-deployable via a server-side proxy.
  - `@edv4h/usketch-plugin-tool-openui` adds `createServerProxyProvider`, which routes LLM calls through your own `/api/ai/openui` endpoint with cookie-based auth (`credentials: "include"`). The existing OpenAI-compatible provider also gains an opt-in `credentials` option.
  - `@edv4h/usketch-plugin-server-ai` adds `registerOpenUIRoute` (mounted at `POST /api/ai/openui`), an OpenAI-compatible Chat Completions proxy that reuses the worker's `OPENAI_API_KEY` secret, enforces board access control when `?boardId=...` is supplied, and streams SSE pass-through.

  `apps/web` now uses `createServerProxyProvider` exclusively, so the OpenAI API key no longer ships in the browser bundle.

## 1.0.0

### Major Changes

- 🎉 Initial stable release — v1.0.0

  uSketch v2 の最初の安定版リリース。MVP 完了基準をすべて満たした状態で公開する。

  ## Highlights
  - **Realtime collaboration** — Cloudflare Durable Objects + Yjs + WebSocket awareness
  - **Offline-first** — y-indexeddb によるローカル永続化、再接続時の自動同期
  - **Pluggable architecture** — 60+ の plugin（shape / tool / sync / AI / presence / export 等）
  - **Presentation mode** — Frame ベースのスライド、edit/present の 2 モード
  - **Export** — PNG / SVG / JSON（Satori + Canvas）
  - **Link sharing & access control** — 公開/限定公開 + role 管理（owner/editor/viewer）
  - **AI-native** — Copilot（ghost shape 提案）/ Chat / Voice / Image 認識

  詳細なリリースノートはルートの `CHANGELOG.md` を参照。

### Patch Changes

- Updated dependencies
  - @edv4h/usketch-server-core@1.0.0
