// A decorative overlay that draws the dashboard's target cells, so it's obvious
// WHERE items snap. Pure presentation → a rendering Layer (app-local, not synced),
// following the same pattern as the bg-grid plugin. It reads the grid spec from
// the config singleton in the render context's shapes, so it reacts to config
// edits and disappears automatically on a non-dashboard board.
import type { LayerRenderContext, ShapeData } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { isDashboardConfig } from "./dashboard-config-shape.js";
import { getDragTarget, subscribeDragTarget } from "./drag-target-store.js";
import { cellTopLeft, type GridSpec } from "./grid.js";

export const GRID_OVERLAY_LAYER_ID = "usketch-plugin-dashboard:grid-overlay";

// ── Shared visibility state (module-scoped, app-local; toggled from the HUD) ──
let visible = true;
const listeners = new Set<() => void>();

/** Show/hide the grid overlay. */
export function setGridOverlayVisible(next: boolean): void {
	if (next === visible) return;
	visible = next;
	for (const fn of listeners) fn();
}
export function isGridOverlayVisible(): boolean {
	return visible;
}
/** Reset to the default (visible) — call on plugin setup so a remount starts fresh. */
export function resetGridOverlayVisible(): void {
	setGridOverlayVisible(true);
}
function subscribe(cb: () => void): () => void {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

/** Smallest-id config → GridSpec (matches getDashboardConfig's deterministic pick). */
function specFromShapes(shapes: ReadonlyMap<string, ShapeData>): GridSpec | null {
	let chosen: ShapeData | null = null;
	for (const shape of shapes.values()) {
		if (isDashboardConfig(shape) && (chosen === null || shape.id < chosen.id)) chosen = shape;
	}
	if (!chosen) return null;
	const c = chosen as ShapeData & GridSpec;
	return {
		columns: c.columns,
		cellW: c.cellW,
		cellH: c.cellH,
		gap: c.gap,
		padding: c.padding,
		originX: c.originX,
		originY: c.originY,
	};
}

/** How many rows the current top-level items actually occupy, from their bottom
 *  edges — so a spanning item (which covers several cells) extends the drawn grid
 *  rather than being under-counted as a single cell. Own-flag locked/hidden only
 *  (ancestor checks need the store, but overlay sizing needn't be exact). */
function usedRows(shapes: ReadonlyMap<string, ShapeData>, spec: GridSpec): number {
	const stepY = spec.cellH + spec.gap;
	if (stepY <= 0) return 1;
	let maxRow = 0;
	let any = false;
	for (const s of shapes.values()) {
		if (isDashboardConfig(s)) continue;
		if (typeof s.parentId === "string") continue;
		if (s.width <= 0 || s.height <= 0) continue;
		if (s.locked || s.hidden) continue;
		any = true;
		const bottomRow = Math.ceil((s.y + s.height - spec.originY - spec.padding) / stepY);
		if (bottomRow > maxRow) maxRow = bottomRow;
	}
	return any ? maxRow : 1;
}

function GridOverlay({ viewport, shapes }: Pick<LayerRenderContext, "viewport" | "shapes">) {
	const show = useSyncExternalStore(subscribe, isGridOverlayVisible, isGridOverlayVisible);
	const dragTarget = useSyncExternalStore(subscribeDragTarget, getDragTarget, getDragTarget);
	const spec = specFromShapes(shapes);
	if (!spec) return null; // not a dashboard board
	if (!show && !dragTarget) return null; // nothing to draw

	const z = viewport.zoom;
	const cells = [];
	if (show) {
		const cols = Math.max(1, Math.floor(spec.columns));
		// Cover all items' actual footprints (span-aware) plus one spare row for the
		// next drop (min 2 rows), capped so a huge board can't explode the cell count.
		const rows = Math.max(2, usedRows(shapes, spec) + 1);
		const cellCount = Math.min(cols * rows, 300);
		const w = spec.cellW * z;
		const h = spec.cellH * z;
		for (let i = 0; i < cellCount; i++) {
			const tl = cellTopLeft(i, spec);
			cells.push(
				<rect
					key={i}
					x={viewport.x + tl.x * z}
					y={viewport.y + tl.y * z}
					width={w}
					height={h}
					rx={4}
					fill="rgba(99,102,241,0.06)"
					stroke="rgba(99,102,241,0.55)"
					strokeWidth={1}
					strokeDasharray="6 4"
				/>,
			);
		}
	}

	// The drop-target cell: highlighted (brighter, solid) so it's obvious where the
	// dragged item will land — including over empty space, where nothing else moves.
	const highlight = dragTarget ? (
		<rect
			x={viewport.x + dragTarget.x * z}
			y={viewport.y + dragTarget.y * z}
			width={dragTarget.width * z}
			height={dragTarget.height * z}
			rx={4}
			fill="rgba(99,102,241,0.18)"
			stroke="rgba(99,102,241,0.95)"
			strokeWidth={2}
		/>
	) : null;

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<title>Dashboard grid</title>
				{cells}
				{highlight}
			</svg>
		</div>
	);
}

/** The overlay layer descriptor. Registered in the plugin's setup. */
export const gridOverlayLayer = {
	id: GRID_OVERLAY_LAYER_ID,
	order: 20,
	avoidCollision: true,
	fixed: true,
	render: (ctx: LayerRenderContext) => <GridOverlay viewport={ctx.viewport} shapes={ctx.shapes} />,
};
