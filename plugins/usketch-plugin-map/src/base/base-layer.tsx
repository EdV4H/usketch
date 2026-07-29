// BaseAreaLayer — renders each base's owned tiles as a translucent coloured
// territory (fill + border + name label) above the terrain and below shapes.
// Reads ownership DATA from the synced `base-map` shape; LOD + culling mirror
// the terrain MapLayer.
import type { BoardStore, RenderMode } from "@edv4h/usketch-shared";
import { useEffect, useRef, useState } from "react";
import { type Cells, exposedEdges, parseCellKey } from "../autotile.js";
import { blockFactor, downsampleCells, type TileDetail, tileDetail } from "../lod.js";
import { MAP_ICON_TYPE, type MapIconShapeData } from "../map-icon-shape.js";
import { visibleCellRange, visibleWorldRect } from "../map-layer.js";
import { MAP_TOOL_ID } from "../map-tool-id.js";
import { useMapToolState } from "../tool-state.js";
import type { BaseInfo, OwnerMap } from "./base-map-shape.js";
import { baseRegionAnchors, getBaseMap } from "./base-ops.js";

const FILL_OPACITY = 0.24;
const BORDER_RATIO = 0.16; // border strip thickness, fraction of a tile
const BORDER_OPACITY = 0.85;

/** Full tier: per-cell translucent fill + base-coloured border on region edges. */
function renderFull(
	owner: OwnerMap,
	bases: Record<string, BaseInfo>,
	tile: number,
	visible: DOMRectReadOnly | null,
): React.ReactElement[] {
	const nodes: React.ReactElement[] = [];
	const asCells = owner as unknown as Cells; // exposedEdges only compares values
	const bt = BORDER_RATIO * tile;
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
				fillOpacity={FILL_OPACITY}
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
				fillOpacity={BORDER_OPACITY}
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
	owner: OwnerMap,
	bases: Record<string, BaseInfo>,
	tile: number,
	screenTilePx: number,
	visible: DOMRectReadOnly | null,
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
			<rect key={bk} x={x} y={y} width={bt} height={bt} fill={color} fillOpacity={FILL_OPACITY} />,
		);
	}
	return nodes;
}

export function BaseAreaLayer({
	store,
	renderMode,
}: {
	store: BoardStore;
	renderMode?: RenderMode;
}) {
	const tool = useMapToolState();
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

	// Territory paint is only shown while actually in base mode (map tool + base
	// submode) — mirrors the EnterBanner indicator gating. Check the mode first so
	// we skip the shape scan in getBaseMap on every non-base-mode re-render.
	const inBaseMode = store.getActiveToolId() === MAP_TOOL_ID && tool.mode === "base";
	if (!inBaseMode) return null;
	const base = getBaseMap(store);
	if (!base || Object.keys(base.owner).length === 0) return null;

	const vp = store.getViewport();
	const visible = visibleWorldRect(store);
	const tile = base.tile;
	const screenTilePx = tile * vp.zoom;
	const detail: TileDetail = tileDetail(screenTilePx, renderMode);
	const cells =
		detail === "full"
			? renderFull(base.owner, base.bases, tile, visible)
			: renderCoarse(base.owner, base.bases, tile, screenTilePx, visible);

	// Labels: HTML chips at screen coords (crisp, constant size). Hidden when coarse.
	const anchors = detail === "full" ? baseRegionAnchors(base.owner, base.bases, tile) : [];

	// Radius rings for beacon icons (icons stamped via "アイコン中心"). Full detail only.
	const rings: React.ReactElement[] = [];
	if (detail === "full") {
		for (const [, s] of store.getShapes()) {
			if (s.type !== MAP_ICON_TYPE) continue;
			const meta = (s as MapIconShapeData).meta;
			if (!meta?.baseId || !meta.baseRadius) continue;
			const color = base.bases[meta.baseId]?.color;
			if (!color) continue;
			rings.push(
				<circle
					key={`ring-${s.id}`}
					cx={s.x + s.width / 2}
					cy={s.y + s.height / 2}
					r={meta.baseRadius * tile}
					fill="none"
					stroke={color}
					strokeWidth={2}
					strokeDasharray="8 6"
					opacity={0.7}
					vectorEffect="non-scaling-stroke"
				/>,
			);
		}
	}

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
			<svg width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
				<g transform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}>
					{cells}
					{rings}
				</g>
			</svg>
			{anchors.map((a) => (
				<div
					key={a.baseId}
					style={{
						position: "absolute",
						left: a.x * vp.zoom + vp.x,
						top: a.y * vp.zoom + vp.y,
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
			))}
		</div>
	);
}
