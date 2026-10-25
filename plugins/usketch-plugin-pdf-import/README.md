# @edv4h/usketch-plugin-pdf-import

PDF をキャンバスに**ペースト／ドロップすると全ページが展開される** uSketch プラグイン。ページは**ラスタライズせず**、ズームに応じてブラウザ側で描き直すので、どこまで拡大しても劣化しない。

## 仕組み

1. `ctx.externalContent` に `kind: "file"` のハンドラを `order: 0` で登録する。ペースト／ドロップのペイロードに PDF が 1 つでも含まれていれば `match` する。
2. **PDF 本体をアセットストアに 1 件だけ格納**する。ページ数に関わらず保存されるバイト列は 1 つ。
3. 各ページを `pdf-page` シェイプとして**グリッド配置**（`ceil(sqrt(n))` 列、左→右で折り返し）する。シェイプが持つのは `assetId` + ページ番号 + ページの原寸（PDF ポイント）だけ。
4. グリッドが画面に収まらない場合だけ**ズームアウトして全体を表示する**（`store.fitToBounds`）。既に収まっている場合はビューポートを動かさない。
5. 各 `pdf-page` シェイプは、**現在のズームに必要な解像度で pdf.js にページを描かせて** canvas に転送する。ズームすると解像度を上げて描き直す。
6. ページを複数選択すると、**HUD から列数を変えられる**（下記）。

**PDF 1 ファイル = 1 コマンド**なので、1 回の undo で丸ごと取り消せる。PDF 以外のファイルが同じペイロードに混ざっていた場合は `ctx.externalContent.dispatch` で**再ディスパッチ**し、画像ハンドラ等に処理を委ねる。

外部コンテンツレジストリは**単一勝者**（マッチしたハンドラ 1 つだけが実行され、例外が出ても次点は試されない）なので、`handle` は決して throw しない。失敗は `ai:status` イベントで通知する。

## なぜ取り込み時にラスタライズしないか

取り込み時に固定解像度の画像にしてしまうと、その解像度がページ品質の上限になる。拡大して細部を読もうとすると必ずぼやける。ワールドレイヤ全体に CSS の `scale(zoom)` がかかる設計なので、固定サイズの canvas や `<img>` は単純に引き伸ばされるだけになる。

代わりに、シェイプは store のビューポートを購読し、必要な device pixel 数を算出して pdf.js に描き直させる。ズーム 0.65 で 256px、ズーム 2 で 1024px、といった具合に backing store が追従する。

トレードオフとして、**閲覧側の全クライアントが pdf.js をロードして描画する**コストを払う。これを避けたい場合は取り込み時ラスタライズの方が適している。

## 列数の変更（HUD）

`pdf-page` シェイプを 2 つ以上選択すると、Control HUD（バッククォートで開くパネル）の「PDF取り込み」セクションから並びを変えられる。プラグイン独自のツールバーは持たない（UI は HUD に登録する方針のため）。

| HUD の項目 | 種類 | 内容 |
| --- | --- | --- |
| 列数を変更 | アクション（`pdf-import:set-columns`） | 1 行に並ぶページ数を指定して並べ替える |
| 正方形に近い並びに戻す | アクション（`pdf-import:square-grid`） | 取り込み直後と同じ `ceil(sqrt(n))` 列に戻す |
| 選択中のPDFページ › 列数 | 設定（`pdf-import:grid`） | 現在の列数をライブ表示し、その場で変更もできる。入力が 400ms 止まってから 1 回だけ並べ替える（「12」と打っても 1 列を経由しない） |

アクションは PDF ページが 2 枚以上選択されている時だけ有効になる（`isEnabled`）。

- 行数はページ数から自動で決まる（行と列を両方固定すると積がページ数と一致しないケースが出るため、指定するのは列数だけ）。
- 並べ替えは**グリッドのセルの上端と水平中心を固定**したまま行う（グリッドは下方向に伸びる）。高さの違うページが混ざっていても、列数を続けて変えて 1 行目が視線の位置から動かない。
- **ドキュメント順 → ページ番号順**に並べ直すため、手で動かして順序が崩れたページも揃う。複数の PDF を選択した場合はドキュメントごとにまとまり、ドキュメントの順は各ドキュメントの先頭ページの現在位置（上の行が先、同じ行なら左が先）で決まる。取り込み直後は左から取り込み順に並ぶので、その順が保たれる。
- 1 回の操作 = 1 コマンドなので undo で元の配置に戻る。

