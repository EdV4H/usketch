# @edv4h/usketch-plugin-window-system

Canvas を「ブラウザ常駐のウィンドウシステム」にするプラグイン。トップレベル shape を
**ウィンドウ**として扱い、2 つの責務を持つ:

1. **画角固定 (viewport lock)** — カメラを 100% / 原点に固定し、Canvas を固定スクリーン化する。
2. **配置モード切替** — 自由配置 (`free`) ⇄ タイル (`tile`, **i3 / sway 風ツリー**) を切り替える。

各操作は **アクション**として、イベント emit・キーボードショートカット・HUD ボタン・サービス API
の 4 経路で公開される。ダッシュボードとは独立した別プラグイン（用途が違うため純関数のみ流用）。

## 使い方

```ts
import { createWindowSystemPlugin } from "@edv4h/usketch-plugin-window-system";

createApp({
  plugins: [
    // …container / free-position プラグインの後に登録する
    createWindowSystemPlugin({
      autoEnable: false,     // 既定 false（メインボードを勝手にウィンドウ化しない）
      mode: "tile",          // 初期モード（既定 "tile"）
      viewportLock: true,    // 固定スクリーン（既定 true）
      gap: 8,                // ウィンドウ間の隙間 world px（既定 8）
      defaultSplit: "h",     // 新規ウィンドウの分割方向（既定 "h" = 右へ）
    }),
  ],
});
```

`autoEnable: false` のときは、HUD の「ウィンドウ化」アクション、またはサービスの `enable()` で有効化する。

## タイルモデル（i3 / sway）

固定スクリーン矩形を、n-ary の **split コンテナ**（`dir: "h" | "v"`）と **leaf（ウィンドウ）**の
木で再帰分割する。各 split は分割比 `fractions` を持つ。木は config shape に JSON で永続化されるので、
同期（Yjs）と Undo は shape 経由で無料。JSON は last-writer-wins（協調編集ではダッシュボード config
と同水準）。

- `dir: "h"` … 子を横に並べる（i3 の split h → 次のウィンドウは**右**へ）
- `dir: "v"` … 子を縦に積む（split v → 次のウィンドウは**下**へ）

## アクション

イベント名 `window:<key>` で emit、HUD の Controls に自動表示、サービス API から直接呼び出し可能。

| key | 内容 |
| --- | --- |
| `enable` / `disable` | ウィンドウ化 / 解除 |
| `toggle-mode` / `set-mode-free` / `set-mode-tile` | 配置モード切替 |
| `toggle-lock` | 画角固定の ON/OFF |
| `retile` | 再タイル（1 Undo） |
| `focus-{left,right,up,down}` | **幾何的**フォーカス移動（算出矩形で隣を選ぶ） |
| `move-{left,right,up,down}` | フォーカス窓を隣の窓とスワップ |
| `split-h` / `split-v` | フォーカス窓の親 split を水平 / 垂直に再分割（＋既定分割方向を設定） |
| `resize-grow` / `resize-shrink` | フォーカス窓を親 split 軸方向に拡大 / 縮小 |
| `fullscreen-toggle` | フォーカス窓を全画面 / 復元 |

## キーボードショートカット

共有ショートカットレジストリは `event.key` で照合するため、macOS では **Option + 英字**が別文字に
合成される（Alt+T → "†"）。そのため既定でバインドするのは**矢印ベースのフォーカス / 移動のみ**
（クロスプラットフォームで安全）:

- フォーカス: `Alt + ↑ / ↓ / ← / →`
- 移動: `Alt + Shift + ↑ / ↓ / ← / →`

その他のアクションは HUD / イベント / サービスから操作でき、`shortcuts` オプションで任意のコンボを
割り当て（または既定を無効化）できる:

```ts
createWindowSystemPlugin({
  shortcuts: {
    "toggle-mode": "Mod+Shift+Enter", // 任意コンボを割り当て
    "focus-left": null,               // 既定を無効化
  },
});
```

## サービス API

```ts
import { getWindowSystemApi } from "@edv4h/usketch-plugin-window-system";

const api = getWindowSystemApi(app.services);
api?.setMode("tile");
api?.focus("right");
api?.splitV();
```

`WindowSystemApi`: `isWindowBoard` / `enable` / `disable` / `getMode` / `setMode` / `toggleMode` /
`getLock` / `setLock` / `toggleLock` / `getGap` / `setGap` / `getDefaultSplit` / `setDefaultSplit` /
`retile` / `focus(dir)` / `move(dir)` / `resize(±1)` / `splitH` / `splitV` / `toggleFullscreen` /
`getFocused` / `onChange`。

## スコープ外（v2 送り）

タブ / スタックコンテナ、タイル境界のドラッグリサイズ、floating のタイトルバー / 装飾、
タイル内の個別 floating トグル、ウィンドウのドラッグによる並べ替え。
