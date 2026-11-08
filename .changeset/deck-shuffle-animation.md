---
"@edv4h/usketch-plugin-shape-card": minor
---

デッキのシャッフル演出を host が差し込める `shuffleAnimation` を追加した（`createCardPlugin` の既定と `CardTypeDefinition` 個別の両方で指定でき、card-type 側が優先）。シャッフル時に `DeckMeta.shuffledAt`（epoch ms）を記録し、そこから `durationMs` の間だけ山札の厚みと一番上のカードを `render` の描画に差し替える（外枠と残枚数バッジはそのまま）。`shuffledAt` は shape と一緒に同期されるので全員の画面で同じ時刻から再生される。ドローでは `shuffledAt` を残し、シャッフルの Undo では消す（取り消しで演出を出さない）。1 枚以下のデッキのシャッフルは何もしない（同期も Undo 履歴も増やさない）。`render` は要素として描くので hooks を使える。指定しなければ従来どおり動かない。
