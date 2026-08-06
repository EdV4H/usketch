---
"@edv4h/usketch-plugin-shape-card": minor
---

デッキのユーティリティアクションを追加（Control HUD の Card グループに自動表示）

- **Draw cards to board**（既定5枚・枚数パラメータ）: 山札上から N 枚を場に1列で展開。
- **Draw to hand**（既定1枚・枚数パラメータ）: 山札上から N 枚を場に出さず直接ローカル手札へ。
- **Spread deck**: 山札の全カードを回転なし・等間隔の折り返しグリッドで場に展開し、山札を空にする。

いずれも単一コマンドで Undo/Redo 可能。純関数 `drawN`（deck.ts）と `gridPositions`（geometry.ts）を追加。
