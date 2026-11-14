# @edv4h/usketch-plugin-shape-3d

Shape に **3D の見た目**（立てる・箱・浮かせる）と**キャラクターとの当たり判定**を付ける HUD と、その操作の純関数のプラグイン。

- データはコアの `ShapeData.view3d`。次のメジャーまでは旧キー `x-shape-3d` にも同じものを書き、読むときは `x-shape-3d` があればそちらを先に読む（古いクライアントはそちらにしか書かないため）。
- 描くのは CSS 3D レンダラー（`@edv4h/usketch-css3d-renderer`）、当たり判定の固体をボードの高さ（`ctx.height`）に登録するのはコア。どちらもこのプラグインが無くても動く（Shape が `view3d` を持っていれば立つし、キャラは当たる）。
- このプラグインは、HUD と、種別の表・描画の上限・「当たり判定は 3D 表示中だけ」の設定を持ち、それをレンダラー（`css3dShapeSourceService`）とコアの固体（`shapeSolidsService`）に渡す。古いコアでは固体を自分で登録する。

## 使い方

```ts
import { createCss3dRendererPlugin } from "@edv4h/usketch-css3d-renderer";
import { createMode7Plugin } from "@edv4h/usketch-plugin-mode7";
import { createShape3dPlugin } from "@edv4h/usketch-plugin-shape-3d";

const app = await createApp({
  plugins: [
    createDomRendererPlugin(),
    createCss3dRendererPlugin(),
    createMode7Plugin({ transition: { durationMs: 900 } }),
    createShape3dPlugin(),
  ],
});
// 種別ごとの 3D はコアで上書きする（例: ポータルは常に立てる）
app.shapes.configureView3d?.("board-portal", { default: { mode: "stand" } });
```

## パラメーター（`ShapeData.view3d`）

```ts
{
  mode: "stand",            // "stand" = 立てる / "box" = 箱 / "float" = 浮かせる
  height: 16,               // box: 箱の高さ / float: 浮かせる高さ（world units、地形 1 段 = 16）。stand では使わない
  facing: "camera",         // stand のみ。"camera" = 常にカメラの方を向く（看板・木）/ "fixed" = 下辺に沿って立つ（塀）
  ground: true,             // 地形（ボードの地面の高さ）に乗る
  shadow: true,             // 影を落とす（stand / float。box は地面に接しているので描かない）
  collision: "none",        // キャラとの当たり判定: "none" / "solid" = 壁（通れない）/ "platform" = 乗れる（box のみ）
}
```

| mode | 見え方 |
|---|---|
| `stand` | 下辺の中点を軸に 90° 起こして立てる |
| `box` | Shape の面を `height` だけ持ち上げて天面にし、四辺に壁を下ろす。壁の色は `style.fill`（なければ灰色）を暗くしたもの |
| `float` | 面をそのまま `height` だけ持ち上げる。下に影 |

足りない項目は既定値で埋まり、不正な値は捨てられる（shared の `normalizeShapeView3d`）。`height` の既定は box 16 / float 24 で、0…2000 にクランプする。保存されるのは指定した `height` だけなので、box と float を切り替えるとそれぞれの既定の高さになる（`storedShapeView3d`）。

### 種別ごとの設定

種別は自分の 3D を `ShapeDefinition.view3d`（`modes` / `default` / `render3d`）で宣言し、ホストは `ctx.shapes.configureView3d(type, view3d)` で上書きする。

- 何も宣言しない種別は `stand` / `float` だけ。楕円や手描き線を箱にすると不自然なため、`box` は箱の形に合う種別だけ。
- 3 種すべて使える: `rectangle` / `rounded-rect` / `sticky` / `card` / `frame` / `image`。
- 対象外（`modes: []`）: `embed` / `openui`。
- `default`: Shape が `view3d` を持たないときの既定（関数で Shape ごとに決めてもよい）。例: `{ default: { mode: "stand" } }` でポータルを常に立てる。
- `render3d`: 種別の自前の 3D 表現。あれば汎用の stand / box / float の代わりに使う（`null` を返すとその Shape は汎用の描画）。

`createShape3dPlugin({ types })`・`registerType`・組み込みの表 `DEFAULT_SHAPE_3D_TYPES` も次のメジャーまで使える（宣言の上に重なる。重なり順: 組み込みの表 → 宣言＋上書き → `types` → `registerType`）。

### `render3d`（種別の自前の 3D 表現）

```ts
import { crossRender3d } from "@edv4h/usketch-plugin-shape-3d";

// 立てた画像を十字の 2 枚板で描く（木・草のスプライト）
app.shapes.configureView3d?.("image", { render3d: crossRender3d });
```

レンダラーの層は Shape の大きさのノードを足元（stand）または中心に置き、地形の高さまで持ち上げて Shape 自身の向きに回し（`preserve-3d`）、その中に `render3d` の戻り値を描く。ノードの地面は z = 0。`render3d(shape, ctx)` の `ctx`（shared の `ShapeView3dRenderContext`）:

| 項目 | 内容 |
|---|---|
| `params` / `amount` / `zoom` | 解決済みのパラメーター、遷移量（0 では平面に描くこと）、画面 px / world unit |
| `width` / `height` | ノードの大きさ（画面 px） |
| `faceCamera` | カメラの方を向くために足す `rotateZ` の角度（遷移量込み） |
| `content` | Shape 自身の描画（ノードいっぱい）。何度使ってもよい |
| `camera()` / `subscribe()` | 描画中のカメラ（pitch / yaw / fov）とその変更通知。three.js などの canvas を Mode 7 のカメラに合わせて描くときに使う（React を再描画せずに canvas だけ更新できる） |

