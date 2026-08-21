# @edv4h/usketch-plugin-start-position

## 0.1.2

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0

## 0.1.1

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0

## 0.1.0

### Minor Changes

- 316ac35: 新規プラグイン: スタート位置（ボードの初期視点）

  ボードを開いたときに移動する **スタート位置** を、3通りで定義できる新プラグイン。定義は
  データ専用の単一シェイプ（`start-position`）に持たせて**同期・永続・Undo 無料**（tilemap と同じ
  島パターン）。カメラを動かすのは各ユーザーのローカル・一過性の操作で、ライブカメラは同期しない。
  - **座標** — world 座標を中心に（現在のズームは維持）
  - **画角** — world 中心点＋ズームを丸ごとキャプチャ（画面サイズ非依存で再現）
  - **Shape** — 指定シェイプの bounds をフレーミング（動的に追従、消えていたら全体表示にフォールバック）

  UI は HUD 経由（X/Y・ズーム固定・起動時移動トグル＋「現在の画角をスタートに」「選択Shapeをスタートに」
  「スタート位置へ移動」「クリア」アクション）。

  起動時の自動移動は **`viewport:claimed` 協調プロトコル**で deep-link と疎結合に協調 — URL ディープリンク
  （priority 100）があればスタート位置（priority 10）は譲る。互いに import せず、共有イベント名＋優先度
  だけで調停するため、将来のカメラ系プラグインも参加できる。
