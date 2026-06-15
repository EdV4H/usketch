---
"@edv4h/usketch-shared": major
"@edv4h/usketch-store": major
---

`StoreEvent` を型付きの判別ユニオンにし、`shape:updated` に before/after を載せるようにした（#615）。

**Breaking changes**: `StoreEvent` がオープンな `{ type: string; payload?: unknown }` から閉じたリテラル union になったため、未知の `type` 比較（例: `event.type === "foo"` が TS2367）や `StoreEvent` を自前で構築していたコードはコンパイルエラーになり得る。`BoardStore.updateShape` の `updates` も `Partial<Omit<ShapeData, "id">>` に絞られたため、`updateShape(id, { id })` のような呼び出しは型エラーになる。

- `StoreEvent` を store が発行する全イベント種別（`shape:added` / `shape:removed` / `shape:updated` / `selection:changed` / `tool:changed` / `default-tool:changed` / `shapes:z-index-initialized` / `viewport:changed` / `style:changed`）を網羅する**閉じた**判別ユニオンに変更。オープンな文字列フォールバックは持たない（混ぜると `"shape:updated"` も `string` に代入可能になり narrowing が効かなくなるため）。`event.type` で絞り込むと `payload` が正しく型付けされる。
- `type` リテラルの型 `StoreEventType` を追加・エクスポート。
- シェイプ系イベントの payload を `ids: string[]` に正規化（後方互換のため単一 `id` も併載）。
- `shape:updated` の payload に `before` / `after`（変更前後の `ShapeData`）を追加し、`ShapeChange` 型として切り出してエクスポート。親の移動に子を追従させる等の購読側が、自前で前回位置を保持しなくても差分を取れるようになり、ドラッグ初手のデルタ取りこぼし（first-step-miss）を防げる。
- 既存の `event.payload as { id }` 形の購読はそのまま動作（後方互換）。
