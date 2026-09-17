// Read/write helpers for the `window-system-config` singleton. Kept separate from
// the shape definition so the runtime, service, and HUD all locate + mutate config
// through one place (no re-derived "find the singleton" scans), and so the tile
// tree's (de)serialization lives in exactly one spot.
import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { emptyTree, type TileNode } from "./tile-tree.js";
import {
	isWindowConfig,
	makeWindowConfig,
	type WindowConfigData,
	type WindowDefaults,
	type WindowMode,
} from "./window-config-shape.js";

/** Config fields a caller may change (identity/geometry-only subset). */
export type WindowConfigPatch = Partial<
	Pick<
		WindowConfigData,
		| "mode"
		| "viewportLock"
		| "gap"
		| "defaultSplit"
		| "originX"
		| "originY"
		| "focusedId"
		| "fullscreenId"
		| "tree"
	>
>;

/** The placement mode (defaults to `free` when not a window board / unset). */
export function modeOf(store: BoardStore): WindowMode {
	return getWindowConfig(store)?.mode ?? "free";
}

/** Whether the viewport lock (fixed screen) is on. Strict `=== true`. */
export function viewportLockOf(store: BoardStore): boolean {
	return getWindowConfig(store)?.viewportLock === true;
}

/** Inter-window gap in world px (defaults to 8, clamped ≥ 0). */
export function gapOf(store: BoardStore): number {
	const g = getWindowConfig(store)?.gap;
	return typeof g === "number" && Number.isFinite(g) && g >= 0 ? g : 8;
}

/** The orientation new windows split with (defaults to "h"). */
export function defaultSplitOf(store: BoardStore): "h" | "v" {
	return getWindowConfig(store)?.defaultSplit === "v" ? "v" : "h";
}

/** The focused window id, or null. */
export function focusedIdOf(store: BoardStore): string | null {
	return getWindowConfig(store)?.focusedId ?? null;
}

/** The fullscreen window id, or null. */
export function fullscreenIdOf(store: BoardStore): string | null {
	return getWindowConfig(store)?.fullscreenId ?? null;
}

/**
 * The board's config singleton, or `undefined` when this isn't a window board.
 * If two clients enable at once the board can briefly hold more than one config;
 * pick the smallest `id` so every client converges on the SAME one (independent
 * of Map insertion order).
 */
export function getWindowConfig(store: BoardStore): WindowConfigData | undefined {
	let chosen: WindowConfigData | undefined;
	for (const [, shape] of store.getShapes()) {
		if (isWindowConfig(shape) && (chosen === undefined || shape.id < chosen.id)) {
			chosen = shape;
		}
	}
	return chosen;
}

/** Every `window-system-config` shape — normally 0 or 1, but a concurrent enable
 *  can briefly leave more; {@link disable} removes them all. */
export function getAllWindowConfigs(store: BoardStore): WindowConfigData[] {
	const configs: WindowConfigData[] = [];
	for (const [, shape] of store.getShapes()) {
		if (isWindowConfig(shape)) configs.push(shape);
	}
	return configs;
}

/**
 * Return the config singleton, creating it first if absent. Creating it is what
 * turns a plain board INTO a window board. Call after the store has hydrated so a
 * synced config isn't duplicated.
 */
export function ensureWindowConfig(
	store: BoardStore,
	defaults: WindowDefaults = {},
): WindowConfigData {
	const existing = getWindowConfig(store);
	if (existing) return existing;
	const config = makeWindowConfig(defaults);
	store.addShape(config);
	return config;
}

/** Parse the persisted tile tree, or an empty tree when unset/corrupt. */
export function getTree(store: BoardStore): TileNode {
	const json = getWindowConfig(store)?.tree;
	if (!json) return emptyTree();
	try {
		const parsed = JSON.parse(json) as TileNode;
		return isTileNode(parsed) ? parsed : emptyTree();
	} catch {
		return emptyTree();
	}
}

/** Structural guard so a corrupt/foreign JSON blob can't crash the layout math. */
function isTileNode(node: unknown): node is TileNode {
	if (!node || typeof node !== "object") return false;
	const n = node as { type?: unknown; id?: unknown; children?: unknown };
	if (n.type === "leaf") return typeof n.id === "string";
	if (n.type === "split") return Array.isArray(n.children) && n.children.every(isTileNode);
	return false;
}

/** Serialize a tile tree for persistence. */
export function serializeTree(tree: TileNode): string {
	return JSON.stringify(tree);
}

/** Direct (non-undoable) config write. The service wraps size/layout changes in a
 *  command when they should be undoable; transient flags use this as-is. */
export function setConfig(store: BoardStore, patch: WindowConfigPatch): void {
	const config = getWindowConfig(store);
	if (!config) return;
	store.updateShape(config.id, patch as Partial<ShapeData>);
}
