---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
"@edv4h/usketch-sync": minor
"@edv4h/usketch-plugin-sync-ywebsocket": patch
"@edv4h/usketch-plugin-sync-localstorage-yjs": patch
---

図形の永久削除を追加した。`store.removeShapePermanently(id, { expectedType })`（`removeShapePermanently(store, id)` で呼ぶ）で消した図形は id が記録され、古いコマンドの Undo・版の復元・同期で届いた古い更新や相手の Yjs Undo、後からの参加・再読込で戻らない。消去そのものは Undo に積まれない。

- shared: `BoardStore.removeShapePermanently` / `isPermanentlyRemoved` / `getPermanentlyRemovedIds`（次のメジャーまで省略可）と、`removeShapePermanently` / `isPermanentlyRemoved` ヘルパー。`shape:removed` に `permanent?: true` と消える直前の `shape` を追加
- store: 記録済み id への `addShape` / `updateShape` を `applyExternal` の中でも捨てる
- sync: `bindPermanentRemovals(store, doc)` と `DEFAULT_PERMANENT_REMOVALS_MAP_KEY` / `PERMANENT_REMOVAL_ORIGIN`。記録は Y.Doc の `permanentlyRemovedShapes` マップで共有する
- sync-ywebsocket / sync-localstorage-yjs: `bindPermanentRemovals` を張り、永久削除は自分では `shapes.delete` しない
