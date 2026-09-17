// Pure data + predicates for the `window-system-config` singleton (no JSX, so the
// pure modules — config-ops, items, runtime, service — and the unit tests import
// it without pulling in React). The JSX shape-definition factory lives alongside
// in `window-config-shape-def.tsx`.
//
// Like dashboard's `dashboard-config`, this is a DATA-ONLY singleton: it holds the
// window system's settings (placement mode, viewport-lock flag, gap, default split
// orientation, the fixed-screen world origin, the focused window id, and the tile
// TREE serialized as JSON) so the whole layout persists + syncs (Yjs) + undoes
// through the shape store. It draws NOTHING, owns no geometry, and is locked +
// non-hit-testable so it can never be selected or become a window itself.
import type { ShapeData } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import type { SplitDir } from "./tile-tree.js";

export const WINDOW_CONFIG_TYPE = "window-system-config";

/**
 * Placement mode:
 * - `free` — windows float; you drag them anywhere (the plugin doesn't lay out).
 * - `tile` — windows tile to the i3/sway tree that fills the fixed screen.
 */
export type WindowMode = "free" | "tile";

/** Settings persisted on the singleton. The tile `tree` is JSON (last-writer-wins,
 *  same coordination level as dashboard's config). */
export interface WindowConfigData extends ShapeData {
	type: "window-system-config";
	mode: WindowMode;
	/** When true, the camera is frozen to 100%/origin so the Canvas is a fixed screen. */
	viewportLock: boolean;
	/** Gap (world px) between tiled windows. */
	gap: number;
	/** Orientation used when a new window splits near the focus. */
	defaultSplit: SplitDir;
	/** World origin the fixed screen is pinned to (top-left). */
	originX: number;
	originY: number;
	/** The window that focus/move/resize/split act on (selection-synced). */
	focusedId: string | null;
	/** When set, that window fills the whole screen (others sit underneath). */
	fullscreenId: string | null;
	/** The i3/sway tile tree, serialized. Empty string = no tree yet. */
	tree: string;
}

export interface WindowDefaults {
	mode?: WindowMode;
	viewportLock?: boolean;
	gap?: number;
	defaultSplit?: SplitDir;
	originX?: number;
	originY?: number;
}

export const WINDOW_DEFAULTS: Required<WindowDefaults> = {
	mode: "tile",
	viewportLock: true,
	gap: 8,
	defaultSplit: "h",
	originX: 0,
	originY: 0,
};

export function isWindowConfig(shape: ShapeData): shape is WindowConfigData {
	return shape.type === WINDOW_CONFIG_TYPE;
}

export function makeWindowConfig(defaults: WindowDefaults = {}): WindowConfigData {
	const d = { ...WINDOW_DEFAULTS, ...defaults };
	return {
		id: generateId(),
		type: WINDOW_CONFIG_TYPE,
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		mode: d.mode,
		viewportLock: d.viewportLock,
		gap: d.gap,
		defaultSplit: d.defaultSplit,
		originX: d.originX,
		originY: d.originY,
		focusedId: null,
		fullscreenId: null,
		tree: "",
		locked: true,
	};
}
