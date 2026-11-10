# @edv4h/usketch-plugin-elevation

ボードの地面に **標高（連続した高さ）** を持たせるプラグイン。map プラグインがマスの地形の種類で段を作るのに対し、こちらは場所ごとの高さの数値で、なだらかな丘・谷・尾根・海岸を表す。

- **無限地形**: 場（`elevation-field`）にシードと生成パラメーターを持たせると、全域の起伏が自動で生成される。各クライアントが手元で同じ地形を計算するので、起伏そのものは同期しない（送るのはシードとパラメーターの数十 byte）。生成は整数のハッシュと四則演算だけで書いてあり、どのブラウザでも同じ値になる。
- **2D 表示**: 高さで色分け（水・砂浜・草地・土・岩・雪）、北西からの光の陰影、等高線。引いて見るほど粗いタイルに切り替わるので、どのズームでも描くタイルの数はほぼ一定。
- **地面の高さサービス**: shared の `groundHeightService` を提供する。キャラクターは坂に沿って上下し、shape-3d の `ground: true` の Shape は丘の上に立つ。
- **ブラシ**: ツール「標高ブラシ」（キー G）で、盛る・削る・ならす・平らにする・段にする。ドラッグ中はストアを書き換えず手元で描き、離したときに変わったチャンクだけを 1 回の undo として書く。
- **ブラシの差分**: `elevation-chunk`（512 × 512 units ごと、32 × 32 点の Int16 を base64、約 3 KB）に「生成の上に足した高さ」を持つ。

UI は Control HUD（「標高」）だけ。独自のツールバーやパネルはない。

## 使い方

```ts
import { createElevationPlugin, getElevationApi } from "@edv4h/usketch-plugin-elevation";

createApp({
  plugins: [
    // map と一緒に使う場合は map より後に置く（下の「map との関係」）
    createElevationPlugin({
      display: { tint: true, shade: true, contour: 32 }, // 見た目の初期値（任意）
    }),
    createMode7Plugin(),
    createDomRendererPlugin(),
  ],
});

// HUD を使わずに操作する
const elevation = getElevationApi(app.services);
elevation?.enableInfinite({ seed: 7, gen: { relief: 400 }, waterLevel: 60 });
// ブラシのひと筆（1 回の undo）。足りない設定は HUD のブラシ設定から
elevation?.paint([{ x: 0, y: 0 }, { x: 600, y: 0 }], { mode: "raise", seconds: 1 });
```

## ブラシ

| モード | 動き |
|---|---|
| 盛る | ブラシの中を持ち上げる（中心ほど強く）。Shift を押している間は「削る」 |
| 削る | 下げる（高さ 0 で止まる）。Shift で「盛る」 |
| ならす | 周りの平均に近づける |
| 平らにする | 決まった高さにそろえる。高さが -1 なら押した所の高さ。Alt + クリックで高さを拾う |
| 段にする | 高さを「段の間隔」ごとに丸める |

- 押している間は時間で効く（強さ × 秒）。止めたまま押し続ければ盛れ続ける。
- 画面にはブラシの円（外側 = 半径、点線 = 半分の強さの所）と、中心の標高が出る。Mode 7 の間は出ない（3D では編集できないので、2D で盛って 3D で見る）。
- ドラッグ中に変わっているタイルは粗め（128 px）で描き直し、離したら元の細かさに戻る。
- 離したときに、変わったチャンクだけを 1 つのコマンドとして書く（新しいチャンクは追加、差分が 0 に戻ったチャンクは削除）。場のないボードなら平らな場も一緒に作る。
- undo / redo は、その後で別の人が書き換えたチャンクには触らない（相手の変更を消さない）。

## HUD

| 項目 | 内容 |
|---|---|
| 標高の表示 | 高さで色分け / 陰影 / 等高線の間隔（0 で なし）。見た目だけの設定で、同期しない |
| 標高ブラシ | モード / 半径（16〜1024）/ 強さ（1〜100）/ 縁の落ち方（なめらか・直線・平ら）/ 平らにする高さ / 段の間隔。同期しない |
| 無限地形を作る・変える | シード・起伏の大きさ・山の大きさ・細かさ・尾根の強さ・水面の高さ（-1 で なし）。1 回の undo で戻せる |
| 無限地形を外す | 生成された起伏を消す（ブラシの差分は残る） |
| ブラシの差分を全部消す | 生成されたままの地形に戻す |
| 標高を削除 | 場とすべての差分を消す |

## データ

```ts
// ボードに 1 個。id は固定の `elevation-field`（同時に作っても 1 個になる）。複数あれば id が一番小さいもの
{ type: "elevation-field", spacing: 16, chunk: 32, version: 1,
  seed?: number, gen?: { v: 1, relief, scale, roughness, ridges, octaves }, waterLevel?: number }

// 差分のチャンク（id は `elev:<fieldId>:<cx>:<cy>`）
{ type: "elevation-chunk", field, cx, cy, data /* 32×32 Int16（1/4 単位、LE）を base64 */ }
```

- どちらもロック済み・当たり判定なし・何も描かない Shape（map の tilemap と同じ扱い）。選択や範囲選択には入らない。
- 標高 = `clamp(生成の高さ + 差分, 0, 4095.75)`。
- 生成パラメーターは場に保存されるので、既定値やアルゴリズムが変わっても既存のボードの地形は変わらない。アルゴリズムを変えるときは `gen.v` を上げる（テストに固定値がある）。

## map との関係

同じボードで高さを持つのはどちらか一方。

