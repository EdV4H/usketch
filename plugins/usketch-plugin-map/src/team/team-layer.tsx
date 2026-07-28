// TeamAreaLayer — renders each team's owned tiles as a translucent coloured
// territory (fill + border + name label) above the terrain and below shapes.
// Reads ownership DATA from the synced `team-map` shape; LOD + culling mirror
// the terrain MapLayer.
import type { BoardStore, RenderMode } from "@edv4h/usketch-shared";
import { useEffect, useRef, useState } from "react";
import { type Cells, exposedEdges, parseCellKey } from "../autotile.js";
import { blockFactor, downsampleCells, type TileDetail, tileDetail } from "../lod.js";
import { visibleCellRange, visibleWorldRect } from "../map-layer.js";
import { MAP_TOOL_ID } from "../map-tool-id.js";
import { useMapToolState } from "../tool-state.js";
import type { OwnerMap, TeamInfo } from "./team-map-shape.js";
import { getTeamMap, teamRegionAnchors } from "./team-ops.js";

const FILL_OPACITY = 0.24;
const BORDER_RATIO = 0.16; // border strip thickness, fraction of a tile
const BORDER_OPACITY = 0.85;

/** Full tier: per-cell translucent fill + team-coloured border on region edges. */
function renderFull(
	owner: OwnerMap,
	teams: Record<string, TeamInfo>,
	tile: number,
	visible: DOMRectReadOnly | null,
): React.ReactElement[] {
	const nodes: React.ReactElement[] = [];
	const asCells = owner as unknown as Cells; // exposedEdges only compares values
	const bt = BORDER_RATIO * tile;
	const range = visibleCellRange(visible, tile);
	const emit = (c: number, r: number) => {
		const teamId = owner[`${c},${r}`];
		if (!teamId) return;
		const color = teams[teamId]?.color;
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

/** Coarse tier: flat translucent blocks (downsampled by owning team). */
function renderCoarse(
	owner: OwnerMap,
	teams: Record<string, TeamInfo>,
	tile: number,
	screenTilePx: number,
	visible: DOMRectReadOnly | null,
): React.ReactElement[] {
	const factor = blockFactor(screenTilePx);
	const bt = factor * tile;
	const nodes: React.ReactElement[] = [];
	for (const [bk, teamId] of Object.entries(downsampleCells(owner as unknown as Cells, factor))) {
		const color = teams[teamId]?.color;
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

export function TeamAreaLayer({
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

	// Territory paint is only shown while actually in team mode (map tool + team
	// submode) — mirrors the EnterBanner indicator gating. Check the mode first so
	// we skip the shape scan in getTeamMap on every non-team-mode re-render.
	const inTeamMode = store.getActiveToolId() === MAP_TOOL_ID && tool.mode === "team";
	if (!inTeamMode) return null;
	const team = getTeamMap(store);
	if (!team || Object.keys(team.owner).length === 0) return null;

	const vp = store.getViewport();
	const visible = visibleWorldRect(store);
	const tile = team.tile;
	const screenTilePx = tile * vp.zoom;
	const detail: TileDetail = tileDetail(screenTilePx, renderMode);
	const cells =
		detail === "full"
			? renderFull(team.owner, team.teams, tile, visible)
			: renderCoarse(team.owner, team.teams, tile, screenTilePx, visible);

	// Labels: HTML chips at screen coords (crisp, constant size). Hidden when coarse.
	const anchors = detail === "full" ? teamRegionAnchors(team.owner, team.teams, tile) : [];

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
			<svg width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
				<g transform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}>{cells}</g>
			</svg>
			{anchors.map((a) => (
				<div
					key={a.teamId}
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
