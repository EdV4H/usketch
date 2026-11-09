# @edv4h/usketch-plugin-shape-3d

Mode 7（`@edv4h/usketch-plugin-mode7`）などの 3D ビュー中に、**3D パラメーターを持つ Shape を地面から立ち上げて描く**プラグイン（立てる・箱・浮かせるの 3 種）。パラメーターを持たない Shape は今まで通り地面に貼り付いたまま。2D 表示・書き出し・編集には一切影響しない（3D ビューでないときは何も描かない）。

- 描画は map の崖やキャラクターと同じ **CSS 3D だけ**（`translateZ` / `rotateX(-90deg)` / `rotateY(90deg)` の折り曲げ）。3D ライブラリには依存しない。
- 各 Shape プラグインの既存の `render` をそのまま立てるので、全 Shape 種別で使える。
- Mode 7 にも map にも依存しない。3D ビューの状態は shared の `view3dService`、地面の高さは `groundHeightService` から読み、DOM の Shape 層には `renderer:hide-shapes` で「この Shape は描かない」を伝える。
- 当たり判定（`collision`）を持つ Shape は shared の `solidHeightService` で「ここに立体がある」を答える。キャラクター（`@edv4h/usketch-plugin-character`）はそれを見て壁で止まり、乗れる箱に乗る。

## 使い方

```ts
import { createMode7Plugin } from "@edv4h/usketch-plugin-mode7";
import { createShape3dPlugin } from "@edv4h/usketch-plugin-shape-3d";

createApp({
  plugins: [
    // …
    createMode7Plugin({ transition: { durationMs: 900 } }),
    createShape3dPlugin({
      // 種別ごとの設定（任意）。既定は下の「種別ごとの設定」を参照
      types: {
        "board-portal": { default: { mode: "stand" } }, // ポータルは常に立てる
      },
    }),
    createDomRendererPlugin(),
  ],
});
```

Mode 7 の既定の tilt / depth レイヤー（`DEFAULT_TILT_LAYER_IDS` / `DEFAULT_DEPTH_LAYER_IDS`）には、このプラグインの層 `shape-3d` が入っている。`tiltLayerIds` / `depthLayerIds` を上書きしている場合は `shape-3d` を両方に足すこと（depth に入っていないと平面に潰れる）。

## パラメーター（`x-shape-3d`）

Shape データの拡張キー `x-shape-3d`（`SHAPE_3D_KEY`）に置く。コアの `ShapeData` の型は変えていない。同期でそのまま全員に配られる。

```ts
{
  mode: "stand",            // "stand" = 立てる / "box" = 箱 / "float" = 浮かせる
  height: 16,               // box: 箱の高さ / float: 浮かせる高さ（world units、地形 1 段 = 16）。stand では使わない
  facing: "camera",         // stand のみ。"camera" = 常にカメラの方を向く（看板・木）/ "fixed" = 下辺に沿って立つ（塀）
  ground: true,             // 地形（groundHeightService）の高さに乗る
  shadow: true,             // 影を落とす（stand / float。box は地面に接しているので描かない）
  collision: "none",        // キャラとの当たり判定: "none" / "solid" = 壁（通れない）/ "platform" = 乗れる（box のみ）
}
```

| mode | 見え方 |
|---|---|
| `stand` | 下辺の中点を軸に 90° 起こして立てる |
| `box` | Shape の面を `height` だけ持ち上げて天面にし、四辺に壁を下ろす。壁の色は `style.fill`（なければ灰色）を暗くしたもの |
| `float` | 面をそのまま `height` だけ持ち上げる。下に影 |

足りない項目は既定値で埋まり、不正な値は捨てられる（`normalizeShape3d`）。`height` の既定は box 16 / float 24 で、0…2000 にクランプする。保存されるのは指定した `height` だけなので、box と float を切り替えるとそれぞれの既定の高さになる（`storedShape3d`）。

### 種別ごとの設定

`createShape3dPlugin({ types })` で種別ごとに使える mode と既定を渡せる（`DEFAULT_SHAPE_3D_TYPES` に上書きでマージ）。

- 何も指定しない種別は `stand` / `float` だけ（`DEFAULT_TYPE_MODES`）。楕円や手描き線を箱にすると不自然なため、`box` は箱の形に合う種別だけ。
- 既定で 3 種すべて使える: `rectangle` / `rounded-rect` / `sticky` / `card` / `frame` / `image`。
- 対象外（`modes: []`）: `embed` / `openui`。

種別ごとに渡せるもの（`Shape3dTypeConfig`）:

- `modes`: 使える mode。`[]` で対象外。
- `default`: Shape が `x-shape-3d` を持たないときの既定（関数で Shape ごとに決めてもよい）。例: `{ "board-portal": { default: { mode: "stand" } } }` でポータルを常に立てる（web の community ページはこの設定）。
- `render3d`: 種別の自前の 3D 表現。あれば汎用の stand / box / float の代わりに使う（`null` を返すとその Shape は汎用の描画）。

### `render3d`（種別の自前の 3D 表現）

```ts
import { crossRender3d, type Shape3dRender } from "@edv4h/usketch-plugin-shape-3d";

createShape3dPlugin({
  types: {
    image: { render3d: crossRender3d }, // 立てた画像を十字の 2 枚板で描く（木・草のスプライト）
  },
});
```

レイヤーは Shape の大きさのノードを足元（stand）または中心に置き、地形の高さまで持ち上げて Shape 自身の向きに回し（`preserve-3d`）、その中に `render3d` の戻り値を描く。ノードの地面は z = 0。`render3d(shape, ctx)` の `ctx`（`Shape3dRenderContext`）:

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
- 判定の本体は純関数（`colliderFor` / `buildColliderIndex` / `solidHeightAt`）として export している。

## 見え方

- 3D ビューのせり上がり（遷移量 0…1）に合わせて、stand は足元（下辺の中点）を軸に起き上がり、box / float は中心を基準に `height` までせり上がる。OFF にすると平面に戻り、平面の描画に切り替わる。
- `facing: "camera"` はカメラの旋回（yaw）を打ち消して常に正面を向く。`"fixed"` は Shape 自身の回転のまま。box / float は常に Shape 自身の回転。
- **3D パラメーターを持たない Shape も地形の高さに乗る**（`limits.groundFlat`、既定オン）。中心の地面の高さ（`groundHeightService`）が 0 より上なら、その Shape は平らなまま、その高さまで持ち上がる（`GROUND_FLAT_PARAMS` = 高さ 0 の `float`、影なし）。地面が 0 の所の Shape は今まで通り平面の層のまま。中心の高さで平らに乗るので、斜面に沿って曲がりはしない。`modes` に `float` が無い種別（`embed` / `openui` など）は対象外。HUD の「3D 表示のない Shape も地形の高さに乗せる」で切れる。
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

操作の本体は `BoardStore` を受け取る純関数（`setShape3d` / `clearShape3d` / `getShape3d`）としても export している。

## 既知の制約

- Mode 7 はレイヤーごとに別の 3D 空間で描くので、重なりはレイヤー順になる（崖 ＜ 3D Shape ＜ キャラ）。看板の後ろを歩くキャラも看板より手前に見える。
- ズームアウトで map が崖を描かない表示でも、`ground: true` の Shape は地形の高さに乗るので浮いて見えることがある。
