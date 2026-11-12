# @edv4h/usketch-plugin-key-settings

全プラグインのキー割り当て（アプリの keymap = `ctx.keymap`）を、HUD の **「キー設定」パネル 1 つ**で一覧・付け替えするプラグイン。閲覧者の付け替えは保存する（既定は localStorage）。

```ts
import { createKeySettingsPlugin } from "@edv4h/usketch-plugin-key-settings";

createApp({
  plugins: [
    // …
    createKeySettingsPlugin(),
  ],
});
```

## パネル

- binding を `category`（なければプラグイン名）ごとにまとめ、`order` → 名前の順に並べる。絞り込み欄つき。
- キーのボタンを押して新しいキーを押すと付け替え。Esc でキャンセル、Delete / Backspace でそのキーを外す。「+」で追加（1 つの操作に最大 3 つ）。
  - `"press"` の binding はコンボ（`Mod+Shift+E` など。アクセラレータは `mod` で保存するので OS をまたいでも同じ）、`"hold"` の binding は `KeyboardEvent.code` で受け取る。
  - 同じプラグインのほかの操作が持っていたキーはこちらへ移す。**ほかのプラグインのキーは取り上げず**、重なりとして ⚠ を付ける（どれが動くかはアプリの振り分けルール `conflictPolicy` と `when` / `priority` で決まる）。
  - 入力待ちの間は keymap のゲートで全 binding を止めるので、キャラの移動キーなども動かない。
  - 修飾キーだけ・ブラウザ予約（`Mod+W` / `T` / `N` / `Q` / `R`）・Esc・Tab は割り当てない。`customizable: false` の binding は変更できない。`enabled()` が false の操作は灰色で表示する。
- 付け替えた操作には ↺（既定に戻す）、どれか付け替えていれば「すべて既定に戻す」。
- 「ほかの操作と重なっているキーだけ」で重なりだけを表示。

## オプション

| オプション | 既定 | 内容 |
|---|---|---|
| `storage` | localStorage（`"usketch:keymap"`） | 閲覧者の付け替えの保存先（`KeymapStorage`）。`false` でホストに任せる（自前の `bindKeymapStorage` など） |
| `pick` | — | 予約キーの一覧（`reserved`）、素のキーを許すか（`allowBareKeys`）、`mod` の扱い（keymap の `mod` に合わせる） |
| `order` | 90 | HUD での並び |

## 純関数

パネルのルールは `key-settings-model.ts` の純関数として export している（独自 UI からも使える）: `groupBindings` / `bindingName` / `sharersOf` / `applyPickedKey`、入力待ちの `captureKeys`。表示や予約キー判定などの土台は `@edv4h/usketch-core` の `formatBindingKey` / `comboFromKeyEvent` / `isReservedCombo` / `assignKey`。
