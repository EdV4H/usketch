---
"@edv4h/usketch-plugin-map": minor
---

map: ホスト向け `MapApi` サービスを追加（`getMapApi(app.services)` / #927・#946 の一般化）

これまで #927（tool-state）・#946（無限地形）で場当たりに export していたホスト向け操作を、
`defineService` の標準シームに集約。プラグインが `setup` で `mapService.provide(ctx.services, createMapApi(ctx.store))`
し、ホストは `getMapApi(app.services)?.enableInfiniteTerrain({ seed })` のように、個別 export 名も
store も知らずに駆動できる（プラグイン不在なら `undefined`）。

`MapApi` は store バインド済みの無限地形操作（enable/disable/get/set/isEnabled）＋ reactive
stores（`toolState` / `renderConfig`）を公開。既存の関数/ストア export は後方互換で維持。これが
「操作ロジックは純関数、HUD はそれを呼ぶだけ、ホスト向けは service で公開」規約の参照実装。
