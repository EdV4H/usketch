# @edv4h/usketch-plugin-container

Runtime for **container shapes** — shapes whose `ShapeDefinition` declares a
`container` object. It supplies the parentId-based container mechanics that a
shape definition can't express on its own:

- **Auto-attach** — a shape dropped fully inside a container that sets
  `container.autoAttach` gets its `parentId` set (and cleared when moved out).
- **Arrange** — a container's `container.layout` positions its children on
  attach/detach, resize, and (non-drag) updates.
- **Snap exclusion** — while a container is dragged, its children (which follow
  natively) are excluded from snapping so they don't jitter. Requires
  `@edv4h/usketch-plugin-snap`; a no-op if snap isn't installed.

Selection resolution ("click a child, select the child") and move-follow
("drag the parent, children follow") are handled **natively** by
`tool-helpers`/`tool-select` from the same `container` flags — this plugin only
adds the reactive pieces above.

## Usage

Register **after** the snap plugin so its `snap:configure` listener is ready:

```ts
import { createContainerPlugin } from "@edv4h/usketch-plugin-container";

const plugins = [
  // ...
  createSnapPlugin(),
  createContainerPlugin(),
];
```

Declare a container on a shape definition (all fields accept a
`boolean | (data) => boolean` predicate, so a single type can vary per
instance):

```ts
import { stackLayout } from "@edv4h/usketch-plugin-container";

ctx.shapes.register("wireframe", {
  // ...render/hitTest/resize/createDefault...
  container: {
    enabled: (s) => s.meta?.component === "card", // only cards are containers
    selectableChildren: true,                     // children selectable individually
    autoAttach: true,                             // drop-inside attaches as child
    layout: stackLayout({ padding: 16, gap: 8 }), // arrange children vertically
  },
});
```

Children are ordinary shapes referencing the container via native `parentId`.

## Notes / limitations

- **z-order / nesting**: children are positioned but not z-ordered by this
  plugin — visual nesting relies on `zIndex`.
- **Single `excludeTargets`**: `snap:configure` holds one `excludeTargets`
  predicate; if multiple plugins set it, last write wins. Only this plugin is
  expected to.
- **Rotation**: children follow/arrange on move and resize; parent rotation is
  not propagated to children.
