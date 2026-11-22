---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
"@edv4h/usketch-plugin-debug-hud": minor
---

権限の口を足しました。`createApp({ permissions })` に `PermissionProvider`（`can` / `subscribe`）を渡すと、プラグインは `ctx.permissions`（`permissionsOf(ctx)`）で「この人はこれをしてよいか」を聞けます。省略すると全部可で、今までと同じです。

- shared: `PermissionProvider` / `PermissionSnapshot` / `ServerPermissionResolver` などの型、コアの権限名 `PERMISSIONS`、素朴なアダプター（`allowAllPermissions` / `denyAllPermissions` / `createStaticPermissionProvider`）、`isPermitted` / `permissionsOf`。`PluginAction` / `HudSettingsDescriptor` / `HudPanel` に `requires` を足しました。
- core: `createApp({ permissions })`、`app.permissions` と `ctx.permissions`。
- debug-hud: `requires` の権限が無い操作・設定・パネルを隠し、権限が変わると出し直します。
