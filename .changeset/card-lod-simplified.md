---
"@edv4h/usketch-plugin-shape-card": minor
---

card-type ごとに LOD（低ズーム）簡易表示を渡せるようにした（#631）。

- `CardTypeDefinition.renderSimplified?(fields)` を追加。指定すると、その card-type のカード / デッキの低ズーム表示に使われる。`renderFront` と同様、plugin がカード枠（world 座標へ self-position）を用意するので、card-type 側は枠内の中身だけを返せばよい。
- plugin が `card` / `card-deck` の `ShapeDefinition.simplifiedComponent` へ配線:
  - `card`: その shape の `meta.cardType` の `renderSimplified` を使用。
  - `card-deck`: 一番上のカード（`cards[0]`）の fields で `renderSimplified` を呼ぶ。
  - `renderSimplified` 未定義 / 空デッキ / 未知 card-type のときは従来どおりグレー矩形（`shape.style.fill`）にフォールバック。
- 組込みの EXAMPLE card-type（media / playing-card / uno）に `renderSimplified` を実装し、引きでも種別が判別できるようにした。

これにより、LOD 簡易表示のために利用側が shape 定義を再 register する回避策が不要になる（#625 / #626 と合わせて、カード関連の shape 定義上書きは解消）。
