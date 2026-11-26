# @edv4h/usketch-plugin-tabletop

Tabletop parts for playing games on a uSketch board: **game tables** and
**seats** (see below), and **zones** (`tabletop-zone`), places that hold cards or pieces — a deck, a discard pile,
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
  player sitting there. Every arrangement but `free` keeps a shape in a turned
  zone facing the zone's way; an unturned zone leaves a shape's own turn alone.

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
view** (what is on screen becomes the view, turned like the camera), **View camera** and **View label**.

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
removes the constraint it installed.

A host that shows the board leaning back in 3D while a view is applied (e.g. with
Mode 7) passes the tilt it draws with as `getTilt` (`{ pitch, fov, horizon }`, read
live; `null` = flat). The view is then framed as that camera draws it: centred, as
large as fits with every corner (the wider near edge too) inside the margin.
`fixed` holds that framing; `zoom` keeps the camera on it until zoomed in, and then
lets it move off only as far as it has zoomed in (2× reaches half-way to the view's
edges), since the trapezoid a tilt draws can't be clamped edge by edge.

```ts
const camera = applyViewCamera(app.store, getRect, "zoom", {
	getSize,
	getTilt: () => ({ pitch: 35, fov: 1200, horizon: 0.5 }),
});
```

The tilt is read on every commit, but changing it doesn't move the camera by
itself: after turning the tilt on, off or to another pitch, call `returnToView()`
(or apply the view again). The tilt has no yaw: a view's turn is the camera's
turn, so keep the 3D view's own yaw at 0 while a view is applied. `heightPx` is
for a raised 3D camera (Mode 7's `getRenderedCamera().heightPx`).

Zones never take views. The pieces are exported too: `fitViewToScreen`,
`stayInViewConstraint`, `pinToViewConstraint`, `isAtView`, `viewRectOf`,
`viewCameraRotation`.

## Game tables and seats

A **game table** (`tabletop-table`) is what a game is played on. Its form is
`rect`, `round` (the ellipse in its box) or `polygon` (a regular polygon of 3–8
`sides`, one corner at the top, stretched to fill the box). What is put on the
table, with its center inside the outline, becomes its child, so zones, cards and
seats move with it (needs `createContainerPlugin`).

A **seat** (`tabletop-seat`) is a player's place, a shape of its own with a
`label` ("Player 1", "Dealer"). Put on a table, it snaps onto the outline nearest
where it was dropped, turned to face the table. Off a table it is just a marker.

```ts
import { applyViewCamera, findSeat, readTableMeta, seatViewRect } from "@edv4h/usketch-plugin-tabletop";

// Sit at a seat: the whole table, turned so that seat is at the bottom. Read the
// seat again each time, so the camera follows a table that is moved.
const getRect = () => {
	const at = findSeat(app.store, seatId);
	return at ? seatViewRect(at.table, at.seat, 40) : null;
};
const at = findSeat(app.store, seatId);
if (at) {
	const camera = applyViewCamera(app.store, getRect, readTableMeta(at.table).camera, {
		getSize: () => ({ width: canvas.clientWidth, height: canvas.clientHeight }),
	});
}
```

| Table meta | Values                                 | Default |
| ---------- | -------------------------------------- | ------- |
| `form`     | `rect` \| `round` \| `polygon`          | `rect`  |
| `sides`    | 3–8 (for `polygon`)                    | `6`     |
| `camera`   | `fixed` \| `zoom` \| `free` (like a view) | `zoom`  |

Actions: `tabletop-table:add` (a table in the middle of the screen, behind
everything, with two players), `tabletop-table:add-seat`, `tabletop-table:spread`
(players evenly round the table, keeping their order), `tabletop-table:form`,
`tabletop-table:camera`, `tabletop-seat:label`.

The pieces are exported as plain functions: `tableOutline`, `isOnTable`,
`nearestOnOutline`, `seatPlacement`, `spreadPlacements`, `layoutTable` (the
table's container layout), `seatsAtTable` (clockwise from the bottom),
`listSeats`, `findSeat`, `spreadSeatUpdates`, `tableViewRect`, `seatViewRect`.

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
| `tables`      | Register the game table and seat shapes and their actions. Default `true`. |
| `renderTable` | A table's look, from `{ table, meta, outline }` (`outline` in the table's own box; `outlinePoints` makes SVG `points`). Default: a green table with a wooden rim. |
| `renderSeat`  | A seat's look, from `{ seat, meta }`. Default: a white tag with a person mark and the label. |

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
