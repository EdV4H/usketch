---
"@edv4h/usketch-plugin-sync-ywebsocket": minor
---

Add `shouldSync` callback to `YwebsocketSyncOptions`.

`shouldSync(shape)` is consulted before each local `shape:added` / `shape:updated` is written to the Y.Map: returning `false` keeps the shape in the local store but blocks it from being persisted to or broadcast through the shared document. Local `shape:removed` events are gated on the same set — removals propagate to the Y.Map only for shapes this sync instance had previously chosen (or been told) to sync, so a host bridging in foreign shapes (e.g. tldraw → uSketch migration) doesn't scribble unrelated deletes into the shared doc. If `shouldSync` flips from `true` to `false` for an id that was already in the Y.Map, the stale entry is dropped on the next mutation. Defaults to `() => true`, fully backwards compatible.

Use case: bridging external state (e.g. a tldraw → uSketch migration) into the uSketch store, where some shapes are mirrored read-only and must not be written back to the shared document. Closes #606.
