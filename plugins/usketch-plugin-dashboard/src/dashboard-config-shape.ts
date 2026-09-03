// Pure data + predicates for the `dashboard-config` singleton (no JSX, so every
// pure module — config-ops, items, runtime, service — and the unit tests can
// import it without pulling in React). The JSX shape-definition factory lives
// alongside in `dashboard-config-shape-def.tsx`.
//
// The `dashboard-config` shape is a DATA-ONLY singleton (same substrate pattern as
// map's `tilemap` / `base-map`): it holds the board's grid settings — columns,
// cell size, gap, padding, and the world origin the grid is anchored to — so the
// dashboard layout persists + syncs (Yjs) + undoes through the shape store. It
// draws NOTHING, owns no geometry, and is locked + non-hit-testable so it can
// never be selected or become a grid item itself.
import type { ShapeData } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";

export const DASHBOARD_CONFIG_TYPE = "dashboard-config";

/**
 * Placement mode:
 * - `flow` — items pack compactly in reading order (sortable; no gaps).
 * - `absolute` — each item stays in the cell it's dropped on (gaps allowed).
 */
export type DashboardMode = "flow" | "absolute";

/**
 * Scroll-limit toggle. When ON, the viewport is locked to 100% zoom and the cell
 * width auto-fits so the grid exactly fills the screen width — so there's no
 * horizontal room and you scroll vertically only, bounded to the content. When OFF,
 * pan/zoom are free. (Was a `"off"|"vertical"|"both"` mode; now a simple on/off.)
 */
export type ViewportLock = boolean;

/** Grid settings persisted on the singleton. Geometry (`originX`/`originY`) lives
 *  here too so the grid anchor is stable across reflows and reloads. */
export interface DashboardConfigData extends ShapeData {
	type: "dashboard-config";
	columns: number;
	cellW: number;
	cellH: number;
	gap: number;
	padding: number;
	originX: number;
	originY: number;
	mode: DashboardMode;
	/** When true, resizing an item snaps its size to the nearest whole-cell span. */
	fitToGrid: boolean;
	/** When true, a shape dragged OUT of the grid's column range is left free
	 *  (unmanaged). When false, every top-level shape is managed regardless of
	 *  position. */
	freeOutOfRange: boolean;
	/** Scroll-limit toggle. See {@link ViewportLock}. */
	viewportLock: ViewportLock;
	/** Whether the cell WIDTH is "auto" (fit to the screen width). Drives the
	 *  scroll-limit mode: fixed numeric width → vertical-only; auto → both axes. */
	cellWAuto: boolean;
	/** In `absolute` mode, whether dropping an item onto an occupied cell makes that
	 *  occupant AVOID it — stepping to the nearest empty cell — instead of the drop
	 *  colliding. (Named `swap` historically.) No effect in `flow` (always reorders). */
	swap: boolean;
	/** Avoid trigger sensitivity (0–1): the minimum overlap ratio between the dropped
	 *  item and an occupant for the occupant to move aside. Lower = easier. */
	swapThreshold: number;
	/** Dwell before the LIVE avoid fires (ms): how long the dragged item must hover an
	 *  occupant before it steps aside. 0 = immediate. Only gates the drag-time preview;
	 *  a drop always resolves immediately. */
	swapDelay: number;
}

export interface DashboardDefaults {
	columns?: number;
	cellW?: number;
	cellH?: number;
	gap?: number;
	padding?: number;
	originX?: number;
	originY?: number;
	mode?: DashboardMode;
	fitToGrid?: boolean;
	freeOutOfRange?: boolean;
	viewportLock?: ViewportLock;
	cellWAuto?: boolean;
	swap?: boolean;
	swapThreshold?: number;
	swapDelay?: number;
}

export const DASHBOARD_DEFAULTS: Required<DashboardDefaults> = {
	columns: 4,
	cellW: 200,
	cellH: 140,
	gap: 16,
	padding: 24,
	originX: 0,
	originY: 0,
	mode: "flow",
	fitToGrid: false,
	freeOutOfRange: true,
	viewportLock: false,
	cellWAuto: false,
	swap: false,
	swapThreshold: 0.25,
	swapDelay: 0,
};

export function isDashboardConfig(shape: ShapeData): shape is DashboardConfigData {
	return shape.type === DASHBOARD_CONFIG_TYPE;
}

export function makeDashboardConfig(defaults: DashboardDefaults = {}): DashboardConfigData {
	const d = { ...DASHBOARD_DEFAULTS, ...defaults };
	return {
		id: generateId(),
		type: DASHBOARD_CONFIG_TYPE,
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		columns: d.columns,
		cellW: d.cellW,
		cellH: d.cellH,
		gap: d.gap,
		padding: d.padding,
		originX: d.originX,
		originY: d.originY,
		mode: d.mode,
		fitToGrid: d.fitToGrid,
		freeOutOfRange: d.freeOutOfRange,
		viewportLock: d.viewportLock,
		cellWAuto: d.cellWAuto,
		swap: d.swap,
		swapThreshold: d.swapThreshold,
		swapDelay: d.swapDelay,
		locked: true,
	};
}
