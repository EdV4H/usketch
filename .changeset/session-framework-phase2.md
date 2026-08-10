---
"@edv4h/usketch-plugin-session": minor
"@edv4h/usketch-session-protocol": patch
"@edv4h/usketch-plugin-voting": patch
---

ライブ・セッション基盤 Phase 2: クライアント投票プラグイン（HUD UI）＋旧 voting 廃止

Phase 1 のサーバー権限セッション基盤を、実際にブラウザで使えるクライアントプラグインとして公開。UUI は方針どおり Control HUD に登録（独自ツールバー/パネルは作らない）。

- 新パッケージ `@edv4h/usketch-plugin-session`: `createSessionPlugin({ wsProvider, userId, boardId })`。
  - `session-client`: `MSG_SESSION` チャネル（`sendSession`/`onSession`）をラップし、公開 `SessionView` と自分の private state をローカルミラー。接続/再接続時に自動 `sync`（途中参加・再接続で現状態へ追従）。サーバーが権威なので UI は intent 送信＋再描画のみ。
  - HUD パネル「セッション」: 投票作成フォーム（質問・最大4選択肢・秘密投票・複数選択、各項目にラベル/placeholder）、進行中投票のライブ tally バー、自分の投票ハイライト。
  - host の投票ライフサイクル: 「締める」= 集計を締切（結果は締切表示で残す）、締切後に「終了」= 全員のパネルから削除。`session-protocol` に host 専用 `end` メッセージを追加（サーバーが `ended` を配信してセッションを除去）。
  - UI は HUD パネルに一本化。汎用アクション（`ctx.actions`）はラベル無しの入力列になり多項目フォームには不向きなため、create アクションは登録しない。
  - スタイルはアプリのデザイントークン（`--bg-*`/`--fg-*`/`--border-*`/`--u-1` 等の CSS 変数）で構成し、Control HUD にライト/ダーク両対応で馴染む。host でないカードには「主催: … ／ あなた: …」を表示して権限の所在を明示（anonymous 接続などの取り違えを可視化）。
  - `wsProvider` 無し（ローカルボード）ではサーバー権限が前提のため no-op。
- web(apps/web): cloud board で `createSessionPlugin` を登録。
- `@edv4h/usketch-plugin-voting`: `createVotingPlugin` を `@deprecated` 化（blind-relay で永続状態を持たず重複回避・遅参不可のため）。web からは未登録。

クライアントミラーの単体テスト10件（state/private/ended/error 適用・sync-on-connect・送信フレーム）。
