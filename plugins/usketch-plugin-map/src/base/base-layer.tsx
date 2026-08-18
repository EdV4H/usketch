// BaseAreaLayer — renders each base's owned tiles as a translucent coloured
// territory (fill + border + name label) above the terrain and below shapes.
// Reads ownership DATA from the synced `base-map` shape; LOD + culling mirror
// the terrain MapLayer.
import type { BoardStore, RenderMode } from "@edv4h/usketch-shared";
import { useEffect, useRef, useState } from "react";
import { type Cells, exposedEdges, parseCellKey } from "../autotile.js";
import { blockFactor, downsampleCells, type TileDetail, tileDetail } from "../lod.js";
import { visibleCellRange, visibleWorldRect } from "../map-layer.js";
import { MAP_TOOL_ID } from "../map-tool-id.js";
import { useMapToolState } from "../tool-state.js";
import type { BaseInfo } from "./base-map-shape.js";
import { baseRegionAnchors, baseRegions, getBaseMap } from "./base-ops.js";
import { useBaseState } from "./base-state.js";
import { computeTerritory, type Territory } from "./territory.js";
import type { ResolvedTerritoryStyle } from "./territory-style.js";

/** Full tier: per-cell translucent fill + base-coloured border on region edges. */
function renderFull(
	owner: Territory,
	bases: Record<string, BaseInfo>,
	tile: number,
	visible: DOMRectReadOnly | null,
	style: ResolvedTerritoryStyle,
): React.ReactElement[] {
	const nodes: React.ReactElement[] = [];
	const asCells = owner as unknown as Cells; // exposedEdges only compares values
	const bt = style.border.ratio * tile;
	const range = visibleCellRange(visible, tile);
	const emit = (c: number, r: number) => {
		const baseId = owner[`${c},${r}`];
		if (!baseId) return;
		const color = bases[baseId]?.color;
		if (!color) return;
		const x = c * tile;
		const y = r * tile;
		nodes.push(
			<rect
				key={`${c},${r}:f`}
				x={x}
				y={y}
				width={tile}
				height={tile}
				fill={color}
				fillOpacity={style.fillOpacity}
			/>,
		);
		const edge = exposedEdges(asCells, c, r);
		const strip = (sx: number, sy: number, sw: number, sh: number, k: string) => (
			<rect
				key={k}
				x={sx}
				y={sy}
				width={sw}
				height={sh}
				fill={color}
				fillOpacity={style.border.opacity}
			/>
		);
		if (edge.n) nodes.push(strip(x, y, tile, bt, `${c},${r}:n`));
		if (edge.s) nodes.push(strip(x, y + tile - bt, tile, bt, `${c},${r}:s`));
		if (edge.w) nodes.push(strip(x, y, bt, tile, `${c},${r}:w`));
		if (edge.e) nodes.push(strip(x + tile - bt, y, bt, tile, `${c},${r}:e`));
	};
	if (range) {
		for (let r = range.r0; r <= range.r1; r++)
			for (let c = range.c0; c <= range.c1; c++) emit(c, r);
	} else {
		for (const key of Object.keys(owner)) {
			const [c, r] = parseCellKey(key);
			emit(c, r);
		}
	}
	return nodes;
}

/** Coarse tier: flat translucent blocks (downsampled by owning base). */
function renderCoarse(
	owner: Territory,
	bases: Record<string, BaseInfo>,
	tile: number,
	screenTilePx: number,
	visible: DOMRectReadOnly | null,
	fillOpacity: number,
): React.ReactElement[] {
	const factor = blockFactor(screenTilePx);
	const bt = factor * tile;
	const nodes: React.ReactElement[] = [];
	for (const [bk, baseId] of Object.entries(downsampleCells(owner as unknown as Cells, factor))) {
		const color = bases[baseId]?.color;
		if (!color) continue;
		const [bc, br] = parseCellKey(bk);
		const x = bc * bt;
		const y = br * bt;
		if (
			visible &&
			(x > visible.right || y > visible.bottom || x + bt < visible.left || y + bt < visible.top)
		) {
			continue;
		}
		nodes.push(
			<rect key={bk} x={x} y={y} width={bt} height={bt} fill={color} fillOpacity={fillOpacity} />,
		);
	}
	return nodes;
}

