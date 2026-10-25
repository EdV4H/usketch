---
"@edv4h/usketch-plugin-shape-basic": minor
"@edv4h/usketch-shared": minor
"@edv4h/usketch-tool-helpers": minor
---

矢印図形に `direction`（right / left / up / down）を追加し、ドラッグで作成するときにドラッグ方向から向きを自動で決めるようにした。矢じりの長さを太さ基準（`min(太さ × 0.8, 長さ)`）にして、リサイズしても軸だけが伸び縮みするようにした。`ShapeDefinition.flip` を追加し、リサイズで bounds が反転したときに呼ぶ（軸は図形のローカル座標。複数選択で回転した図形には `toLocalFlipAxes` で近い軸に読み替えて渡す）。矢印は自分の軸方向に反転したときに向きを入れ替える。リサイズを cancel したときに `flip` が足したフィールドも元に戻すようにした。

**見た目の変更**: 既存の矢印も矢じりの長さが新しい計算になる。120×60 は従来と同じだが、横長の矢印（例: 300×60）は矢じりが短くなり、縦長の矢印（例: 40×100）は軸がなくなって三角形になる。
