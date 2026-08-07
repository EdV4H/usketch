---
"@edv4h/usketch-plugin-shape-card": minor
---

カード手札を headless 化：host が独自の手札 UI を作れるように（#915）

手札の状態（localStorage 永続・awareness 枚数共有・`card:*` アクション/イベント）はプラグインが持ちつつ、UI を host が差し替えられるようにした。後方互換（既定は現行どおり HUD の Hand パネルを出す）。

- `CreateCardPluginOptions.hand` を追加:
  - `ui: "hud" | "none"`（既定 `"hud"`）— `"none"` で内蔵手札UIを一切登録しない（headless）。
  - `store`— host 生成の `HandStore` を注入し**同一インスタンス共有**（同一タブでも `subscribe` が発火）。
  - `onStore(store)` — プラグインが使う `HandStore` 実体を host へ渡す。
- `createHandStore` / `HandStore` / `HandCardEntry` / `CardHandAwareness` を `index.ts` から export。
- `card:to-hand` / `card-deck:draw-to-hand` / `card:play-from-hand` は headless でも従来どおり機能。
