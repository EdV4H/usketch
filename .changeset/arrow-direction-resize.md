---
"@edv4h/usketch-plugin-shape-basic": minor
"@edv4h/usketch-shared": minor
"@edv4h/usketch-tool-helpers": minor
---

矢印図形に `direction`（right / left / up / down）を追加し、ドラッグで作成するときにドラッグ方向から向きを自動で決めるようにした。矢じりの長さを太さ基準（`min(太さ × 0.8, 長さ)`）にして、リサイズしても軸だけが伸び縮みするようにした。`ShapeDefinition.flip` を追加し、リサイズで bounds が反転したときに呼ぶ。矢印は自分の軸方向に反転したときに向きを入れ替える。
