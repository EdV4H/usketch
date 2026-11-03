---
"@edv4h/usketch-plugin-bg-liquid": minor
---

`@edv4h/usketch-plugin-bg-liquid` を新規追加。ボード一面に粘性の高い液体が敷き詰められ、
ゆっくり流動しながら、指定したシェイプに押しのけられる背景プラグイン。

- ワールド固定の高さ場シミュレーション（押しのけ＝体積保存で外周へ移送、粘性流＝固体を避ける拡散＋静止水位への復元）。
  シェイプが通った跡の溝は粘度に応じてじわじわ埋まる。
- 1 セル 1 ピクセルの bitmap を陰影付け（拡散光＋光沢ハイライト）して拡大描画。輪郭は符号付き距離場によるメニスカスで滑らか。
- grid / dots と共通の `bg:set`（`{ type: "liquid" }`）で切替。HUD に設定（表示 / 押しのけ対象モード / 粘度 / 流れ / 色）と
  「選択シェイプで液体を押しのける（切替）」アクションを登録。
- 押しのけ対象は `shape.meta.liquidDisplacer` で指定（`mode: "all"` で全シェイプ）。
- ホスト API を `liquidBgService`（`defineService`）で公開。純関数 `setLiquidDisplacer` / `toggleLiquidDisplacer` も export。
