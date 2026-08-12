// The `start-position` shape is a DATA-ONLY singleton: it stores WHERE the board
// should start (a coordinate, an exact camera framing, or a shape to frame) plus
// whether to move there on load. It persists + syncs + undoes through the shape
// store (like the map tilemap) but draws nothing — moving the camera is a
// per-user, ephemeral act done by the plugin, never a synced camera record.
import type { BoundingBox, ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { createElement, type ReactElement } from "react";

export const START_POSITION_TYPE = "start-position";

/**
 * How the board's start view is defined. A tagged union so a fourth mode (e.g.
 * "named bookmark") is just another variant + a resolver branch.
 * - `coordinate` — center on a world point, keeping the viewer's current zoom.
 * - `viewport`   — an exact framing: world center point **and** zoom (画角).
 * - `shape`      — frame a specific shape's bounds; re-derived each time so it
 *   follows the shape if it moves.
 */
export type StartPosition =
	| { kind: "coordinate"; x: number; y: number }
	| { kind: "viewport"; x: number; y: number; zoom: number }
	| { kind: "shape"; shapeId: string; padding?: number };

export interface StartPositionShapeData extends ShapeData {
	type: typeof START_POSITION_TYPE;
	/** The start definition; `undefined` = not configured yet. */
	start?: StartPosition;
	/**
	 * Move each viewer's camera to the start on board load. Per-user/ephemeral —
	 * only the *definition* above is synced, not the live camera. Default `true`.
	 */
	autoApply?: boolean;
}

export function isStartPosition(shape: ShapeData): shape is StartPositionShapeData {
	return shape.type === START_POSITION_TYPE;
}

/**
 * The board's start-position shape, chosen **deterministically** (lowest `id`) so
 * every synced client agrees even if several somehow coexist. `null` if none.
 */
export function findStartPosition(shapes: Iterable<ShapeData>): StartPositionShapeData | null {
	let best: StartPositionShapeData | null = null;
	for (const s of shapes) if (isStartPosition(s) && (best === null || s.id < best.id)) best = s;
	return best;
}

/** Create the data-only singleton (locked, invisible, non-hit-testable). */
export function makeStartPosition(): StartPositionShapeData {
	return {
		id: generateId(),
		type: START_POSITION_TYPE,
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		autoApply: true,
		locked: true,
	};
}

export function createStartPositionShapeDefinition(): ShapeDefinition {
	const zeroBounds = (): BoundingBox => ({ x: 0, y: 0, width: 0, height: 0 });
	return {
		// Renders nothing — it is pure data. (Empty SVG group, like the tilemap.)
		render: (): ReactElement => createElement("g"),
		renderTarget: "svg",
		getBounds: zeroBounds,
		// Never selectable via pointer — it is config, not an object.
		hitTest: () => false,
		resizable: false,
		resize: (data): ShapeData => data,
		createDefault: (params): ShapeData => ({ ...makeStartPosition(), id: params.id }),
		serializeForAi: (data): Record<string, unknown> => {
			const d = data as StartPositionShapeData;
			return { kind: "start-position", start: d.start ?? null, autoApply: d.autoApply !== false };
		},
		debugFields: (data): Record<string, unknown> => {
			const d = data as StartPositionShapeData;
			return { start: d.start?.kind ?? "none", autoApply: d.autoApply !== false };
		},
	};
}
