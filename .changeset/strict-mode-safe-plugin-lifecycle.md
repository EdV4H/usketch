---
"@edv4h/usketch-shared": major
"@edv4h/usketch-core": major
"@edv4h/usketch-dom-renderer": major
"@edv4h/usketch-gpu-renderer": major
"@edv4h/usketch-plugin-activity-feed": major
"@edv4h/usketch-plugin-ai-actions": major
"@edv4h/usketch-plugin-ai-agent": major
"@edv4h/usketch-plugin-ai-chat": major
"@edv4h/usketch-plugin-ai-copilot": major
"@edv4h/usketch-plugin-ai-image": major
"@edv4h/usketch-plugin-ai-recognize": major
"@edv4h/usketch-plugin-ai-voice": major
"@edv4h/usketch-plugin-avatar": major
"@edv4h/usketch-plugin-bg-dots": major
"@edv4h/usketch-plugin-bg-grid": major
"@edv4h/usketch-plugin-board-info-panel": major
"@edv4h/usketch-plugin-canvas-filter": major
"@edv4h/usketch-plugin-comments": major
"@edv4h/usketch-plugin-community-chat": major
"@edv4h/usketch-plugin-debug-hud": major
"@edv4h/usketch-plugin-domain-design": major
"@edv4h/usketch-plugin-effect-ripple": major
"@edv4h/usketch-plugin-export": major
"@edv4h/usketch-plugin-follow-me": major
"@edv4h/usketch-plugin-keyboard-shortcuts": major
"@edv4h/usketch-plugin-laser": major
"@edv4h/usketch-plugin-presence-cursor": major
"@edv4h/usketch-plugin-presence-enhanced": major
"@edv4h/usketch-plugin-presentation": major
"@edv4h/usketch-plugin-reactions": major
"@edv4h/usketch-plugin-shape-basic": major
"@edv4h/usketch-plugin-shape-community-region": major
"@edv4h/usketch-plugin-shape-connector": major
"@edv4h/usketch-plugin-shape-counter": major
"@edv4h/usketch-plugin-shape-frame": major
"@edv4h/usketch-plugin-shape-freedraw": major
"@edv4h/usketch-plugin-shape-group": major
"@edv4h/usketch-plugin-shape-image": major
"@edv4h/usketch-plugin-shape-island": major
"@edv4h/usketch-plugin-shape-openui": major
"@edv4h/usketch-plugin-shape-sticky": major
"@edv4h/usketch-plugin-shape-text": major
"@edv4h/usketch-plugin-shape-wireframe": major
"@edv4h/usketch-plugin-side-panel": major
"@edv4h/usketch-plugin-snap": major
"@edv4h/usketch-plugin-spatial-chat": major
"@edv4h/usketch-plugin-spotlight": major
"@edv4h/usketch-plugin-sync-localstorage-yjs": major
"@edv4h/usketch-plugin-sync-ywebsocket": major
"@edv4h/usketch-plugin-tool-openui": major
"@edv4h/usketch-plugin-tool-pan": major
"@edv4h/usketch-plugin-tool-select": major
"@edv4h/usketch-plugin-viewport-nav": major
"@edv4h/usketch-plugin-voting": major
"@edv4h/usketch-plugin-whistle": major
---

**BREAKING**: Plugin lifecycle reworked for React StrictMode safety. Fixes #609.

`UsketchPlugin.setup(ctx)` now returns the teardown function directly; the `teardown` property on `UsketchPlugin` has been removed. All plugins that previously exported a module-level singleton object (e.g. `selectToolPlugin`, `panToolPlugin`, `gridBgPlugin`) are now factory functions (`createSelectToolPlugin()`, `createPanToolPlugin()`, `createGridBgPlugin()`). Each `createApp` call now owns its own plugin instance and teardown closure, so a second mount cannot overwrite the first's cleanup state.

`createApp` collects per-instance teardowns and runs them in LIFO order on `destroy()`. `destroy()` is idempotent — repeated calls are no-ops. If a later plugin's `setup` throws, the teardowns collected so far roll back in LIFO order.

**Migration**:

1. Replace singleton imports with factory calls at the call site:
   ```diff
   - import { selectToolPlugin, panToolPlugin, gridBgPlugin } from "@edv4h/usketch-plugin-...";
   + import { createSelectToolPlugin, createPanToolPlugin, createGridBgPlugin } from "@edv4h/usketch-plugin-...";

     const app = await createApp({
       store,
   -   plugins: [selectToolPlugin, panToolPlugin, gridBgPlugin],
   +   plugins: [createSelectToolPlugin(), createPanToolPlugin(), createGridBgPlugin()],
     });
   ```

2. When authoring a custom plugin, return the cleanup from `setup` instead of assigning it to `this.teardown`:
   ```diff
     setup(ctx) {
       const off = ctx.events.on("…", handler);
   -   (this as UsketchPlugin).teardown = () => off();
   +   return () => off();
     },
   - teardown() { … },
   ```

3. Build plugin arrays inside `useEffect` (or any per-mount scope), not at module level — even with factory functions, sharing a single instance across mounts undoes StrictMode safety.

Plugins that already shipped as `createXxxPlugin()` (e.g. `createDomRendererPlugin`, `createPresenceCursorPlugin`) keep their factory names; only the `teardown` property has moved to the `setup` return value.