three.js を使う場合は依存をその Shape プラグイン側に持ち、`import()` で遅延読み込みし、WebGL コンテキストは 1 つを共有するのがおすすめ（ブラウザが同時に持てる数に上限があるため）。

### 当たり判定（`collision`）

キャラクターとの当たり判定。既定は `"none"`（すり抜ける）。mode ごとに使えるものが決まっていて（`COLLISIONS_BY_MODE`）、使えない値は `effectiveCollision` で読み替える（保存値はそのままなので、mode を戻すと元に戻る）。

| mode | 当たる範囲 | `solid`（壁） | `platform`（乗れる） |
|---|---|---|---|
| `box` | Shape の矩形全体（回転込み） | 通れない | 天面（地形の高さ＋`height`）に乗れる。段差が `maxStep` 以下なら歩いて上がれ、高ければジャンプで乗る |
| `stand`（`facing: "fixed"`） | 下辺に沿った厚さ 8 の帯（塀） | 通れない | 天面がないので壁扱い |
| `stand`（`facing: "camera"`） | 足元の円（半径 = 幅 / 4、最小 4） | 通れない | 壁扱い |
| `float` | なし（宙に浮いている） | — | — |

- 既定では 2D 表示中も当たる（キャラは 2D でも歩けるので）。HUD の「当たり判定は 3D 表示中だけ」（`limits.collisionIn3dOnly`）で 3D ビュー中だけにできる。
- 当たり判定は描画の制限（最大数・最小サイズ・描画距離）とは無関係に、全 Shape に効く。Shape は 256 単位のグリッドに振り分けて引くので、数が多くても 1 点の問い合わせは軽い。
- 判定の本体は shared の純関数（`colliderFor` / `buildColliderIndex` / `solidHeightAt`）で、コアが `createShapeSolids` でボードの高さに登録する。

## 見え方（CSS 3D レンダラー）

- 3D ビューのせり上がり（遷移量 0…1）に合わせて、stand は足元（下辺の中点）を軸に起き上がり、box / float は中心を基準に `height` までせり上がる。OFF にすると平面に戻り、平面の描画に切り替わる。
- `facing: "camera"` はカメラの旋回（yaw）を打ち消して常に正面を向く。`"fixed"` は Shape 自身の回転のまま。box / float は常に Shape 自身の回転。
- **3D パラメーターを持たない Shape も地形の高さに乗る**（`limits.groundFlat`、既定オン）。中心の地面の高さ（ボードの高さの窓口の `groundAt`）が 0 より上なら、その Shape は平らなまま、その高さまで持ち上がる（`GROUND_FLAT_PARAMS` = 高さ 0 の `float`、影なし）。地面が 0 の所の Shape は今まで通り平面の層のまま。中心の高さで平らに乗るので、斜面に沿って曲がりはしない。`modes` に `float` が無い種別（`embed` / `openui` など）は対象外。HUD の「3D 表示のない Shape も地形の高さに乗せる」で切れる。
- 描画距離の外（地面が描かれていない所）、画面上で小さすぎるもの（既定 8px 未満）、全体 LOD 中は立てない。数は手前から最大 200 個（HUD で変更可）。

## HUD

- **3D（選択中の Shape）**: 3D 表示（なし / 立てる / 箱 / 浮かせる。選択中の種別で使えるものだけ）、高さ（箱・浮かせる）、向き（立てる）、地形に乗せる、影、当たり判定（なし / 壁 / 乗れる。選択中の mode で使えるものだけ）。2D で選んで設定し、Mode 7 で見る。
- **3D 表示（全体）**: 3D にする最大数、最小サイズ(px)、当たり判定は 3D 表示中だけ、3D 表示のない Shape も地形の高さに乗せる。

## サービス API

```ts
import { getShape3dApi } from "@edv4h/usketch-plugin-shape-3d";
const api = getShape3dApi(app.services);
api?.set(["shape-1"], { mode: "stand", facing: "fixed" });
api?.set(["shape-2"], { mode: "box", height: 32, collision: "platform" });
api?.clear(["shape-1"]);
api?.registerType("sticky", { modes: [] }); // 実行時に種別の設定を足す（戻り値で取り消し）
```

`Shape3dApi`: `get` / `resolve` / `set` / `clear` / `modesFor` / `registerType` / `getLimits` / `setLimits`。

操作の本体は `BoardStore` を受け取る純関数（`setShapeView3d` / `clearShapeView3d` / `getShapeView3d`）としても export している。`setShapeView3d` の第 4 引数は種別の表か `(type) => ctx.shapes.getView3d?.(type)` のような引き当て（既定は組み込みの表）。旧名 `setShape3d` などは次のメジャーまで残す。

## 既知の制約

- CSS 3D レンダラーはレイヤーごとに別の 3D 空間で描くので、重なりはレイヤー順になる（崖 ＜ 3D Shape ＜ キャラ）。看板の後ろを歩くキャラも看板より手前に見える。
- ズームアウトで map が崖を描かない表示でも、`ground: true` の Shape は地形の高さに乗るので浮いて見えることがある。
