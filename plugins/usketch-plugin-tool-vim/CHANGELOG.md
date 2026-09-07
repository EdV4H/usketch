# @edv4h/usketch-plugin-tool-vim

## 0.1.13

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0
  - @edv4h/usketch-store@3.6.0
  - @edv4h/usketch-core@2.4.3
  - @edv4h/usketch-tool-helpers@0.7.4

## 0.1.12

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0
  - @edv4h/usketch-core@2.4.2
  - @edv4h/usketch-store@3.5.4
  - @edv4h/usketch-tool-helpers@0.7.3

## 0.1.11

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-core@2.4.1
  - @edv4h/usketch-store@3.5.3
  - @edv4h/usketch-tool-helpers@0.7.2

## 0.1.10

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-core@2.4.0
  - @edv4h/usketch-store@3.5.2
  - @edv4h/usketch-tool-helpers@0.7.1

## 0.1.9

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-tool-helpers@0.7.0
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-core@2.3.2
  - @edv4h/usketch-store@3.5.1

## 0.1.8

### Patch Changes

- Updated dependencies [1a489de]
  - @edv4h/usketch-tool-helpers@0.6.3

## 0.1.7

### Patch Changes

- 6c6702b: ロジック起点のビューポート移動（ズーム変更・特定位置へのジャンプ・zoom-to-fit）をスムーズにアニメーションさせ、デフォルト ON にした。連続的なインタラクション（ホイールズーム・ドラッグパン・ミニマップドラッグ）は従来どおり即時。
  - store: `animateViewportTo(target, opts?)` を追加（rAF による eased 補間、`prefers-reduced-motion`・rAF 不在・無効時は即時フォールバック、割り込みは即時系メソッドが cancel）。`fitToBounds` は既定でアニメ化。`createBoardStore({ viewportAnimation })` と `setViewportAnimation` / `getViewportAnimation` で enabled/duration/easing を調整可能（既定: 有効・350ms・ease-in-out-cubic）。
  - shared: 各プラグインが個別実装していたジャンプ計算を共通 helper `centerOnWorld` / `zoomBy` / `zoomToLevel` / `fitContent` / `screenCenterWorld` / `getScreenSize` に集約（すべて既定でアニメ）。
  - keyboard-shortcuts / tool-vim / whistle / follow-me / debug-hud を共通 helper に移行。follow-me は追従の応答性のため短めのアニメ（180ms）。

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-store@3.5.0
  - @edv4h/usketch-core@2.3.1
  - @edv4h/usketch-tool-helpers@0.6.2

## 0.1.6

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-core@2.3.0
  - @edv4h/usketch-store@3.4.1
  - @edv4h/usketch-tool-helpers@0.6.1

## 0.1.5

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-core@2.2.0
  - @edv4h/usketch-store@3.4.0
  - @edv4h/usketch-tool-helpers@0.6.0

## 0.1.4

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [51216e7]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-core@2.1.0
  - @edv4h/usketch-store@3.3.1
  - @edv4h/usketch-tool-helpers@0.5.2

## 0.1.3

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0
  - @edv4h/usketch-store@3.3.0
  - @edv4h/usketch-core@2.0.5
  - @edv4h/usketch-tool-helpers@0.5.1

## 0.1.2

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0
  - @edv4h/usketch-tool-helpers@0.5.0
  - @edv4h/usketch-store@3.2.0
  - @edv4h/usketch-core@2.0.4

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
