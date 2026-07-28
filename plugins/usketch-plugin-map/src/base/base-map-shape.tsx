// The `base-map` shape is a DATA-ONLY record (like `tilemap`): it holds the base
// registry + per-tile ownership so they persist + sync (Yjs) + undo through the
// shape store, but draws NOTHING itself — the BaseAreaLayer renders the areas.
// Locked and non-hit-testable so it's a substrate, not a selectable object.
import type { BoundingBox, ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { cellKey, cellsBounds, parseCellKey } from "../autotile.js";
import { DEFAULT_TILE } from "../tilemap-shape.js";

export const BASE_MAP_TYPE = "base-map";

export interface BaseInfo {
	name: string;
	color: string; // hex, e.g. "#EF5350"
}

/** cellKey("c,r") → baseId (sparse ownership map). */
export type OwnerMap = Record<string, string>;

export interface BaseMapShapeData extends ShapeData {
	type: "base-map";
	tile: number;
	bases: Record<string, BaseInfo>;
	owner: OwnerMap;
}

export function isBaseMap(shape: ShapeData): shape is BaseMapShapeData {
	return shape.type === BASE_MAP_TYPE;
}

export function makeBaseMap(tile: number): BaseMapShapeData {
	return {
		id: generateId(),
		type: "base-map",
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		tile,
		bases: {},
		owner: {},
		locked: true,
	};
}

/** Bounds of all owned cells (keys are cellKeys). */
export function ownerBounds(owner: OwnerMap, tile: number): BoundingBox {
	// cellsBounds only reads keys, so the value type is irrelevant here.
	return cellsBounds(owner as Record<string, never>, tile);
}

export function createBaseMapShapeDefinition(tile: number = DEFAULT_TILE): ShapeDefinition {
	return {
		render: () => <g />,
		renderTarget: "svg",
		getBounds: (data): BoundingBox => {
			const d = data as BaseMapShapeData;
			return ownerBounds(d.owner ?? {}, d.tile ?? tile);
		},
		hitTest: () => false,
		resizable: false,
		resize: (data): ShapeData => data,
		createDefault: (params): ShapeData => ({ ...makeBaseMap(tile), id: params.id }),
		move: (data, dx, dy): Partial<ShapeData> => {
			const d = data as BaseMapShapeData;
			const t = d.tile ?? tile;
			const dc = Math.round(dx / t);
			const dr = Math.round(dy / t);
			if (dc === 0 && dr === 0) return {};
			const next: OwnerMap = {};
			for (const [key, baseId] of Object.entries(d.owner)) {
				const [c, r] = parseCellKey(key);
				next[cellKey(c + dc, r + dr)] = baseId;
			}
			return { owner: next, ...ownerBounds(next, t) } as Partial<ShapeData>;
		},
		serializeForAi: (data): Record<string, unknown> => {
			const d = data as BaseMapShapeData;
			return {
				kind: "base-map",
				baseCount: Object.keys(d.bases ?? {}).length,
				ownedCells: Object.keys(d.owner ?? {}).length,
			};
		},
		debugFields: (data): Record<string, unknown> => {
			const d = data as BaseMapShapeData;
			return {
				bases: Object.values(d.bases ?? {})
					.map((t) => t.name)
					.join(", "),
				ownedCells: Object.keys(d.owner ?? {}).length,
			};
		},
	};
}
