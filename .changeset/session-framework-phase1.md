---
"@edv4h/usketch-session-protocol": minor
"@edv4h/usketch-sync": minor
---

ライブ・セッション基盤（サーバー権限）Phase 1: プロトコル＋サーバー＋クライアント channel

Canvas 上で他ユーザーに「イベント」を発生させる共有インタラクティブ・セッション（投票/チュートリアル/カードゲーム）の土台。Durable Object をセッションの権威にし、公開状態は全員へ、秘匿状態（誰が何に投票したか等）は本人のみへ配る。途中参加は接続時の state 再送、途中離脱→復帰は userId 単位の猶予（DO alarm）＋再接続で担保、ホスト離脱はホスト移譲。

- 新パッケージ `@edv4h/usketch-session-protocol`: client↔server 共通の型（メッセージ union・voting の公開/秘匿/config 型）。
- `@edv4h/usketch-sync`: `MSG_SESSION` フレームと `WsProviderHandle.sendSession`/`onSession` を追加（server が処理する双方向チャネル。broadcast の盲目リレーとは別）。
- サーバー(apps/server): `SessionManager`（作成/参加/アクション/離脱/締め・presence・猶予/再接続・ホスト移譲・DO alarm・DO storage 永続、純粋クラスで単体テスト可）＋ voting 型（重複回避・secret ballot・再投票差し替え・multi）。board-room に配線。単体テスト12件。

Phase 2 でクライアントプラグイン（HUD 投票UI）と旧 voting 廃止を行う。
