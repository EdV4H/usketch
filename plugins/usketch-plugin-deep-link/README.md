# @edv4h/usketch-plugin-deep-link

選択した shape や表示位置を **URL で共有**するためのプラグイン。Figma の
`?node-id=...`（選択ノードへのリンク）に相当する体験を提供する。

## URL スキーム

```
?shape=<id>[,<id>...]   選択（複数対応・ライブ同期）
?x=<n>&y=<n>&zoom=<n>   厳密なカメラ位置（「この表示へのリンク」用）
```

- **選択はライブ同期**: shape を選ぶと `history.replaceState` で `?shape=` が更新される（履歴は汚さない）。
- **カメラは明示スナップショット**: pan のたびに書き込むとチラつくため、`encodeDeepLink` で
  現在の `viewport` を含めた URL をコピーしたときだけ付与する。
- 読込時は URL を解析し、対象 shape を選択してフォーカスする。shape が CRDT 同期でまだ
  届いていない場合は `shape:added` を購読して出現までリトライする（タイムアウトあり）。カメラ
  指定があれば自動フレーミングより優先して厳密復元する。

## 使い方

```ts
import { createDeepLinkPlugin } from "@edv4h/usketch-plugin-deep-link";

createApp({ store, plugins: [createDeepLinkPlugin()] });
```

「この表示へのリンク」を作る側（共有ダイアログ等）は `encodeDeepLink` を利用する:

```ts
import { encodeDeepLink } from "@edv4h/usketch-plugin-deep-link";

const search = encodeDeepLink(window.location.search, {
	shapeIds: [...store.getSelection()],
	camera: store.getViewport(),
});
const url = `${window.location.origin}${window.location.pathname}${search}`;
```

## エクスポート

- `createDeepLinkPlugin()` — プラグイン本体。
- `encodeDeepLink(search, state)` / `decodeDeepLink(search)` — URL ⇄ 状態の純粋関数。
- `applyDeepLink(store, search, onDone?)` — 読込時の選択＋フォーカス適用（同期待ち込み）。
- `frameShapes(store, ids, opts?)` — 指定 shape 群へビューポートを合わせる（回転対応・ズーム上限）。
