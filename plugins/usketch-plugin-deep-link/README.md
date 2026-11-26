# @edv4h/usketch-plugin-deep-link

選択した shape や表示位置を **URL で共有**するためのプラグイン。Figma の
`?node-id=...`（選択ノードへのリンク）に相当する体験を提供する。

## URL スキーム

```
?shape=<id>[,<id>...]   選択（複数対応・ライブ同期）
?cx=<n>&cy=<n>&zoom=<n> 画面の中心に来る world 座標とズーム（「この表示へのリンク」用。推奨）
?x=<n>&y=<n>&zoom=<n>   厳密なカメラ位置（viewport の平行移動そのもの）
```

- `?cx&cy&zoom` は開いた人の画面の中心にその world 座標を置くので、画面サイズや回転が
  違っても同じ場所を指す。`?x&y&zoom` は viewport の `x` / `y` をそのまま当てるため、
  画面サイズが違うと左上合わせになり、回転した表示では別の場所になる。両方あれば `?x&y` を優先する。

- **選択はライブ同期**: shape を選ぶと `history.replaceState` で `?shape=` が更新される（履歴は汚さない）。
- **カメラは明示スナップショット**: pan のたびに書き込むとチラつくため、`encodeDeepLink` で
  現在の `viewport` を含めた URL をコピーしたときだけ付与する。
- 読込時は URL を解析し、対象 shape を選択してフォーカスする。shape が CRDT 同期でまだ
  届いていない場合は `shape:added` を購読して出現までリトライする（タイムアウトあり）。カメラ
  指定があれば自動フレーミングより優先して厳密復元する。

## 使い方

```ts
import { createDeepLinkPlugin } from "@edv4h/usketch-plugin-deep-link";

// createApp は非同期。キャンバスがウィンドウ全体でないときは getViewportSize で大きさを渡す
// (`?cx&cy` の中心合わせに使う。省略時はウィンドウの大きさ)。
const app = await createApp({ store, plugins: [createDeepLinkPlugin({ getViewportSize })] });
```

「この表示へのリンク」を作る側（共有ダイアログ等）は `encodeDeepLink` を利用する:

```ts
import { captureView, encodeDeepLink } from "@edv4h/usketch-plugin-deep-link";

const search = encodeDeepLink(window.location.search, {
	shapeIds: [...store.getSelection()],
	view: captureView(store), // 画面の中心の world 座標 + zoom
});
const url = `${window.location.origin}${window.location.pathname}${search}`;
```

## エクスポート

- `createDeepLinkPlugin()` — プラグイン本体。
- `encodeDeepLink(search, state)` / `decodeDeepLink(search)` — URL ⇄ 状態の純粋関数。
- `applyDeepLink(store, search, onDone?, opts?)` — 読込時の選択＋フォーカス適用（同期待ち込み）。
- `captureView(store, opts?)` — 今の表示を `?cx&cy&zoom` 用の値（画面の中心の world 座標 + zoom）にする。回転対応。
- `viewportForView(store, view, opts?)` — `view` を画面の中心に置く viewport（今の回転を保つ）。
- `frameShapes(store, ids, opts?)` — 指定 shape 群へビューポートを合わせる（回転対応・ズーム上限）。
