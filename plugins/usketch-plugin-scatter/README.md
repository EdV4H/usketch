# @edv4h/usketch-plugin-scatter

「関連する Shape をぶちまける」— an extensible engine that scatters a seed shape's
**related** shapes (and/or freshly spawned ones) outward across the canvas, as one
undoable step, optionally animated.

```ts
import { createScatterPlugin, getScatterApi } from "@edv4h/usketch-plugin-scatter";
// register createScatterPlugin() in your app's plugin list.

const api = getScatterApi(app.services);
await api?.scatter({
  seedId,                 // defaults to the sole selected shape
  relation: "connectors", // built-in resolver, or pass items / a RelationResolver
  pattern: "radial",      // radial | scatter | unoverlap | grid, or a ScatterPattern
  animate: true,
});
```

- **Related = pluggable** — pass explicit `items` (existing ids ∪ new-shape specs) or
  a `relation` resolver (`connectors`, `children`, or your own via `registerResolver`).
- **New shapes** — `{ kind: "new", spec: { type, width, height, … } }` items are
  spawned + placed in the same undoable command.
- **Patterns** — `radial` / `scatter` (random + rotation) / `unoverlap` (delegates to
  `findFreePosition`) / `grid`; add more with `registerPattern`.
- **Animation** — `animate` + `durationMs` + `easing` for a fly-out tween.

UI: registered on the Control HUD (`ぶちまけ設定` + the `関連Shapeをぶちまける` action,
enabled when exactly one shape is selected).
