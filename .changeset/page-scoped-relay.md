---
"@edv4h/usketch-sync": minor
---

Add helpers for servers that relay awareness and broadcasts only to people who may view a page.

- `parseAwarenessUpdate(update)` reads an awareness update. `forViewer(canView)` returns an update where people on pages the receiver may not view are sent as gone (`null`), so a cursor or name on a private page does not reach them. It returns the original update when nothing changes.
- `broadcastPageOf(payload)` reads the sender's page (`__page`) from a broadcast.
