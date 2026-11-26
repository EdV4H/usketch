# @edv4h/usketch-plugin-start-position

## 0.2.16

### Patch Changes

- Updated dependencies [1b665c3]
  - @edv4h/usketch-shared@4.33.0

## 0.2.15

### Patch Changes

- 56a137e: 読み取り専用のページ（見るだけの人）を足した。
  
  - `BoardStore` に `isReadOnly` / `setReadOnly` / `applyExternal`（任意）。読み取り専用のあいだ、閲覧者自身の Shape の追加・変更・削除は止まり、同期で届く他の人の変更と保存したものの読み込みだけが `applyExternal(store, fn)` で通る。読むときは `isReadOnly(store)`。
  - `createApp` は `page.edit` が無いと読み取り専用で開き、権限が変わったら追う（`readOnly: true` で権限に関係なく読み取り専用にもできる。そのとき `app.permissions` も `page.edit` を不可と答える）。
  - `ToolDefinition.readOnlySafe`: 読み取り専用のページでも使えるツール（select・pan・laser・spotlight・reactions・effect-ripple・spatial-chat）。それ以外のツールには切り替わらず、HUD のツール欄にも出ない（`isToolUsable(store, tool)`）。
  - 選択ツールは読み取り専用では選ぶだけ（移動・リサイズ・回転・他のプラグインのハンドルを出さない）。
  - 同期（sync-localstorage-yjs / sync-ywebsocket）は doc からストアへ入れるときに `applyExternal` を使う。
  - ページを変える HUD の操作に `requires: "page.edit"` を付けた（図形・カード・卓・タイマー・グループ・標高など）。見るだけの人には出ない。
- Updated dependencies [61ee9e6]
- Updated dependencies [56a137e]
  - @edv4h/usketch-shared@4.32.0

## 0.2.14

### Patch Changes

- Updated dependencies [5dc7d1b]
- Updated dependencies [8d13a3a]
- Updated dependencies [9aa4ddb]
- Updated dependencies [ba2c89c]
  - @edv4h/usketch-shared@4.31.0

## 0.2.13

### Patch Changes

- Updated dependencies [3566290]
  - @edv4h/usketch-shared@4.30.0

## 0.2.12

### Patch Changes

- Updated dependencies [66e8499]
  - @edv4h/usketch-shared@4.29.0

## 0.2.11

### Patch Changes

- Updated dependencies [3d0a677]
  - @edv4h/usketch-shared@4.28.0

## 0.2.10

### Patch Changes

- Updated dependencies [ee82044]
- Updated dependencies [98df25b]
- Updated dependencies [e2d6d5e]
  - @edv4h/usketch-shared@4.27.0

## 0.2.9

### Patch Changes

- Updated dependencies [db5c6f9]
  - @edv4h/usketch-shared@4.26.0

## 0.2.8

### Patch Changes

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

## 0.2.7

### Patch Changes

- Updated dependencies [b16cfe8]
- Updated dependencies [d81aad4]
  - @edv4h/usketch-shared@4.24.0

## 0.2.6

### Patch Changes

- Updated dependencies [55459fd]
  - @edv4h/usketch-shared@4.23.0

## 0.2.5

### Patch Changes

- Updated dependencies [9ffa649]
  - @edv4h/usketch-shared@4.22.0

## 0.2.4

### Patch Changes

- Updated dependencies [abc7f44]
  - @edv4h/usketch-shared@4.21.0

## 0.2.3

### Patch Changes

- Updated dependencies [df6edda]
  - @edv4h/usketch-shared@4.20.0

## 0.2.2

### Patch Changes

- Updated dependencies [2fa13a5]
- Updated dependencies [2fe644e]
  - @edv4h/usketch-shared@4.19.0

## 0.2.1

### Patch Changes

- Updated dependencies [1962032]
- Updated dependencies [8cb3482]
  - @edv4h/usketch-shared@4.18.0

## 0.2.0

### Minor Changes

- 7224e76: feat(start-position): スタート位置が未設定のボードを開いた時に全 Shape を画面に収める `fallback: "fit-content"` を追加。初期同期の完了を即座に知らせる `whenReady`、キャンバスサイズを渡す `getViewportSize` も追加。同期待ち中にユーザーや deep-link がカメラを動かしていたら fallback は動かない。フィット計算は start-position shape を除外し、回転を考慮するようになった。

### Patch Changes

- Updated dependencies [dc5d8d1]
  - @edv4h/usketch-shared@4.17.0

## 0.1.6

### Patch Changes

- Updated dependencies [bfba838]
  - @edv4h/usketch-shared@4.16.0

## 0.1.5

### Patch Changes

- Updated dependencies [38ca865]
- Updated dependencies [b71dd10]
  - @edv4h/usketch-shared@4.15.0

## 0.1.4

### Patch Changes

- Updated dependencies [fa69bfb]
- Updated dependencies [f4b7387]
  - @edv4h/usketch-shared@4.14.0

## 0.1.3

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0

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
