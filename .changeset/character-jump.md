---
"@edv4h/usketch-plugin-character": minor
---

feat(character): ジャンプを追加（`jump` オプション / HUD「ジャンプ（Space）」「ジャンプの高さ」/ `api.jump()`）。足元の高さ `z` を持つ縦方向の物理（重力・小ジャンプ・先行入力・コヨーテ時間）で、ジャンプ中は段差制限を足元から測るので高い崖にも乗れる。`maxStep` を超える落差は重力で落ちる。影を地面に置く `renderShadow` スロットを追加し、Mode 7 では本体が影から浮く。render props に `z` / `altitude` / `airborne` / `verticalSpeed`、awareness に `z` / `airborne` / `vz` を追加
