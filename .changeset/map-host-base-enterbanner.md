---
"@edv4h/usketch-plugin-map": minor
---

拠点編集 API の公開 (#992) と EnterBanner のヘッドレス化 (#993)。

**#992 拠点編集を host に公開**: 拠点のミューテーション op を index から export — `createBase` / `setBeacon` / `deleteBase` / `setBaseRadius` / `setBaseIcon`（すべて Undo 対応）と型 `BaseDeps`（`{ store, commands, tile }`）。あわせて半径連動アイコンのプレビュー用に `baseIconFor` / `effectiveBaseIcon` / `BASE_ICON_TIERS`、既定半径 `DEFAULT_BASE_RADIUS` も公開。host は `baseStateStore.activeBaseId` と組み合わせ、DS 独自の拠点エディタ（半径スライダ + `ICONS` を使ったアイコン上書きグリッド）を組める。

**#993 EnterBanner のヘッドレス化**: エリア入場トースト + 現在地インジケータを `territory.enterBanner.render` フックに委譲。プラグインは「ビューポート中心がいる拠点 + 入場遷移」の追跡を担い、host は見た目だけを返す（新 `EnterBannerState` 型: `current` / `entered` / `enteredKey`）。フック未指定なら EnterBanner は描画されない（region/label と同じ headless 方針）。デモアプリ(community) は `stockTerritoryStyle` に reference 実装を持ち従来の見た目を維持。
