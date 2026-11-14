---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-plugin-mode7": patch
"@edv4h/usketch-plugin-elevation": patch
---

3D 表示の投影をコアの 1 か所にまとめた（3D 標準対応の P1、#1304）:

- shared: Mode 7 の投影の純関数を追加。`projectStagePoint` / `unprojectStagePoint`（傾ける前の画面の px）、`projectWorld` / `unprojectWorld`（world 座標と高さ）、凹凸のある地面でポインターの下の地点を探す `unprojectOnGround`、層の CSS の `tiltCss`、シェーダー用の 4×4 行列 `viewMatrix`（タイルの角などを原点にでき、遠くの座標でも float32 の精度を落とさない）。
- mode7: `projectToGround` / `unprojectFromGround` / `tiltOrigin` / `tiltTransform` は shared の関数を使うようにした（名前と結果は同じ）。
- elevation: Mode 7 のメッシュの頂点シェーダーを shared の `viewMatrix` に置き換え、`projectLifted` も shared の関数を使うようにした（絵は同じ）。
