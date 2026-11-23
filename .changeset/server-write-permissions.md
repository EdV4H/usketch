---
"@edv4h/usketch-plugin-server-boards": patch
"@edv4h/usketch-plugin-server-ai": patch
---

Enforce board roles on the server side.

- `server-boards`: the `/api/boards/:id/ws` proxy now tells the Durable Object the caller's board role (`role`: owner / editor / viewer, omitted for non-members of a public board) and whether the board is public (`boardPublic`: `1` / `0`). Values sent by the client are always overwritten. Community boards are passed as `editor`. A Durable Object can use these to refuse writes (the demo server drops Yjs updates from viewers and from people only viewing a public board).
- `server-ai`: `POST /api/ai/complete` places shapes, so it now answers 403 to viewers and to non-members of a public board. Pass the new optional `communityBoards` table to `createAiPlugin` to keep letting anyone place shapes on community boards.
