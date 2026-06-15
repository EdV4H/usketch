---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
---

`StoreEvent` を型付きの判別ユニオンにし、`shape:updated` に before/after を載せるようにした（#615）。

- `StoreEvent` は `shape:added` / `shape:removed` / `shape:updated` を型付きメンバとして持つ判別ユニオンに（その他のミューテーションは従来どおり汎用フォールバック）。`event.type` で絞り込むと `payload` が型付けされる。
- シェイプ系イベントの payload を `ids: string[]` に正規化（後方互換のため単一 `id` も併載）。
- `shape:updated` に `before` / `after`（変更前後の `ShapeData`）を追加。親の移動に子を追従させる等の購読側が、自前で前回位置を保持しなくても差分を取れるようになり、ドラッグ初手のデルタ取りこぼし（first-step-miss）を防げる。
- 既存の `event.payload as { id }` 形の購読はそのまま動作（後方互換）。
