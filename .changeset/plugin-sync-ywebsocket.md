---
"@edv4h/usketch-plugin-sync-ywebsocket": minor
---

Add `@edv4h/usketch-plugin-sync-ywebsocket` — bridges uSketch to any y-websocket server. Exposes a `WsProviderHandle`-compatible adapter for drop-in use with `@edv4h/usketch-plugin-presence-cursor`, with hooks for token refresh (`resolveParams`), close-code handling (`onCloseCode`), idle disconnect, and a pre-existing Y.Doc. Closes #574.
