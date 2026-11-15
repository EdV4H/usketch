# @edv4h/usketch-sync

## 1.5.0

### Minor Changes

- 77babb1: マルチページ: 履歴をページ対応
  
  - `@edv4h/usketch-shared`: `HistoryCommit.layout` を追加。`"pages"` のコミットは tree がページ（pageId → そのページの tree）で並ぶ。無いコミット（今までのもの）はハッシュも中身も変わらない
  - `@edv4h/usketch-sync`: `LEGACY_PAGE_ID_KEY` と `getLegacyPageId(root)` を追加。ページ形式にする前の中身が移ったページ（記録が無ければ先頭ページ）
- 572a76b: マルチページ: 既存ボードの移行関数を追加
  
  ページ形式にする前のボード（ルート doc の `shapes`）を、1 枚目のページ doc へ移す純関数。自前のサーバーを持つ利用先も、自分のサーバーで同じ手順を使える。
  
  - `needsPagesMigration(root)`: 移行が要るボードか（`meta.pagesVersion` が無い）
  - `copyRootShapesToPage(root, pageDoc)`: 手順 1。ルートの `shapes` を 1 枚目のページ doc へ写す（ルートは変えない）
  - `finishPagesMigration(root, pageDoc, { pageId, name? })`: 手順 2。ページ doc を保存してから呼ぶ。ルートに 1 枚目と版・`meta.legacyPageId` を書き、写し終えたシェイプをルートから消す
  - `moveRootShapesToPage(root, pageDoc)`: 移行後にルートへ書かれたシェイプ（古いクライアントなど）を 1 枚目へ移す
  - `checkPagesMigration(before, root, pageDoc)`: 移行前のシェイプが全部 1 枚目に同じ中身であり、ルートが空かを確かめる
  - `countRootShapes(root)`、`DEFAULT_FIRST_PAGE_NAME`
  
  移行の手順（自前のサーバーを持つ利用先向け）: https://edv4h.github.io/usketch/docs/ja/guides/multi-page-migration/
- 3c434bc: マルチページ: ページの操作と pages プラグイン
  
  - `@edv4h/usketch-sync`: `renamePage` / `reorderPage` / `deletePage`（印を付けるだけ、最後の 1 枚は消せない）/ `restorePage` を追加
  - `@edv4h/usketch-plugin-pages`（新規）: HUD のページパネル（一覧・切り替え・追加・名前変更・並べ替え・複製・削除・復元）、`getPagesApi`、アクションとキー（`Alt+PageDown` / `Alt+PageUp`）

## 1.4.0

### Minor Changes

- eb20881: マルチページのクライアント基盤（マルチページ PR2）。
  
  - `@edv4h/usketch-sync`: ルート doc の `pages` / `meta.pagesVersion` を扱う純関数（`listPages`・`createPage`・`initPagedBoard`・`isPagedBoard`・`resolvePageId`・`observePages` など）、ページ doc を手元保存とサーバー購読つきで開き直前のページを残す `createPageDocManager`、同じページの人だけを見せる awareness / broadcast の包み `createPageScopedProvider` を追加。
  - `@edv4h/usketch-plugin-sync-localstorage-yjs`: `createYjsSync` に `persist: false`（保存はホストが持ち、doc の中身をすぐ store に入れる）を追加し、doc を IndexedDB に保存するだけの `persistDocToIndexedDb` を公開。
  
  `meta.pagesVersion` の無いボードはこれまでどおりルート doc の `shapes` を使う。
- fff9073: ルート doc とは別の Y.Doc（ページ doc）を同じ WebSocket で同期できるようにした（マルチページの土台）。`WsProviderHandle.subscribeDoc(docId, doc)` で購読すると、state vector で差分だけを受け取り、ローカルの編集は `DOC_UPDATE` で送る。再接続時は自動で購読し直し、切断中の編集はサーバーに足りない分だけ送り返す。メッセージは `MSG_DOC_SUBSCRIBE` / `MSG_DOC_SYNC` / `MSG_DOC_UPDATE` / `MSG_DOC_UNSUBSCRIBE` と `encodeDocFrame` / `decodeDocFrame` / `isValidDocId` を追加。ルート doc 用の既存メッセージは変えていない。

## 1.3.0

### Minor Changes

- 06f3ef8: feat(sync): re-export the Yjs awareness primitives (`Awareness`, `encodeAwarenessUpdate`, `applyAwarenessUpdate`, `removeAwarenessStates`)

  So consumers can publish/apply presence without taking a direct `y-protocols`
  dependency — this package already depends on it and owns the `MSG_AWARENESS`
  message framing. Used by the MCP server to make the AI appear as a presence
  participant (#960).

## 1.2.0

### Minor Changes

- 6a1e9b9: ライブ・セッション基盤（サーバー権限）Phase 1: プロトコル＋サーバー＋クライアント channel

  Canvas 上で他ユーザーに「イベント」を発生させる共有インタラクティブ・セッション（投票/チュートリアル/カードゲーム）の土台。Durable Object をセッションの権威にし、公開状態は全員へ、秘匿状態（誰が何に投票したか等）は本人のみへ配る。途中参加は接続時の state 再送、途中離脱→復帰は userId 単位の猶予（DO alarm）＋再接続で担保、ホスト離脱はホスト移譲。
  - 新パッケージ `@edv4h/usketch-session-protocol`: client↔server 共通の型（メッセージ union・voting の公開/秘匿/config 型）。
  - `@edv4h/usketch-sync`: `MSG_SESSION` フレームと `WsProviderHandle.sendSession`/`onSession` を追加（server が処理する双方向チャネル。broadcast の盲目リレーとは別）。
  - サーバー(apps/server): `SessionManager`（作成/参加/アクション/離脱/締め・presence・猶予/再接続・ホスト移譲・DO alarm・DO storage 永続、純粋クラスで単体テスト可）＋ voting 型（重複回避・secret ballot・再投票差し替え・multi）。board-room に配線。単体テスト12件。

  Phase 2 でクライアントプラグイン（HUD 投票UI）と旧 voting 廃止を行う。

## 1.1.0

### Minor Changes

- 4148a9c: 共有タイマープラグイン `usketch-plugin-timter` を追加（issue #737）。**複数タイマー**を同時に持て、**タイプ**（countdown / stopwatch）を最初から扱える拡張可能設計（`TIMER_KINDS` に足せば新タイプ追加）。タイマーは**単一の実体＝`timer` シェイプ**（配置・移動・リサイズ・選択・undo 可能）で、通常のシェイプ同期に乗って全ユーザーへ同期＋永続化（サーバの同期処理は改修不要、遅参加/リロードでも即再現）。Debug HUD の Controls（group "Timter"）から追加・一覧・各操作（開始/一時停止/リセット/削除）・全削除ができ、キャンバスのツールで置いたタイマーも Controls に出る（同一リストを共有）。

  時刻同期のため `@edv4h/usketch-sync` に `createServerClock`（Cristian's algorithm でサーバ時計オフセットを推定、最小 RTT サンプル採用）を追加。タイマーは終了/開始時刻を**サーバ時計基準**で保存するため、端末の時計ずれに影響されず全員の表示が一致する。solo/オフラインは offset=0 のローカル時計に自動フォールバック。固有 UI は持たず、全操作を `ctx.actions.register` で公開して Debug HUD の Controls（group "Timter"）に統合（追加/全削除＋各タイマーの開始・一時停止/リセット/削除、実行中は1秒ごとにラベル更新）。

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
