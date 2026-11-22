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
| `face`    | `keep` / `up` / `down`                  | `keep`  |
| `accepts` | shape types the zone takes (empty = any) | `[]`    |

- `pile` stacks on the center (a deck), `spread` lays side by side and overlaps
  when it runs out of room (a hand, a row), `grid` fills rows and columns,
  `free` leaves shapes where they were dropped.
- `face` needs the `turnFace` option; without it, `face` does nothing.
- The newest drop goes on top (except in `free`).

The HUD gets three actions on a selected zone: **Zone layout**, **Turn dropped
shapes** and **Zone label**. A drawing tool (`tabletop-zone-draw`) drags a zone
out, or places one of the default size (140 × 196) with a click.

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

Turning and raising a dropped shape run only for the user who dropped it and
are not part of undo (like flipping a card).

## Host API

```ts
import { getTabletopApi } from "@edv4h/usketch-plugin-tabletop";

const tabletop = getTabletopApi(app.services);
const deck = tabletop?.addZone({ x: 0, y: 0, label: "Deck", face: "down" });
if (tabletop && deck) {
	tabletop.setArrange(deck.id, "spread");
	tabletop.count(deck.id);
}
```

The same operations are exported as plain functions taking a `BoardStore`
(`setZoneArrange`, `zoneContents`, `zoneOf`, …), and `arrangeZone` is the pure
layout.
