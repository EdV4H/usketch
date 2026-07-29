// The `base-map` shape is a DATA-ONLY registry (like `tilemap`): it holds the
// base registry (name / colour / beacon icon / radius) so bases persist + sync
// (Yjs) + undo through the shape store. It draws NOTHING and owns NO territory —
// each base's territory is DERIVED at read time from its beacon + the terrain
// paint (see territory.ts). Locked and non-hit-testable so it's a substrate.
import type { BoundingBox, ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { DEFAULT_TILE } from "../tilemap-shape.js";

export const BASE_MAP_TYPE = "base-map";

export interface BaseInfo {
	name: string;
	color: string; // hex, e.g. "#EF5350"
	/** Territory radius in tiles around the beacon (the core is always owned). */
	radius: number;
	/** The single beacon: the map-icon whose position seeds this base's core. */
	beaconIconId?: string;
}

export const DEFAULT_BASE_RADIUS = 5;

export interface BaseMapShapeData extends ShapeData {
	type: "base-map";
	tile: number;
	bases: Record<string, BaseInfo>;
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
		locked: true,
	};
}

export function createBaseMapShapeDefinition(tile: number = DEFAULT_TILE): ShapeDefinition {
	return {
		render: () => <g />,
		renderTarget: "svg",
		// The registry itself has no geometry; the territory (derived) is drawn by
		// the BaseAreaLayer, not this substrate.
		getBounds: (): BoundingBox => ({ x: 0, y: 0, width: 0, height: 0 }),
		hitTest: () => false,
		resizable: false,
		resize: (data): ShapeData => data,
		createDefault: (params): ShapeData => ({ ...makeBaseMap(tile), id: params.id }),
		serializeForAi: (data): Record<string, unknown> => {
			const d = data as BaseMapShapeData;
			return {
				kind: "base-map",
				baseCount: Object.keys(d.bases ?? {}).length,
				bases: Object.values(d.bases ?? {}).map((b) => b.name),
			};
		},
		debugFields: (data): Record<string, unknown> => {
			const d = data as BaseMapShapeData;
			return {
				bases: Object.values(d.bases ?? {})
					.map((b) => b.name)
					.join(", "),
			};
		},
	};
}
