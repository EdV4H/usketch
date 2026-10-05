# @edv4h/usketch-map-icons

The RPG map icon set (landmark / object / marker) as pure data, split out of
`@edv4h/usketch-plugin-map`. Zero runtime dependencies.

```ts
import { ICONS, ICONS_BY_KEY, ICON_CATEGORIES } from "@edv4h/usketch-map-icons";
```

- `ICONS` — array of `IconDef` (`key`, `category`, `ja`, `viewBox`, `nodes`).
- `ICONS_BY_KEY` — `Map<key, IconDef>`.
- `ICON_CATEGORIES` — category id → label.
- `SvgNode` — the static SVG element-tree model an `IconDef.nodes` uses.

Icons are rendered by the map plugin (React); this package ships only the data.
