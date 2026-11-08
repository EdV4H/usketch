---
"@edv4h/usketch-plugin-shape-card": minor
---

デッキのシャッフル演出を host が差し込める `shuffleAnimation` を追加した（`createCardPlugin` の既定と `CardTypeDefinition` 個別の両方で指定でき、card-type 側が優先）。シャッフル時に `DeckMeta.shuffledAt`（epoch ms）を記録し、そこから `durationMs` の間だけデッキの描画を `render` の戻り値に差し替える。`shuffledAt` は shape と一緒に同期されるので全員の画面で同じ時刻から再生される。指定しなければ従来どおり動かない。
