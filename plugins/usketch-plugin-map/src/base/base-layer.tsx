// BaseAreaLayer — the HEADLESS territory (領域) overlay. It derives each base's
// region from the synced `base-map` shape + terrain, then hands the drawing to the
// host's `territory.region.render` (area, world coords) and `territory.label.render`
// (label, screen coords). The layer owns positioning, viewport-follow, z-order,
// `show`-gating and redraw; it draws NOTHING on its own. Without render hooks the
// overlay is invisible (data + scaffold only) — the demo app / host provides the look.
import type { BoardStore, RenderMode } from "@edv4h/usketch-shared";
import { useEffect, useRef, useState } from "react";
import { MAP_TOOL_ID } from "../map-tool-id.js";
import { useMapToolState } from "../tool-state.js";
import { baseRegionAnchors, baseRegions, getBaseMap } from "./base-ops.js";
import { useBaseState } from "./base-state.js";
import { computeTerritory, type Territory } from "./territory.js";
import type { ResolvedTerritoryStyle } from "./territory-style.js";

export function BaseAreaLayer({
	store,
	renderMode: _renderMode,
	style,
}: {
	store: BoardStore;
	renderMode?: RenderMode;
	style: ResolvedTerritoryStyle;
}) {
	const tool = useMapToolState();
	const baseState = useBaseState();
	const [, force] = useState(0);
	const rafRef = useRef(0);

	useEffect(() => {
		const rerender = () => {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = requestAnimationFrame(() => force((n) => n + 1));
		};
		const u = store.subscribe(rerender);
		return () => {
			u();
			cancelAnimationFrame(rafRef.current);
		};
	}, [store]);

	// By default territory is only shown while editing bases (map tool + base
	// submode) — mirrors the EnterBanner indicator gating. Hosts can opt into
	// `show: "always"`. Check mode first so base-mode gating skips the shape scan
	// in getBaseMap on every non-base-mode re-render.
	const inBaseMode = store.getActiveToolId() === MAP_TOOL_ID && tool.mode === "base";
	if (style.show === "base-mode" && !inBaseMode) return null;
	const base = getBaseMap(store);
	if (!base) return null;
	const tile = base.tile;

	// Territory is DERIVED from beacons + terrain paint (memoised in territory.ts).
	const territory: Territory = computeTerritory(store, tile, new Set(baseState.excludeTerrains));
	if (Object.keys(territory).length === 0) return null;

	const regionRender = style.region.render;
	const labelRender = style.label.render;
	if (!regionRender && !labelRender) return null; // headless: nothing to draw

	const vp = store.getViewport();

	// Area: host draws each region in WORLD coords; the layer applies the viewport
	// transform (so it gets follow + z-order + gating for free).
	const worldNodes: React.ReactElement[] = [];
	if (regionRender) {
		for (const region of baseRegions(territory, base.bases, tile)) {
			const node = regionRender(region);
			if (node != null) worldNodes.push(<g key={`region-${region.baseId}`}>{node}</g>);
		}
	}

	// Labels: host draws the content; the layer positions it at the region centre
	// (screen coords, so it stays crisp + constant size).
	const anchors = labelRender ? baseRegionAnchors(territory, base.bases, tile) : [];

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
			{worldNodes.length > 0 ? (
				<svg width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
					<g transform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}>{worldNodes}</g>
				</svg>
			) : null}
			{anchors.map((a) => {
				const content = labelRender?.(a);
				if (content == null) return null;
				return (
					<div
						key={a.baseId}
						style={{
							position: "absolute",
							left: a.x * vp.zoom + vp.x,
							top: a.y * vp.zoom + vp.y,
							transform: "translate(-50%,-50%)",
							pointerEvents: "none",
						}}
					>
						{content}
					</div>
				);
			})}
		</div>
	);
}