- ボードに `elevation-field` があれば、地面の高さはこのプラグインのもの。map の高さ（3D の崖・段差）は map のサービスの `setHeightEnabled(false)` で止まり、map は色だけの平らな地図になる。場を消せば map の高さに戻る。
- `groundHeightService` は後から提供した方が勝つので、このプラグインは setup の時点の提供者（map）を受け取り、「場があれば自分、無ければ map」の関数を提供する。**map より後に登録すること。**

## Mode 7

3D ビュー（`view3dService` の `amount() > 0`）の間は、層 `usketch-elevation:mesh`（既定 order 46・`meshOrder` で変えられる、傾けない層）が WebGL2 の canvas 1 枚に標高をメッシュとして描き、地面が本当に盛り上がる。

- 位置は Mode 7 の CSS の傾き `perspective(fov) rotateX(pitch) rotateZ(yaw)` と同じ式を頂点シェーダーで計算する（`projectLifted`）。高さは `h × zoom` px で、キャラや map の崖の持ち上げと同じなので、丘・キャラ・板がずれない。
- 色・等高線・陰影・水面は 2D と同じ設定（HUD の「標高の表示」）。水面は水位で平ら。シードなしの場では高さ 0 の所は透明で、板の地面から丘だけが盛り上がる。
- メッシュが描いている間は 2D の層 `usketch-elevation:ground` は描かない（3D を抜けると戻る）。WebGL2 が使えないときは今まで通り、2D の層が陰影つきの絵として傾く。
- 3D ビューが地面を画面の外まで見せるとき（`bg-grid:set-overscan`）は、その分も描く（上限 `maxOverscanPx`、既定 1200）。
- `createElevationPlugin({ mesh: false })` でメッシュを使わず、2D の層を傾けるだけにできる。
- 層の重なり順は `groundOrder`（2D の層、既定 45）と `meshOrder`（メッシュ、既定 46）で変えられる。既定では map の地面（40）・拠点の範囲（42）・拠点のアイコン（44）より上に描くので、それらを標高の上に出したいときは下げる（例: `{ groundOrder: 40.5, meshOrder: 41.5 }`）。上に出した層は平らな地面のまま描かれ、丘の高さには沿わない。

キャラクター（`@edv4h/usketch-plugin-character`）は 3D ビューで坂に沿って傾き、坂でのジャンプは坂の向きにも跳ぶ。なめらかな坂は段差（`maxStep`）では止まらないので、キャラの `motion.maxSlope` を設定すること（`45` くらいを推奨。web アプリはこの値）。それより急な坂は登れず、ずり落ちる。3D 表示のない Shape も丘の高さに乗る（shape-3d の `limits.groundFlat`）。

制約: Shape やキャラは DOM の層なので、メッシュより常に手前に描かれる（丘の裏に隠れない）。フォグ・描画距離はまだ無い。地面に沿わせたい線や塗り（コース・道など）は、次の「地面のデカール」で描く。

## 地面のデカール

shared の `groundDecals(services)`（`groundDecalService`）に登録した「地面に塗るもの」を、標高の地面そのものに描く。3D ビューでは起伏に沿って曲がり、地面と同じ陰影がつき、丘の裏では地面と一緒に隠れる（DOM の Shape は平らな板のまま・常に手前）。

```ts
import { groundDecals } from "@edv4h/usketch-shared";

const off = groundDecals(ctx.services).set("my-plugin:course", {
	// world 単位で描く（ctx は変換・クリップ済み）。タイルごとに何度も呼ばれるので軽く・純粋に。
	paint(ctx, { rect, pxPerUnit, view }) {
		ctx.strokeStyle = "#3b3b40";
		ctx.lineWidth = 200;
		ctx.stroke(coursePath);
	},
	bounds: () => courseBounds, // 描く範囲（world）。外のタイルは塗らない。省略 = どこでも
	views: ["3d"], // "flat"（平面の地面）/ "3d"（3D の地面）。既定は両方
	order: 0, // 小さいほど下
});
// 中身が変わったら: groundDecals(ctx.services).invalidate("my-plugin:course", changedRect)
```

- レジストリは最初に使った側（デカールを足すプラグイン・この plugin のどちらでも）が provide する。plugin の順番に依存しない。標高の無いボードでは描かれない。
- **3D**: メッシュのタイル（標高と同じ LOD）ごとにデカールを Canvas2D で塗り、テクスチャとして貼る。解像度はそのタイルが画面に映る大きさ（`projectedTilePx`）に合わせた 2 のべき乗（64…1024 px、`decalTilePx`）。遠くはミップマップで粗く、近くは細かい。塗り直しは 1 フレーム 4 タイル・6ms まで（超えた分は次のフレーム。その間は古い絵のまま）。デカールのあるタイルだけがテクスチャを持つ。
- **平面**: 2D の地面の各タイルの上に、デカールの canvas を 1 枚重ねる（地面のタイルの絵は塗り直さない）。2D の層が 3D の代わりに傾いているとき（WebGL2 なし / `mesh: false`）は `"3d"` のデカールを描く。
- 塗り直しは変わった所だけ: `set` / `remove` は新旧の `bounds`、`invalidate` は渡した範囲（省略で `bounds`）にかかるタイルだけを塗り直す（`changedSince`）。
- `paint` が投げたデカールは飛ばす（ほかは描く）。
- 解像度の目安: 既定の場（チャンク 32 × 間隔 16 = 512 units / タイル）で、等倍・近くのタイルは 1〜2 px / unit、ズームアウト・遠くのタイルは粗くなる（道幅 200 なら遠くでも十数 px）。細い線は `pxPerUnit` を見て最小の太さを保つこと。

## 段階

1. データ・無限生成・2D 表示 → 2. ブラシ → 3. Mode 7 の WebGL メッシュ → 4. キャラの急斜面（`maxSlope`）・傾き・坂でのジャンプ（この版）。
