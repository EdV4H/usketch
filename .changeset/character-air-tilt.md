---
"@edv4h/usketch-plugin-character": minor
---

feat(character): 車の空中姿勢を追加。`airTilt`（既定 OFF、HUD「空中姿勢」）を ON にすると、空中で W/S が前後（機首下げ / 上げ）、A/D が左右（ロール）に車体を傾け、押し続ければ一回転する。踏み切り時に押していたキーは一度離すまで効かない。跳んだ瞬間は地面の傾きを引き継ぎ、着地時に車体と地面の向きのズレが `landingTolerance`（既定 30°）を超えると速度が `badLandingSpeed`（既定 0.5）倍に落ちる。着地後は地面の傾きへ馴染む。姿勢は `pose.pitch` / `roll`、render props の `pitch` / `roll`（地面の傾きに上乗せする分）、awareness の `attitude` で受け渡す。
