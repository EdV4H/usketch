// Draw a single world-layer icon into a grid cell. Extracted from the old
// `map-icon` shape's body so the icon-grid layer (map-icon-layer.tsx) can render
// icons stored as tilemap cell data (cellKey → iconKey) — icons are no longer
// free shapes. The CSS custom properties (terrainCssVars) and the wobble filter
// are applied ONCE by the layer wrapper, not per icon, so this stays cheap.
import type { ReactElement } from "react";
import { ICONS_BY_KEY } from "./icons.js";
import { renderSvgNodes } from "./svg-nodes.js";

function parseViewBox(vb: string): [number, number, number, number] {
	const p = vb.split(/[\s,]+/).map(Number);
	return [p[0] || 0, p[1] || 0, p[2] || 48, p[3] || 48];
}

/**
 * Render the icon `iconKey` filling the cell `(col,row)` on a `tile`-sized grid,
 * i.e. the world rect `{ x: col*tile, y: row*tile, width: tile, height: tile }`.
 * Returns `null` for an unknown icon key. Same transform chain as the old
 * `MapIconBody`: translate to the cell, scale the viewBox to the tile, offset a
 * non-zero viewBox origin.
 */
export function renderIconAt(
	iconKey: string,
	col: number,
	row: number,
	tile: number,
	keyPrefix = "",
): ReactElement | null {
	const icon = ICONS_BY_KEY.get(iconKey);
	if (!icon) return null;
	const [vx, vy, vw, vh] = parseViewBox(icon.viewBox);
	const sx = tile / vw;
	const sy = tile / vh;
	const x = col * tile;
	const y = row * tile;
	return (
		<g
			key={`${keyPrefix}${col},${row}`}
			transform={`translate(${x} ${y}) scale(${sx} ${sy}) translate(${-vx} ${-vy})`}
		>
			{renderSvgNodes(icon.nodes, `icon-${icon.key}-${col}-${row}`)}
		</g>
	);
}
