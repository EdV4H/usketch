---
"@edv4h/usketch-sync": minor
---

Let a server refuse a page doc.

- New messages `MSG_DOC_DENIED` (12, server → client: the connection may not see that doc) and `MSG_PERMISSIONS_CHANGED` (13, server → client: the board's permissions changed).
- `DocSubscription.onDenied(handler)`: called when the server denies the subscription. The subscription ends and is not renewed on reconnect.
- `WsProviderHandle.onPermissionsChanged(handler)`: called when the server says permissions changed (re-read them).
- `PageDocHandle.onDenied(handler)` and `PageAccessDeniedError`: when a page is denied before it finished loading, `whenLoaded` rejects with `PageAccessDeniedError`; the page is dropped from the cache so the next `open` subscribes again.

Servers that never send the new messages behave as before.
