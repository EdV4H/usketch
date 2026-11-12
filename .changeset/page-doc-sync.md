---
"@edv4h/usketch-sync": minor
---

ルート doc とは別の Y.Doc（ページ doc）を同じ WebSocket で同期できるようにした（マルチページの土台）。`WsProviderHandle.subscribeDoc(docId, doc)` で購読すると、state vector で差分だけを受け取り、ローカルの編集は `DOC_UPDATE` で送る。再接続時は自動で購読し直し、切断中の編集はサーバーに足りない分だけ送り返す。メッセージは `MSG_DOC_SUBSCRIBE` / `MSG_DOC_SYNC` / `MSG_DOC_UPDATE` / `MSG_DOC_UNSUBSCRIBE` と `encodeDocFrame` / `decodeDocFrame` / `isValidDocId` を追加。ルート doc 用の既存メッセージは変えていない。
