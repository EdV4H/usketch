---
"@edv4h/usketch-plugin-shape-freedraw": minor
---

Freedraw プラグインをペンツール設計書に沿って大幅刷新。4種のペン・筆圧シミュレーション・
色/太さ・オブジェクト単位消しゴム・ペン先カーソルを追加（描画はベクター SVG）。

- **4ペン**: ボールペン / サインペン（一定幅）、筆ペン（速度→疑似筆圧で可変幅、perfect-freehand）、
  蛍光ペン（半透明 + `mix-blend-mode: multiply`）。一定幅は中点二次ベジェで平滑化。
- **色/太さ**: プリセット8色 + カスタム色、ペン種別ごとに独立した太さ。
- **消しゴム**: 触れた freedraw ストロークを丸ごと削除（1ドラッグ=1 undo）。
- **UI**: プラグイン自前の最小フローティングパレット + ペン先カーソル（Vim-first でも動作）。
  `freedraw:set-pen|set-color|set-size|toggle-eraser` イベントで外部（vim 等）から操作可能。
- データモデルは後方互換: `points` を `{x,y,p?}` に拡張し `pen` を追加。旧ストロークは
  ボールペン一定幅として描画される。確定時に RDP 間引きで点数を削減。
- `createFreedrawPlugin(config?)` で既定ペン/色/太さ/筆圧感度などを指定可能（Zod 検証）。
