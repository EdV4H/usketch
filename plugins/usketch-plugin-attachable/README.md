# @edv4h/usketch-plugin-attachable

Runtime for **attachable child shapes** — the child-side counterpart to
[`@edv4h/usketch-plugin-container`](../usketch-plugin-container). A shape whose
`ShapeDefinition` declares an `attachable` object sticks to and follows **any**
shape it is dropped on, regardless of whether that target opted in as a
`container`. Use it for stamps, badges, reaction pins, or handwritten annotation
widgets.

- **Auto-attach** — when an attachable shape finishes a move, it sets its
  `parentId` to the front-most shape it lands on (per `attachable.hitTest`,
  restricted by `attachable.toAny`), and clears it when dropped over nothing.
  The **child** decides, so even a non-container (e.g. a sticky note) becomes the
  parent.

Move-follow ("drag the parent, the attached child follows") is handled
**natively** by `tool-helpers`/`tool-select` from the same `attachable.follow`
flag — this plugin only adds the reactive attach-on-drop step. Because the child
rides on the ordinary select tool (it does not hijack pointer events), it keeps
selection / resize / rotate.

## Usage

```ts
import { createAttachablePlugin } from "@edv4h/usketch-plugin-attachable";

const plugins = [
  // ...
  createAttachablePlugin(),
];
```

Declare the child on a shape definition:

```ts
export const badgeShape: ShapeDefinition = {
  // ...render / getBounds / hitTest / resize / createDefault...
  attachable: {
    // Stick to anything except connectors and other badges.
    toAny: (target) => target.type !== "connector" && target.type !== "badge",
    // Follow the parent's move even though the parent is not a container.
    follow: true,
    // "Drop it on and it sticks": attach when the badge's center lands inside.
    hitTest: "center",
  },
};
```

See `ShapeDefinition.attachable` in `@edv4h/usketch-shared` for the full API and
the `boolean | (data) => boolean` predicate forms of each field.
