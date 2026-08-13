// MapIconGridLayer — renders world-layer icons stored as GRID DATA on the tilemap
// shape (cellKey → iconKey), mirroring how MapTerrainLayer renders terrain cells.
// Icons are no longer free shapes: they live on the substrate, so the generic
// Select tool can't grab them (nothing to hit-test) while the Map tool edits them
// as grid cells. Input is handled by the map tool; this layer is pointer-events:none.
import type { BoardStore, RenderMode } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { parseCellKey } from "./autotile.js";
import { renderIconAt } from "./icon-render.js";
import { visibleCellRange, visibleWorldRect } from "./map-layer.js";
import { terrainCssVars } from "./palette.js";
import { renderConfigStore } from "./render-config.js";
import { isTileMap, type TileMapShapeData } from "./tilemap-shape.js";

/** Distinct id so it doesn't collide with the terrain layer's wobble filter. */
export const ICON_WOBBLE_FILTER_ID = "uskmap-icon-wobble";

export function MapIconGridLayer({
	store,
	renderMode: _renderMode,
	tile: defaultTile,
}: {
	store: BoardStore;
	renderMode?: RenderMode;
	tile: number;
}) {
	// RAF-coalesced re-render on board + render-config changes (same as terrain).
	const [, force] = useState(0);
	const rafRef = useRef(0);
	useEffect(() => {
		const rerender = () => {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = requestAnimationFrame(() => force((n) => n + 1));
		};
		const u1 = store.subscribe(rerender);
		const u2 = renderConfigStore.subscribe(rerender);
		return () => {
			u1();
			u2();
			cancelAnimationFrame(rafRef.current);
		};
	}, [store]);

	const cfg = renderConfigStore.get();
	const vp = store.getViewport();
	const cssVars = terrainCssVars(cfg.colorMode, cfg.strokeScale);
	const visible = visibleWorldRect(store);

	const nodes: ReactElement[] = [];
	for (const [, shape] of store.getShapes()) {
		if (!isTileMap(shape)) continue;
		const tm = shape as TileMapShapeData;
		const icons = tm.icons;
		if (!icons) continue;
		const tile = tm.tile ?? defaultTile;
		const range = visibleCellRange(visible, tile);
		for (const [key, iconKey] of Object.entries(icons)) {
			const [c, r] = parseCellKey(key);
			// Cull to the visible cell range when known (icons are sparse, so this
			// keeps a huge panned world cheap).
			if (range && (c < range.c0 || c > range.c1 || r < range.r0 || r > range.r1)) continue;
			const node = renderIconAt(iconKey, c, r, tile, `${tm.id}-`);
			if (node) nodes.push(node);
		}
	}

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
			<svg width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
				<defs>
					{/* Own wobble filter (distinct id) so it doesn't clash with terrain's. */}
					<filter id={ICON_WOBBLE_FILTER_ID}>
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.014"
							numOctaves="2"
							seed="7"
							result="n"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="n"
							scale="2.1"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
					</filter>
				</defs>
				<g
					style={cssVars as React.CSSProperties}
					transform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}
					filter={cfg.lineStyle === "wobble" ? `url(#${ICON_WOBBLE_FILTER_ID})` : undefined}
				>
					{nodes}
				</g>
			</svg>
		</div>
	);
}