export function BaseAreaLayer({
	store,
	renderMode,
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

	// By default territory paint is only shown while editing bases (map tool + base
	// submode) — mirrors the EnterBanner indicator gating. Hosts can opt into
	// `show: "always"` to surface areas to end users. Check mode first so base-mode
	// gating skips the shape scan in getBaseMap on every non-base-mode re-render.
	const inBaseMode = store.getActiveToolId() === MAP_TOOL_ID && tool.mode === "base";
	if (style.show === "base-mode" && !inBaseMode) return null;
	const base = getBaseMap(store);
	if (!base) return null;
	const tile = base.tile;

	// Territory is DERIVED from beacons + terrain paint (memoised in territory.ts).
	const territory: Territory = computeTerritory(store, tile, new Set(baseState.excludeTerrains));
	if (Object.keys(territory).length === 0) return null;

	const vp = store.getViewport();
	const visible = visibleWorldRect(store);
	const screenTilePx = tile * vp.zoom;
	const detail: TileDetail = tileDetail(screenTilePx, renderMode);

	// World-space area drawing. When a host supplies `region.render`, it OWNS the
	// area look (fill/border/ring) at full detail: draw its SVG per region instead
	// of the stock cells + rings. Coarse LOD always uses the cheap stock blocks.
	const worldNodes: React.ReactElement[] = [];
	const customRegion = detail === "full" ? style.region.render : undefined;
	if (customRegion) {
		for (const region of baseRegions(territory, base.bases, tile)) {
			const node = customRegion(region);
			if (node != null) worldNodes.push(<g key={`region-${region.baseId}`}>{node}</g>);
		}
	} else {
		if (detail === "full")
			worldNodes.push(...renderFull(territory, base.bases, tile, visible, style));
		else
			worldNodes.push(
				...renderCoarse(territory, base.bases, tile, screenTilePx, visible, style.fillOpacity),
			);
		// Radius rings around each base's beacon CELL. Full detail only; radius +
		// colour come from the base registry (no icon shapes involved anymore).
		if (detail === "full" && style.ring.enabled) {
			for (const [baseId, info] of Object.entries(base.bases)) {
				if (!info.beaconCell) continue;
				const [col, row] = parseCellKey(info.beaconCell);
				worldNodes.push(
					<circle
						key={`ring-${baseId}`}
						cx={(col + 0.5) * tile}
						cy={(row + 0.5) * tile}
						r={info.radius * tile}
						fill="none"
						stroke={info.color}
						strokeWidth={style.ring.strokeWidth}
						strokeDasharray={style.ring.dash}
						opacity={style.ring.opacity}
						vectorEffect="non-scaling-stroke"
					/>,
				);
			}
		}
	}

	// Labels: HTML chips at screen coords (crisp, constant size). Hidden when coarse
	// or disabled via style. Independent of the area drawing above.
	const anchors =
		detail === "full" && style.label.enabled ? baseRegionAnchors(territory, base.bases, tile) : [];

	const labelRender = style.label.render;

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
			<svg width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
				<g transform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}>{worldNodes}</g>
			</svg>
			{anchors.map((a) => {
				const left = a.x * vp.zoom + vp.x;
				const top = a.y * vp.zoom + vp.y;
				if (labelRender) {
					// Host owns the chip; the layer only positions it at the region centre.
					const custom = labelRender(a);
					if (custom == null) return null;
					return (
						<div
							key={a.baseId}
							style={{
								position: "absolute",
								left,
								top,
								transform: "translate(-50%,-50%)",
								pointerEvents: "none",
							}}
						>
							{custom}
						</div>
					);
				}
				return (
					<div
						key={a.baseId}
						style={{
							position: "absolute",
							left,
							top,
							transform: "translate(-50%,-50%)",
							display: "flex",
							alignItems: "center",
							gap: 5,
							padding: "3px 9px",
							background: "rgba(255,255,255,.9)",
							border: `2px solid ${a.color}`,
							borderRadius: 20,
							font: "700 12px system-ui, sans-serif",
							color: "#1c1c1c",
							whiteSpace: "nowrap",
							boxShadow: "0 2px 8px rgba(0,0,0,.14)",
						}}
					>
						<span
							style={{
								width: 10,
								height: 10,
								borderRadius: "50%",
								background: a.color,
								flex: "none",
							}}
						/>
						{a.name}
					</div>
				);
			})}
		</div>
	);
}
