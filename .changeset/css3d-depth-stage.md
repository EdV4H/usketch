---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-css3d-renderer": minor
"@edv4h/usketch-plugin-elevation": minor
---

3D 表示で、層をまたいで奥行きどおりに重ねる「奥行きステージ」を実験的に追加しました（3D 標準対応 P6a）。既定はオフで、今の見た目は変わりません。

- **shared**: 層の 3D での見え方 `LayerView3d` に `ground`（自分で地面を描く層。傾けず、奥行きで並べるレンダラーでは地面に立つものより奥に置く）を追加しました
- **css3d-renderer**: `setDepthStage(on)` / `isDepthStage()`、オプション `depthStage` / `hud`、HUD の設定「奥行きで重ねる（実験）」を追加しました。オンにすると、立てた看板の後ろにいるキャラクターが看板に隠れるなど、傾けた層の中身が層の順ではなく実際の奥行きで重なります。純関数 `depthStageRules` も公開します
- **elevation**: 3D の地形メッシュの層が `view3d: "ground"` を宣言します
