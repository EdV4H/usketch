# @edv4h/usketch-plugin-server-ai

## 1.3.0

### Minor Changes

- 1cd5107: マルチページ PR3a: AI とサムネイルをページ対応。
  
  - `@edv4h/usketch-plugin-ai-agent`: `pageId` オプションを追加。ページを使うボードでは、AI の配置・更新をこのページに書く。
  - `@edv4h/usketch-plugin-server-ai`: `/api/ai/complete` が `pageId`（省略可）を受け取り、BoardRoom に渡す。
  - `@edv4h/usketch-plugin-server-boards`: 公開サムネイルが `?page=` を受け取る（省略時は先頭ページ）。
  
  ページを使わないボード（`meta.pagesVersion` が無い）はこれまでどおりルート doc の `shapes` を読み書きする。

## 1.2.0

### Minor Changes

- c158b98: 音声メモプラグイン `usketch-plugin-voice-notes` を追加。マイクで話した内容を文字起こしし、AI で要約して**まとめ Frame** を起こす（Notion の AI Meeting Notes に着想）。
  - **モジュラブルな文字起こし**: `Transcriber` インターフェース（差し替え可能）。実装は2つ — ブラウザ Web Speech API（continuous 蓄積、ライブ表示あり）と **サーバ Whisper**（`createWhisperTranscriber`: MediaRecorder→`POST /api/ai/transcribe`→OpenAI Whisper）。Web Speech は音声を Google に送るため `network` エラーで使えない環境が多く、apps/web では **Whisper を既定**に採用（Google 非経由・マイク点滅なし・停止後にまとめて変換）。サーバに公開ルート `POST /api/ai/transcribe`（`registerTranscribeRoute`、既存 `OPENAI_API_KEY` 使用、25MB 上限、board アクセス制御）を追加。
  - **AI 要約**: 蓄積した transcript をサーバの OpenAI 互換プロキシ `/api/ai/openui`（キーはサーバ側）に送り、要点ノード＋関連の構造化 JSON を取得。
  - **まとめ Frame**: 生の文字起こしは `frame.meta.transcript` に保存（source of truth）。可視内容は要点を GeoShape（ラベル付き角丸）＋ connector で配置した「まとめの図」。要約失敗時は markdown で全文フォールバック。生成は 1 undo ステップ、通常のシェイプ同期で全クライアントへ。
  - Control HUD（group "Voice Notes"）: 録音/停止トグル＋選択メモの再要約。録音中/要約中は画面下部にインジケータ。
  - **録音フレーム（`voice-frame` シェイプ）**: キャンバスに配置できるインタラクティブなフレーム。シェイプ上の ▶ 録音開始 / ⏹ 停止で操作し、停止すると**そのフレーム自身の中に**要約図を起こす（生 transcript は自身の meta）。ヘッダから再録音/再要約。録音状態はシェイプに同期され、他参加者にも「録音中」が見える（マイクを持つ本人のみ停止可）。専用の描画ツールで配置。
  - **録音ピン（`voice-pin` ツール／シェイプ）**: pin ツールでキャンバスをクリックすると位置にピンを刺して**即録音開始**。ピンは録音が終わるまで残り、ピンをクリックで停止。停止後にピンの位置へ**まとめのShape（要約図）と文字起こし要約の Markdown** を設置してピンは消える（wevox の pins プラグインの click-to-place 作法を参考）。
  - 全エントリポイント（HUD / フレーム / ピン）は**単一の録音コントローラ（Recorder）**を共有し、マイクは同時に1つだけ。
  - **見た目のカスタマイズ**: `createVoiceNotesPlugin({ appearance })` で pin（サイズ/録音・処理中・エラー色）、frame（塗り/枠/ヘッダ色/既定タイトル）、要約ノード（塗り/枠/フォント）、コネクタ、Markdown の見た目を差し替え可能。未指定は既定値（`resolveAppearance` で1階層マージ）。`VoiceNotesAppearance` を export。

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
