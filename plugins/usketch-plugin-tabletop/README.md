# @edv4h/usketch-plugin-tabletop

Tabletop parts for playing games on a uSketch board. For now: **zones**
(`tabletop-zone`), places that hold cards or pieces — a deck, a discard pile,
a player's row. A shape dropped with its center on a zone snaps into it and is
laid out by the zone's `arrange`.

There are no rules: people move things where they like. A zone only decides
where a dropped shape sits and, optionally, which way up it lands.

```ts
import { createContainerPlugin } from "@edv4h/usketch-plugin-container";
import { cardTurnFace } from "@edv4h/usketch-plugin-shape-card";
import { createTabletopPlugin } from "@edv4h/usketch-plugin-tabletop";

plugins: [
	createContainerPlugin(),
	// After the container plugin: it attaches the dropped shapes first.
	createTabletopPlugin({ turnFace: cardTurnFace }),
];
```

## Zone options (shape meta)

| Field     | Values                                  | Default |
| --------- | --------------------------------------- | ------- |
| `label`   | text shown on the zone                  | `""`    |
| `arrange` | `pile` / `spread` / `grid` / `free`     | `pile`  |
| `align`   | `start` / `center` / `end` (left / center / right) | `start` for `grid`, else `center` |
| `face`    | `keep` / `up` / `down`                  | `keep`  |
| `accepts` | shape types the zone takes (empty = any) | `[]`    |

- `pile` stacks on the center (a deck), `spread` lays side by side and overlaps
  when it runs out of room (a hand, a row), `grid` fills rows and columns,
  `free` leaves shapes where they were dropped.
- `align` leans the layout to the left edge, the middle or the right edge
  (`free` ignores it). `grid` aligns each row on its own, so a short last row
  sits on the same side. A zone without its own `align` follows its `arrange`
  (`readZoneMeta` fills it in; `storedZoneMeta` is what gets written back).
- `face` needs the `turnFace` option; without it, `face` does nothing.
- The newest drop goes on top (except in `free`).
- A turned zone (a hand across the table) lays out along its own edges, and
  what it holds turns with it, so the cards read the right way up for the
  player sitting there. Every arrangement but `free` keeps a shape facing the
  zone's way (a card turned on its own inside a pile is turned back).

The HUD gets four actions on a selected zone: **Zone layout**, **Zone
alignment**, **Turn dropped shapes** and **Zone label**. A drawing tool (`tabletop-zone-draw`) drags a zone
out, or places one of the default size (140 × 196) with a click.

## Player views

A **player view** (`tabletop-view`) is a dashed frame on the table that marks
what a player sees while a game is played. A board can have any number of them
(one per seat, or one for everyone). Its meta is `label` and `camera`:

| `camera` | While the view is applied |
| -------- | ------------------------- |
| `fixed`  | The camera can't be moved at all. |
| `zoom` (default) | Zooming in and panning inside the view are allowed; it can't zoom out past the view or show what is outside it. |
| `free`   | The camera is brought to the view once and can then go anywhere. |

Only the frame's edge and its label take clicks, so a view drawn over the
table doesn't get in the way of the cards inside it. Turn a view to face its
seat (180° for the player across the table): applying it turns the camera the
other way, so that player sees it upright. The HUD gets **Add player
view** (what is on screen becomes the view), **View camera** and **View label**.

The plugin doesn't move anyone's camera by itself. The host applies a view when
play starts, and decides who gets which view:

```ts
import { applyViewCamera, readViewMeta, viewRectOf } from "@edv4h/usketch-plugin-tabletop";

const view = app.store.getShape(seatViewId);
const getRect = () => {
	const shape = app.store.getShape(seatViewId);
	return shape ? viewRectOf(shape) : null; // its box and its turn
};
const camera = applyViewCamera(app.store, getRect, readViewMeta(view).camera, {
	getSize: () => ({ width: canvas.clientWidth, height: canvas.clientHeight }),
});
camera.returnToView(); // after zooming in
camera.release(); // when play ends
```

`applyViewCamera` fits the whole view on any screen shape, then holds it with
the store's viewport constraint (`fixed` / `zoom`; a held camera keeps the
view's turn and can't be turned by hand).
Applying another view on the same store releases the first, and `release` only
removes the constraint it installed. Zones never take views. The pieces are exported too: `fitViewToScreen`,
`stayInViewConstraint`, `pinToViewConstraint`, `isAtView`, `viewRectOf`,
`viewCameraRotation`.

## Plugin options

| Option        | What it does |
| ------------- | ------------ |
| `render`      | The zone's look, from `{ zone, meta, count }`. Default: a dashed frame with the label and, for a pile, the count. |
| `accepts`     | Which shapes zones take, on top of each zone's `accepts`. Default: anything but connectors. Zones never take zones or other containers. |
| `turnFace`    | `(shape, "up" \| "down") => patch \| null`. For cards: `cardTurnFace`. |
| `onAttach` / `onDetach` | The local user dropped a shape into / took one out of a zone. Also emitted as `tabletop:zone-attached` / `tabletop:zone-detached` on `ctx.events`. |
| `defaultSize` | Size of a zone placed by a click. |
| `arrange`     | Spacing: `padding`, `gap`, `spreadStep`. |
| `tool`        | Register the drawing tool. Default `true`. |
| `views`       | Register the player view shape and its actions. Default `true`. |
| `renderView`  | A view's look, from `{ view, meta }`. Default: a dashed frame with a camera mark and the label. |

Turning and raising a dropped shape run only for the user who dropped it and
are not part of undo (like flipping a card).

## Host API

```ts
import { getTabletopApi } from "@edv4h/usketch-plugin-tabletop";

const tabletop = getTabletopApi(app.services);
const deck = tabletop?.addZone({ x: 0, y: 0, label: "Deck", face: "down" });
if (tabletop && deck) {
	tabletop.setArrange(deck.id, "spread");
	tabletop.setAlign(deck.id, "start");
	tabletop.count(deck.id);
}
```

The same operations are exported as plain functions taking a `BoardStore`
(`setZoneArrange`, `setZoneAlign`, `zoneContents`, `zoneOf`, …), and `arrangeZone` is the pure
layout.
