---
"@edv4h/usketch-plugin-sync-localstorage-yjs": minor
---

feat(sync-localstorage-yjs): docName を可変化＋外部 Y.Doc への IndexedDB 永続化後付けに対応

- `createSyncLocalstorageYjsPlugin(options?)` に `SyncLocalstorageYjsOptions` を追加。
  - `docName?: string | (() => string)` — IndexedDB doc 名をボード単位で分離可能に
    （複数ボードでの衝突を回避）。省略時は `"usketch-default"` で**後方互換**。
  - `doc?: Y.Doc` — ホストが持つ既存 Y.Doc（ネットワーク provider 接続済み）に IndexedDB
    永続化を**後付け**できる。内部で新規 doc を作らず、同一 doc にローカル永続化と
    ネットワーク同期を共存させられる。
- 外部提供の doc は**ホスト所有**として扱い、teardown（`destroy()`）では破棄しない
  （IndexedDB provider のみ破棄）。内部生成 doc は従来どおり破棄する。
- `createYjsSync(store, docNameOrOptions)` が `string` に加え `CreateYjsSyncOptions`
  （`{ docName?, doc? }`）を受け付けるように（既存の文字列呼び出しは後方互換）。
- README を追加：実体が IndexedDB（`y-indexeddb`）である旨、`docName`/`doc` の使い方、
  シェイプ格納 map 名が `"shapes"` 固定である前提を明記。
