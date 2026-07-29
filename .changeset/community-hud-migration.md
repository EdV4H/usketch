---
"@edv4h/usketch-plugin-map": minor
"@edv4h/usketch-plugin-reactions": minor
"@edv4h/usketch-plugin-voting": minor
"@edv4h/usketch-plugin-shape-group": minor
"@edv4h/usketch-plugin-canvas-filter": minor
"@edv4h/usketch-plugin-avatar": minor
---

各プラグインの独自 UI を Control HUD（`ctx.actions` / `ctx.hud.registerSettings`）へ移行し、オンキャンバスの独自コントロールを削減。

- map: `MapPalette` / `RangeErasePalette` を撤去し、モード・地形・アイコン・領域塗りの除外・生成・拠点・範囲消去対象を HUD の settings/actions に移行（`registerMapHud`）。マップツールのキャンバス操作は不変。
- reactions: 絵文字選択を HUD action 化（数字キーは維持）。
- voting: 「投票を作成」を HUD の param-form action に。
- shape-group: グループ化/解除を HUD action に（選択状態で活性、ショートカット維持）。
- canvas-filter: 常設インジケータを撤去し、フィルタ設定を開く/解除/タイムトラベル終了を HUD action に。
- avatar: ツール切替と重複するラジアルメニューを撤去（ツール切替は HUD のツール一覧に一本化）。アバター描画は不変。