現在の列数はシェイプに保存せず、**ページの位置から読み取っている**。手で動かした後・undo 後・他クライアントから同期された後でも、その時点の見た目に対して素直な値が出る。

HUD と同じ操作は、ホスト向けにサービス（`defineService`）として公開している。HUD もアクションもこの API を呼んでいるだけなので、ホストが独自の導線から呼んでも同じ結果・同じ undo 単位になる。

```ts
import { getPdfImportApi } from "@edv4h/usketch-plugin-pdf-import";

const pdf = getPdfImportApi(app.services);
pdf?.getSelectedColumns(); // 選択中のページの列数（2 枚未満なら 0）
pdf?.setSelectedColumns(4); // undo 可能なコマンドとして実行
pdf?.resetSelectedToSquareGrid();
```

中身は `BoardStore` を受け取る純関数（`createSetPdfColumnsCommand` / `getSelectedPdfColumns`）で、これらも直接 import できる。

選択に追従する HUD のコンテキスト UI（#882）が入ったら、そちらに載せ替える予定。

## 描画パイプラインの要点

- **ズーム購読**: シェイプのコンポーネントは shape identity で memo 化されており、ズームでは再描画されない。そのため `store.subscribe` を自前で張っている。
- **量子化**: スナップショットは生のズーム値ではなく「必要な描画幅を 2 の冪に丸めた値」。ピンチ操作のたびに pdf.js を叩かないようにするため。ズーム全域でも数種類の解像度しか使わない。
- **上限**: `maxRenderPixels`（既定 800 万 px ≈ 32MB）で backing store の**面積**を制限する。幅ではなく面積で制限するのは、効いてくる制約がどちらも面積だから。ブラウザの canvas 上限（iOS Safari はおよそ 1670 万 px で、超えると黙って白紙になる）も、下記キャッシュの予算も面積で決まる。制限はキャッシュキーを決める `targetRenderWidth` 側でかける（描画時に縮めるとキーと canvas の実寸がずれるため）。
- **ドキュメント共有**: 同じ PDF の全ページが 1 つの `PDFDocumentProxy` を参照カウント付きで共有する。50 ページの取り込みで 50 回開いたりはしない。ページが画面外に出て unmount されても 5 秒の猶予を置いてから破棄するので、パンのたびに開き直さない。取り込み時にサイズ計測で開いたドキュメントはそのままアセット id へ引き継ぐので、配置直後のページは PDF を取得・パースし直さない。
- **同時実行制限**: pdf.js の描画は同時 3 件まで。取り込み直後に全ページが殺到しないようにする。
- **キャッシュ**: 描画済みビットマップを合計 2400 万ピクセル程度まで LRU で保持する。viewport LOD で unmount されたページに戻ってきたとき即座に表示できる。ドキュメントを破棄してもビットマップは捨てず、予算を超えた分だけ古い順に捨てる（破棄後に戻ってきたページも、開き直しを待たずに表示できる）。
- **再描画中の空白防止**: オフスクリーンに描いてから転送するので、ズーム中にページが真っ白になることがない。
- **LOD**: 縮小時・画面外では `simplifiedComponent`（白いページ矩形）に差し替わり、pdf.js は動かない。

## 使い方

```ts
import { createPdfImportPlugin } from "@edv4h/usketch-plugin-pdf-import";
// Vite の場合。ワーカーをホスト自身のオリジンから配信する
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const plugins = [
  createAssetStorePlugin({ doc }), // 必須
  createPdfImportPlugin({ workerSrc: pdfWorkerUrl }), // workerSrc も必須
];
```

**アセットストア（`@edv4h/usketch-plugin-asset-store`）が必須。** ページは PDF を `assetId` で参照するため、格納先が無いと成立しない（PDF 本体をページごとに埋め込むと重複してしまう）。未登録の場合はその旨をエラー通知する。

## オプション

| オプション | 既定値 | 説明 |
| --- | --- | --- |
| `maxSizeMB` | `50` | PDF ファイル自体のサイズ上限。アセットストアの `maxUploadBytes()` の方が小さければそちらが効く |
| `maxPages` | `50` | 配置するページ数の上限。超過時は先頭 N ページのみ + 警告 |
| `maxPageWorldSize` | `480` | 配置後の 1 ページの長辺（ワールド単位） |
| `gap` | `24` | グリッドの間隔（ワールド単位）。HUD での並べ替えにも使われる |
| `maxRenderPixels` | `8000000` | ページ描画バッファの面積（device pixel）上限 |
| `fitOnImport` | `true` | 取り込み後に全体が見えるようズームアウトする。ズームインは決してしない |
| `order` | `0` | ハンドラの優先度。プラグイン既定値なのでサードパーティが上書きできる |
| `workerSrc` | なし（必須） | pdf.js ワーカーの URL（下記） |

