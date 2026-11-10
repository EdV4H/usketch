---
"@edv4h/usketch-plugin-character": minor
---

feat(character): 空中制御を追加。`jump.airControl`（0〜1、既定 0.5、HUD「空中制御」）で、空中では跳んだ勢い（`pose.moveVx` / `moveVy`）が残り、方向移動はキーの方向へ少しずつ寄せられ、車は地上の `airControl` 倍で曲がれる（スロットル・ブレーキは効かない）。0 = 弾道どおり、1 = 地上と同じ。描画用に `controlScheme` を render props に追加し、awareness でも送る（古いクライアントは `"directional"`）。
