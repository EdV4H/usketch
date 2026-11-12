// Shape definitions for the two data-only substrates (see elevation-field.ts). They draw
// nothing (the ground layer does), are never hit, can't be resized and ignore moves:
// the heights are tied to world positions.
import type { ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import {
	type ElevationChunkShape,
	type ElevationFieldShape,
	makeFieldShape,
	normalizeField,
} from "./elevation-field.js";

function substrate(
	describe: (data: ShapeData) => Record<string, unknown>,
	createDefault: ShapeDefinition["createDefault"],
): ShapeDefinition {
	return {
		render: () => <g />,
		renderTarget: "svg",
		getBounds: (data) => ({ x: data.x, y: data.y, width: data.width, height: data.height }),
		hitTest: () => false,
		resizable: false,
		resize: (data) => data,
		move: () => ({}),
		createDefault,
		serializeForAi: describe,
		debugFields: describe,
	};
}

export function createFieldShapeDefinition(): ShapeDefinition {
	return substrate(
		(data) => {
			const f = normalizeField(data as ElevationFieldShape);
			return {
				kind: "elevation-field",
				spacing: f.spacing,
				seed: f.seed,
				relief: f.seed !== null ? f.gen.relief : null,
				waterLevel: f.waterLevel,
			};
		},
		(params) => makeFieldShape(params.id),
	);
}

export function createChunkShapeDefinition(): ShapeDefinition {
	return substrate(
		(data) => {
			const c = data as ElevationChunkShape;
			return { kind: "elevation-chunk", field: c.field, cx: c.cx, cy: c.cy };
		},
		(params) => ({
			id: params.id,
			type: "elevation-chunk",
			x: params.x,
			y: params.y,
			width: 0,
			height: 0,
			style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
			locked: true,
			field: "",
			cx: 0,
			cy: 0,
			data: "",
		}),
	);
}
