---
"@edv4h/usketch-plugin-presentation": minor
---

feat(presentation): open-slide のデッキを置ける `open-slide` Shape を追加。`createPresentationPlugin({ openSlide: { decks } })` で有効化し、発表では →/Space でデッキ内のページを送ってから次のスライドへ進む。`SlideNavigator` にスライド内ステップ (`getStepCount` / `getCurrentStep` / `hasNext` / `hasPrev`) を追加。