`maxPages` はページ数が保存バイト数に影響しない設計なので、ボードの扱いやすさ（シェイプ数と描画負荷）だけを基準にした値。

アセットストアが既定の uploader のままだと、実際の上限はストアの `maxUploadBytes()`（既定 4MB、image プラグインと同じ値）になる。既定の uploader は PDF を base64 のまま 1 回の Yjs update としてドキュメントに書き込むため。大きな update は同期や永続化で黙って失敗しうる。この問題は image プラグインでも起きる既存の問題なので、別 Issue で扱う。

## pdf.js ワーカーについて

pdf.js のワーカーは**実行コード**なので、第三者の CDN からは読み込まない。ホストが自分のオリジンから配信し、その URL を `workerSrc` で渡す。指定が無い場合、PDF を開こうとした時点でエラーになる（黙って CDN を読みに行くことはしない）。ホストが既に `GlobalWorkerOptions.workerSrc` を設定している場合はそれを尊重し、上書きしない。

このプラグインは素の `tsc` でビルドされるため、バンドラ固有の形式（`?url`、`new URL(…, import.meta.url)`）でワーカーを参照できない。参照はホスト側のバンドラで解決する。ワーカーは **`pdfjs-dist` の依存バージョンと完全に一致**していないと pdf.js が起動しないので、ホストにも同じバージョンの `pdfjs-dist` を入れる。

```ts
// Vite
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
createPdfImportPlugin({ workerSrc: pdfWorkerUrl });
```

### CSP

Content-Security-Policy を設定しているホストでは、少なくとも次が必要になる。

| ディレクティブ | 必要な値 | 理由 |
| --- | --- | --- |
| `worker-src` | `'self'`（ワーカーの配信元） | pdf.js のワーカー本体（module worker） |
| `worker-src` | `blob:`（ワーカーを別オリジンから配信する場合だけ） | pdf.js は別オリジンのワーカーを `blob:` の URL で包んで起動する。同一オリジンなら不要 |
| `script-src` | `'self'` | pdf.js 本体（動的 import でチャンク分割されている） |
| `connect-src` | `data:` と、`setUploader` で使う保存先のオリジン | シェイプが PDF を `fetch` して読む。既定ではアセットは data URL |

pdf.js v6 はフォント処理などで `eval` / `new Function` を使わないので、`'unsafe-eval'` は不要。

## ストレージについて

既定のアセットストアは PDF を base64 のまま Yjs ドキュメントに置き、全クライアントへ同期する。本番運用では `AssetStore.setUploader()` で S3 / R2 等へ差し替えると、ドキュメントには `assetId` だけが載る。プラグイン側の変更は不要。

```ts
getAssetStore(ctx)?.setUploader(async (type, dataUrl, meta) => {
  const { id, url } = await uploadToS3(dataUrl, meta);
  return { id, src: url };
});
```

外部 URL に差し替えた場合、シェイプはその URL を `fetch` して pdf.js に渡すので、**CORS を許可する必要がある**。

## イベント

取り込み時にページを 1 枚計測するごとに `pdf-import:progress` を発火する。

```ts
ctx.events.on<PdfImportProgressEvent>("pdf-import:progress", ({ fileName, page, totalPages }) => {
  // 進捗トーストなど
});
```

エラー（サイズ超過、パスワード付き PDF、アセットストア未登録など）は `ai:status` の `{ status: "error", message }` で通知する。ページ数の打ち切りは取り込み自体は成功しているので、`{ status: "done", message }` で通知する。

## 制約

- パスワード付き PDF は非対応（エラー通知のみ）。
- pdf.js v6 は `Promise.withResolvers` を要求するため Safari 17.4+ / Chrome 119+ / Firefox 121+ が必要。
- リンクや選択可能テキストは保持されない（canvas に描画するため）。
- `maxRenderPixels` を超える倍率まで拡大すると、そこから先は引き伸ばしになる。ページ全体ではなく可視領域だけを高解像度で描くタイル描画は未実装。
