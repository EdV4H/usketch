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

## 消しゴム

`mode: "eraser"` のとき、触れた freedraw ストロークを丸ごと削除する（ピクセル消去ではない）。
1ドラッグぶんの削除は1アクションとして undo できる。

## データモデル

```ts
type PenKind = "ballpoint" | "felt" | "brush" | "highlighter";
interface StrokePoint { x: number; y: number; p?: number } // p=疑似筆圧 0..1
interface FreedrawShapeData extends ShapeData {
  points: StrokePoint[];
  pen?: PenKind; // 省略時 ballpoint（旧データ後方互換）
}
```

色 = `style.stroke` / 太さ = `style.strokeWidth` / 不透明度 = `style.opacity`。

## 外部連携イベント

`ctx.events.emit` で設定を操作できる（vim プラグインの ex コマンド等から）:
`freedraw:set-pen` `{pen}` / `freedraw:set-color` `{color}` / `freedraw:set-size` `{size}` /
`freedraw:toggle-eraser`。
