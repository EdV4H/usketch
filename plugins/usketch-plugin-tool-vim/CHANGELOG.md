# @edv4h/usketch-plugin-tool-vim

## 0.1.1

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0
  - @edv4h/usketch-tool-helpers@0.4.0
  - @edv4h/usketch-store@3.1.0
  - @edv4h/usketch-core@2.0.3

## 0.1.0

### Minor Changes

- 71a01cf: Vim 操作を提供する新ツールプラグインを追加。XState 5 のステートマシンで
  `normal` / `insert` / `visual` / `command` モードを管理する。
  - normal: `hjkl` カーソル移動（回数指定可）、`HJKL` 画角移動、`x/d` 削除、`y/p` ヤンク/貼付、
    `u`/`Ctrl+r` undo/redo、`+/-` ズーム、`zz` 中央寄せ、`gg/G` ジャンプ、`m{a-z}`/`` `{a-z} `` マーク、`?` ヘルプ
  - insert: 文字列入力で `shapeMap`（明示）+ shape レジストリ（自動補完）から候補を絞り込み、
    カーソル位置にゴースト表示。`Tab` 候補切替 / `Enter` 追加
  - visual: 入った瞬間に最近傍 shape を選択。`hjkl` で方向最近傍へ選択を移動。`V` で複数選択
  - command: `:q` `:tool <id>` `:set bg=...` `:zoom <n>` `:export <fmt>` `:help`

  ステータスライン・カーソル・候補・which-key ヘルプ・`:help` 全画面ヘルプはすべてプラグインが
  自前のレイヤーとして描画する。設定は Zod スキーマで検証され、`createVimToolPlugin(config)` に
  部分指定できる。

  デモアプリ（apps/web）では通常のホワイトボード編集を Vim 操作前提とし、vim を既定ツールに、
  従来のツールバー等の chrome を非表示にする（UI はプラグインのレイヤーが担う）。

  その他:
  - `f` で hop（ラベルジャンプ）: 各 shape にラベルを表示し、入力でカーソルを一気にジャンプ
    （shape 多数時は自動で2文字ラベル）
  - `M` / `:center` でカーソルを画面中央へ移動
  - `HJKL` の画角移動時、論理カーソルが追従して画面上の位置を保つ
  - 開発者拡張: 第2引数 `extensions` で独自 ex コマンド（`commands`）とキーバインド（`bindings`）を
    登録できる。ハンドラには store/cursor/mode を操作する `VimApi` が渡る。

### Patch Changes

- 3681fa1: ステータスラインに `data-testid="vim-status-line"` を付与（E2E から Vim-first の状態を検証できるように）。
