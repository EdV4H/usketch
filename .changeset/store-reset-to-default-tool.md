---
"@edv4h/usketch-shared": major
"@edv4h/usketch-store": major
"@edv4h/usketch-plugin-shape-wireframe": patch
"@edv4h/usketch-plugin-shape-island": patch
"@edv4h/usketch-plugin-keyboard-shortcuts": patch
"@edv4h/usketch-plugin-shape-board-portal": patch
"@edv4h/usketch-plugin-spatial-chat": patch
"@edv4h/usketch-plugin-shape-counter": patch
"@edv4h/usketch-plugin-voting": patch
"@edv4h/usketch-plugin-shape-text": patch
"@edv4h/usketch-plugin-domain-design": patch
"@edv4h/usketch-plugin-shape-connector": patch
"@edv4h/usketch-plugin-spotlight": patch
"@edv4h/usketch-plugin-shape-sticky": patch
"@edv4h/usketch-plugin-shape-frame": patch
"@edv4h/usketch-plugin-shape-basic": patch
"@edv4h/usketch-plugin-community-chat": patch
---

**BREAKING (TypeScript)**: `BoardStore` interface gains three required members — `getDefaultToolId()`, `setDefaultToolId(id)`, `resetToDefaultTool()`. Code that implements or mocks `BoardStore` (or `BoardState`) must add these members.

Plugins that want to return to the default tool after use now call `store.resetToDefaultTool()` instead of the previous hardcoded `setActiveToolId("select")` pattern. Consumers can change the default with `store.setDefaultToolId(id)` (or read it via `store.getDefaultToolId()`). The initial default remains `"select"`, and a new `default-tool:changed` mutation event is emitted when it changes.

Fixes #469.
