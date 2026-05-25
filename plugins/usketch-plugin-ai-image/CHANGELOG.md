# @edv4h/usketch-plugin-ai-image

## 1.1.0

### Minor Changes

- 899b4b2: External Content Handler プラグイン API を追加 (#578)。
  - `ctx.externalContent.register({ id, kind, match, handle, order })` を新設 (`kind: "file" | "url" | "text"`)。
  - 解決ルール: kind フィルタ → match true のうち `order` 最大 1 件のみ実行。同値 last-wins。selection-foreground と同じ意味論。
  - canvas-engine が drop / paste の `DataTransfer` / `ClipboardEvent` を `ExternalContent` に正規化。document scope の paste listener を内部で張る (INPUT/TEXTAREA/contentEditable はスキップ)。
  - 既存 `canvas:drop` event は後方互換のため残置 (新コードは `ctx.externalContent` を推奨)。
  - `usketch-plugin-shape-image` が「画像 file → image shape」の default を `order: 0` で自己登録。
  - `usketch-plugin-ai-image` は drop / paste path を撤去。`image:upload` 経由のファイルピッカーは維持。

  詳細は `guides/external-content` (en/ja) を参照。

### Patch Changes

- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-shared@2.0.0
  - @edv4h/usketch-plugin-ai-agent@2.0.0

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
  - @edv4h/usketch-shared@1.0.0
  - @edv4h/usketch-plugin-ai-agent@1.0.0
