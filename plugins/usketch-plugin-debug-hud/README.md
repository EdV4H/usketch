# @edv4h/usketch-plugin-debug-hud

A screen-fixed **control + debug panel**. Toggle with the backtick key (`` ` ``).
Beyond inspection (shapes, events, FPS, sync, minimap) it is a **universal
control surface**: every plugin operation can be driven from here, so a host app
does not need to add bespoke UI per plugin.

```ts
import { createDebugHudPlugin } from "@edv4h/usketch-plugin-debug-hud";
const plugins = [/* ... */, createDebugHudPlugin()];
```

Hidden by default; press `` ` `` to open. Safe to ship in production (it only
appears on toggle).

## Controls panel

- **Tools** — one button per registered tool (`tools.getOrdered()`), click to
  `store.setActiveToolId(id)`.
- **Actions** — every `PluginAction` a plugin registered (see below), grouped
  and rendered as buttons / parameter forms automatically.
- **Emit event** — a raw fallback: type any event name + JSON payload and
  `events.emit(...)`. Lets you drive operations a plugin hasn't (yet) exposed as
  an action.
- **Default style / Clear canvas** — edit `store` default style; batch-delete.

## Exposing plugin operations to the HUD

Register actions in your plugin's `setup` via `ctx.actions` — the HUD renders a
control for each with no app-side UI. Example (freedraw):

```ts
const off = ctx.actions.register({
  id: "freedraw:color",
  label: "Color",
  group: "Freedraw",
  params: [{ name: "color", type: "color", default: "#1e1e1e" }],
  run: ({ color }) => ctx.events.emit("freedraw:set-color", { color }),
});
// call off() in teardown
```

`PluginAction` fields: `id`, `label`, optional `group` / `icon` / `order`,
optional `params` (`ActionParam[]` — `string|number|boolean|color|enum`),
`run(args)`, and optional `isActive()` / `isEnabled()` for toggle / contextual
state. Parameterless actions render as a button; selection-contextual actions
(e.g. "Flip selected card") use `isEnabled()` to gate on the current selection.

Migrated so far: freedraw, snap, background, card, sticky. Others follow the
same one-liner pattern (emit the plugin's existing event from `run`).
