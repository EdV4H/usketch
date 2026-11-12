---
"@edv4h/usketch-plugin-canvas-filter": minor
"@edv4h/usketch-plugin-server-boards": minor
---

旧スナップショットの Time Travel を削除し、ボード履歴（`@edv4h/usketch-plugin-history`）に一本化した。canvas-filter は Time Travel タブ・バナー・`filter:time-travel-exit` アクション・`time-travel:request` の受け口を外し、`boardRoomApiUrl` オプションは無視するようになった（型は残して deprecated）。server-boards は `/api/boards/:id/snapshots`・`/snapshot` のプロキシを外した。
