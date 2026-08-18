// BaseIconLayer — draws each base's landmark icon at its beacon cell. The icon is
// DERIVED from the base (its radius tier, or an explicit override — see
// base-icon.ts); nothing is stored per-cell, mirroring how territory.ts derives
// ownership. This is how a base becomes its own landmark: placing a base shows an
// icon, no separate stamp step. Always visible (unlike the territory overlay,
// which is gated to base-mode). Icons are not free shapes — Select can't grab them.
import type { BoardStore, RenderMode } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { parseCellKey } from "../autotile.js";
import { renderIconAt } from "../icon-render.js";
import { visibleCellRange, visibleWorldRect } from "../map-layer.js";
import { terrainCssVars } from "../palette.js";
import { renderConfigStore } from "../render-config.js";
import { effectiveBaseIcon } from "./base-icon.js";
import { getBaseMap } from "./base-ops.js";

/** Distinct id so it doesn't collide with the terrain layer's wobble filter. */
export const BASE_ICON_WOBBLE_FILTER_ID = "uskmap-base-icon-wobble";

export function BaseIconLayer({
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

	const base = getBaseMap(store);
	if (!base) return null;
	const tile = base.tile ?? defaultTile;
	const cfg = renderConfigStore.get();
	const vp = store.getViewport();
	const cssVars = terrainCssVars(cfg.colorMode, cfg.strokeScale);
	const visible = visibleWorldRect(store);
	const range = visibleCellRange(visible, tile);

	const nodes: ReactElement[] = [];
	for (const [baseId, info] of Object.entries(base.bases)) {
		if (!info.beaconCell) continue;
		const [c, r] = parseCellKey(info.beaconCell);
		// Cull to the visible cell range when known (bases are sparse, so this keeps
		// a huge panned world cheap).
		if (range && (c < range.c0 || c > range.c1 || r < range.r0 || r > range.r1)) continue;
		const node = renderIconAt(effectiveBaseIcon(info), c, r, tile, `base-${baseId}-`);
		if (node) nodes.push(node);
	}
	if (nodes.length === 0) return null;

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
			<svg width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
				<defs>
					{/* Own wobble filter (distinct id) so it doesn't clash with terrain's. */}
					<filter id={BASE_ICON_WOBBLE_FILTER_ID}>
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
					filter={cfg.lineStyle === "wobble" ? `url(#${BASE_ICON_WOBBLE_FILTER_ID})` : undefined}
				>
					{nodes}
				</g>
			</svg>
		</div>
	);
}
