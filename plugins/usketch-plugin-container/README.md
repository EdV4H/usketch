# @edv4h/usketch-plugin-container

Runtime for **container shapes** — shapes whose `ShapeDefinition` declares a
`container` object. It supplies the parentId-based container mechanics that a
shape definition can't express on its own:

- **Auto-attach** — a shape dropped fully inside a container that sets
  `container.autoAttach` gets its `parentId` set (and cleared when moved out).
  With `container.attachHit: "center"` its center being inside is enough, and
  `container.accepts` limits which shapes are adopted.
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

### Snug containers (`attachHit`, `accepts`)

By default a shape attaches only when it is **wholly** inside the container. A
container about the size of what it holds (a card slot, a seat) would then only
catch a pixel-perfect drop. Set `attachHit: "center"` to adopt a shape whose
**center** is inside (it detaches once its center leaves), and `accepts` to let
only some shapes in — the rest pass through:

```ts
ctx.shapes.register("card-slot", {
  // ...
  container: {
    autoAttach: true,
    attachHit: "center",                    // drop roughly on it
    accepts: (child) => child.type === "card", // only cards
    layout: myPileLayout,
  },
});
```

Option+drag copies get their parent by the same rules. The select tool's
drop-target highlight skips containers whose `accepts` rejects what is dragged,
but still picks the container under the pointer (not the dragged shape's center).

### Clicking a container over other shapes (`yieldToShapes`)

A container with `selectableChildren` gives way by default: a click picks it only
where no other shape is hit, even a shape drawn behind it, so what sits on a frame
stays easy to grab. A card slot laid over a board picture would then never get the
click. Set `yieldToShapes: false` and the container hides what is behind it: the
shape drawn on top wins, and the container's own contents still win even when they
are drawn behind it.

```ts
container: {
  selectableChildren: true,
  yieldToShapes: false, // the slot, not the picture behind it, takes the click
  autoAttach: true,
  attachHit: "center",
},
```

## Attachable child shapes (`createAttachablePlugin`)

The **child-side counterpart**. Whereas `container` opts a *parent* in to holding
children, `attachable` opts a shape in as a *child* that sticks to and follows
**any** shape it is dropped on — even a non-container (sticky note, card). Use it
for stamps, badges, reaction pins, or handwritten annotation widgets. Because the
child rides on the ordinary select tool (no pointer hijacking) it keeps selection
/ resize / rotate.

It is a **separate plugin** from `createContainerPlugin` (register either or
both), colocated here because it drives the same `parentId` containment
subsystem:

```ts
import { createAttachablePlugin } from "@edv4h/usketch-plugin-container";

const plugins = [
  // ...
  createAttachablePlugin(),
];

ctx.shapes.register("badge", {
  // ...render/hitTest/resize/createDefault...
  attachable: {
    toAny: (target) => target.type !== "connector", // eligible targets
    follow: true,                                    // follow the parent's move
    hitTest: "center",                               // "drop it on and it sticks"
  },
});
```

- **Auto-attach** (this plugin): on drop, `parentId` is set to the front-most
  accepted shape under the badge (per `hitTest` / `toAny`), cleared when dropped
  over nothing.
- **Move-follow** is **native** (`tool-helpers`/`tool-select` read
  `attachable.follow`) — it works even without this plugin. See
  `ShapeDefinition.attachable` in `@edv4h/usketch-shared` for the full API.

## Notes / limitations

- **z-order / nesting**: children are positioned but not z-ordered by this
  plugin — visual nesting relies on `zIndex`.
- **Single `excludeTargets`**: `snap:configure` holds one `excludeTargets`
  predicate; if multiple plugins set it, last write wins. Only this plugin is
  expected to.
- **Rotation**: children follow/arrange on move and resize; parent rotation is
  not propagated to children.
