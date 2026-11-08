# @edv4h/usketch-plugin-shape-freedraw

ホワイトボード用の「描く」体験を提供するフリーハンド（ペン）プラグイン。
4種のペン、筆圧シミュレーション、色/太さ、オブジェクト単位の消しゴム、ペン先カーソルを備える。
描画はベクター SVG なのでズームしても鮮明で、選択/移動/リサイズ・undo・同期と整合する。

## 使い方

```ts
import { createFreedrawPlugin } from "@edv4h/usketch-plugin-shape-freedraw";

const plugins = [
  // ...
  createFreedrawPlugin({
    defaultPen: "ballpoint",
    brushDynamics: 60,     // 筆圧の効き 10..100
    cursorPreview: true,
  }),
];
```

ツール ID は `freedraw-draw`。`store.setActiveToolId("freedraw-draw")` でアクティブにすると、
画面下部に最小パレット（ペン種別 / 消しゴム / 色 / 太さ）が表示される。`Esc` で既定ツールへ戻る。

## ペン（設計書 §3）

| ペン | 既定太さ | 線幅 | 不透明度 | 合成 |
| --- | --- | --- | --- | --- |
| ボールペン | 2.5 | 一定 | 1.0 | normal |
| サインペン | 6 | 一定 | 1.0 | normal |
| 筆ペン | 11 | 可変（速度→疑似筆圧） | 1.0 | normal |
| 蛍光ペン | 22 | 一定 | 0.4 | multiply |

一定幅ペンは中点を通る二次ベジェで平滑化、筆ペンは perfect-freehand で塗りアウトラインを生成。
蛍光ペンは要素単位合成のため、同一ストローク内の交差は二重に濃くならず別ストローク同士は濃くなる。

## 外からペンを足す

組み込みの 4 種に、別のプラグインやホストがペンを足せる。足したペンのストロークも `freedraw`
shape なので、選択・移動・拡大縮小（点列だけを伸ばし、太さは変えない）・消しゴム・当たり判定・
undo・同期はそのまま効く。描画は SVG で、GPU には回さない。

```tsx
createFreedrawPlugin(undefined, {
  pens: [
    {
      id: "road",                     // shape の pen に入る。組み込みの id とは重ねない
      label: "道路",
      defaultSize: 120,
      sizeRange: { min: 40, max: 400 }, // freedraw:set-size をこの範囲に丸める
      usesColor: false,               // ペン先カーソルを色なしで出す
      render: (shape) => <Road shape={shape} />,
      renderDraft: (shape) => <path d={...} />, // 描いている最中（shape.draft === true）
      finalize: (points, { size }) => ({ points: tidy(points), penData: { closed: true } }),
      halfWidth: (size) => size / 2 + 12, // 外接矩形・当たり判定・消しゴムの半幅
    },
  ],
});
```

ペンは shape の描画と当たり判定に効くので、実行中に足し外しせず、プラグインの引数で渡す。
`getFreedrawApi(app.services)?.listPens()`（または `listPens()`）は組み込み → 足したペンの順で
一覧を返すので、ペン選択 UI はこれで作れる。`finalize` が返す `penData` は移動・拡大縮小でそのまま
写されるので、座標は入れない（点列から毎回作る）。
ペンを登録していないクライアントでは、そのストロークはボールペンの線（色・太さはそのまま）で描かれる。

## 線の端をつなぐ

`endpointSnap: true`（または `freedraw:set-endpoint-snap` `{enabled}`）のとき、手を離した線の
始点・終点が**同じペン**の近くの線に入っていたら、その線のいちばん近い点まで線を伸ばしてつなぐ。
Ctrl / ⌘ を押しながら離すと、その線だけ有効・無効が逆になる。つないだ端は shape の
`joins`（`{ start?: true, end?: true }`）に残るので、足したペンの描画はそれを見て端の飾りを省ける。
つなぐ距離は、画面上の 12px + 線の太さの半分。足したペンは `snapDistance(size)` で決められ、
`finalize` が `snapEnds: false` を返した線（端が無い周回など）はつながない。

## 消しゴム

`mode: "eraser"` のとき、触れた freedraw ストロークを丸ごと削除する（ピクセル消去ではない）。
1ドラッグぶんの削除は1アクションとして undo できる。

## データモデル

```ts
type PenKind = "ballpoint" | "felt" | "brush" | "highlighter";
type PenId = PenKind | string; // 外から足したペンの id も入る
interface StrokePoint { x: number; y: number; p?: number } // p=疑似筆圧 0..1
interface FreedrawShapeData extends ShapeData {
  points: StrokePoint[];
  pen?: PenId; // 省略時 ballpoint（旧データ後方互換）
  penData?: Record<string, unknown>; // 足したペンの finalize が返したデータ
  draft?: boolean; // 描いている最中だけ true
  joins?: { start?: true; end?: true }; // 端を近くの線へつないだか（endpointSnap）
}
```

色 = `style.stroke` / 太さ = `style.strokeWidth` / 不透明度 = `style.opacity`。

## 外部連携イベント

`ctx.events.emit` で設定を操作できる（vim プラグインの ex コマンド等から）:
`freedraw:set-pen` `{pen}` / `freedraw:set-color` `{color}` / `freedraw:set-size` `{size}` /
`freedraw:toggle-eraser` / `freedraw:set-endpoint-snap` `{enabled}`。
