---
"@edv4h/usketch-plugin-server-comments": minor
"@edv4h/usketch-plugin-server-boards": minor
"@edv4h/usketch-plugin-server-ai": patch
---

Let the server check pages for comments, history, thumbnails and AI writes.

- server-comments: new optional `pageFilter` option (second argument of `createCommentsPlugin`). Threads on pages the viewer may not view are left out of the list, and creating, replying to, resolving or deleting them returns 404.
- server-boards: after adding or removing a member, changing `isPublic` or deleting a board, it posts `/access-changed` to the board's Durable Object so open connections pick up the new role. The history proxy and the public thumbnail route pass `boardId` to the Durable Object.
- server-ai: the calls that write shapes to the Durable Object pass `boardId` and `userId`, so it can check that the caller may edit the page.
