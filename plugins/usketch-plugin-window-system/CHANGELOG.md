# @edv4h/usketch-plugin-window-system

## 0.3.0

### Minor Changes

- 6db00b3: Character, Mode 7 and window-system keys are now keymap bindings (`ctx.keymap`), so overlaps with other plugins show up in `keymap.getConflicts()` and hosts can set them with `createApp({ keymap: { keys } })`.
  
  - Character: the movement, drift and jump keys are `"hold"` bindings (`CHARACTER_KEY_IDS`, e.g. `usketch-plugin-character:jump`), with the plugin's `keys` as defaults. While the character is on they sit above tool shortcuts and Mode 7's camera height keys (`CHARACTER_KEY_PRIORITY`: movement, then drift, then jump), and a key the keymap gives to someone else is left alone. `setKeys` / `resetKeys` / `getDefaultKeys` / `onKeysChange` now go through the keymap (a viewer's saved keys are applied on top of the host's), so rebinding in the keymap updates the HUD's key settings too.
  - Mode 7: the camera height keys are `"hold"` bindings `HEIGHT_KEY_IDS` (`usketch-plugin-mode7:camera-up` / `camera-down`, priority `HEIGHT_KEY_PRIORITY` = 10) that only count while the 3D view is on and no follower drives the height. `getHeightKeys` / `setHeightKeys` are deprecated wrappers. Every action is a binding `usketch-plugin-mode7:<action>` (no keys by default); the `shortcuts` option is deprecated.
  - Window system: every action is a binding `usketch-plugin-window-system:<action>`, taking its keys (default `Alt+Arrow` / `Alt+Shift+Arrow`) only on a window board; the `shortcuts` option is deprecated.
  
  Hosts without a keymap (older `@edv4h/usketch-core`) keep the previous behaviour.

### Patch Changes

- Updated dependencies [b16cfe8]
- Updated dependencies [d81aad4]
  - @edv4h/usketch-shared@4.24.0
  - @edv4h/usketch-store@3.11.6

## 0.2.12

### Patch Changes

- Updated dependencies [55459fd]
  - @edv4h/usketch-shared@4.23.0
  - @edv4h/usketch-store@3.11.5

## 0.2.11

### Patch Changes

- Updated dependencies [9ffa649]
  - @edv4h/usketch-shared@4.22.0
  - @edv4h/usketch-store@3.11.4

## 0.2.10

### Patch Changes

- Updated dependencies [abc7f44]
  - @edv4h/usketch-shared@4.21.0
  - @edv4h/usketch-store@3.11.3

## 0.2.9

### Patch Changes

- Updated dependencies [df6edda]
  - @edv4h/usketch-shared@4.20.0
  - @edv4h/usketch-store@3.11.2

## 0.2.8

### Patch Changes

- Updated dependencies [ca67108]
  - @edv4h/usketch-store@3.11.1

## 0.2.7

### Patch Changes

- Updated dependencies [33a4ef2]
- Updated dependencies [157cce0]
  - @edv4h/usketch-store@3.11.0

## 0.2.6

### Patch Changes

- Updated dependencies [2fa13a5]
- Updated dependencies [2fe644e]
- Updated dependencies [6f3ef3b]
- Updated dependencies [9b3a0a1]
  - @edv4h/usketch-shared@4.19.0
  - @edv4h/usketch-store@3.10.0

## 0.2.5

### Patch Changes

- Updated dependencies [1962032]
- Updated dependencies [8cb3482]
  - @edv4h/usketch-shared@4.18.0
  - @edv4h/usketch-store@3.9.2

## 0.2.4

### Patch Changes

- Updated dependencies [dc5d8d1]
  - @edv4h/usketch-shared@4.17.0
  - @edv4h/usketch-store@3.9.1

## 0.2.3

### Patch Changes

- Updated dependencies [bfba838]
  - @edv4h/usketch-shared@4.16.0
  - @edv4h/usketch-store@3.9.0

## 0.2.2

### Patch Changes

- Updated dependencies [38ca865]
- Updated dependencies [b71dd10]
  - @edv4h/usketch-shared@4.15.0
  - @edv4h/usketch-store@3.8.1

## 0.2.1

### Patch Changes

- Updated dependencies [fa69bfb]
- Updated dependencies [f4b7387]
  - @edv4h/usketch-shared@4.14.0
  - @edv4h/usketch-store@3.8.0

## 0.2.0

### Minor Changes

- 234a36b: feat(window-system): Canvas をブラウザ常駐のウィンドウシステムにするプラグインを追加

  `@edv4h/usketch-plugin-window-system` を新規追加。トップレベル shape を「ウィンドウ」として扱い、
  2 つの責務を持つ:
  - **画角固定 (viewport lock)** — カメラを 100% / 原点に固定し Canvas を固定スクリーン化。
  - **配置モード切替** — 自由配置 (`free`) ⇄ タイル (`tile`, **i3 / sway 風ツリー**)。

  タイルは固定スクリーン矩形を n-ary の split コンテナ（`h`/`v`）＋ leaf の木で再帰分割する純粋な
  モデル（`tile-tree.ts`）で、木は config shape に JSON 永続化するため同期（Yjs）と Undo は shape 経由で
  無料。各操作（`focus`/`move`/`split`/`resize`/`fullscreen`/`retile` ほか）は **イベント emit ＋ HUD
  ボタン ＋ キーボードショートカット ＋ サービス API** の 4 経路で公開し、キーボード操作可能にした。
  - フォーカスは算出矩形で隣を選ぶ**幾何的**移動で、木構造から独立して堅牢。
  - ショートカット既定はクロスプラットフォームで安全な矢印ベース（フォーカス=`Alt+矢印`、
    移動=`Alt+Shift+矢印`）。共有レジストリが `event.key` で照合し macOS で Option+英字が別文字へ
    合成されるため、英字系は既定を持たず `shortcuts` オプションで任意に割当/無効化できる。
  - タイルの隙間は 2 種類設定可能: `gap`(窓間=inner) と `padding`(画面端との外側余白=outer)。
    全画面表示は両者を無視して画面いっぱい。
  - `createWindowSystemPlugin(options?)`（`autoEnable`/`mode`/`viewportLock`/`gap`/`padding`/
    `defaultSplit`/`shortcuts`）。既定 `autoEnable:false`（メインボードを勝手に変換しない、HUD「ウィンドウ化」で opt-in）。
  - apps/web に `autoEnable:false` で登録（dashboard と同じく container/free-position の後）。
