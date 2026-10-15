---
"@edv4h/usketch-plugin-sync-ywebsocket": patch
"@edv4h/usketch-plugin-sync-localstorage-yjs": patch
---

shape のフィールドを `undefined` にする更新（ungroup の `parentId` やコネクタ端点の `sourceId` / `targetId` の切り離しなど）が、他のクライアントに伝わらない問題を直す。受信した Y.Map の値を正とし、手元にあって受信値に無いキーを消すようにした（`zIndex` / `createdAt` / `updatedAt` などストアが振る値は残す）。
