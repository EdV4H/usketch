import {
	DEFAULT_STYLE,
	type ShapeData,
	type ShapeDefinition,
	type ShapeRegistry,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { serializeFreedrawForRecognition } from "../freedraw-serializer.js";

function makeShape(overrides: Partial<ShapeData> & { id: string; type: string }): ShapeData {
	return {
		id: overrides.id,
		type: overrides.type,
		x: overrides.x ?? 0,
		y: overrides.y ?? 0,
		width: overrides.width ?? 100,
		height: overrides.height ?? 100,
		style: overrides.style ?? { ...DEFAULT_STYLE },
	} as ShapeData;
}

function makeRegistry(defs: Record<string, Partial<ShapeDefinition>>): ShapeRegistry {
	const map = new Map(
		Object.entries(defs).map(([type, def]) => [type, def as unknown as ShapeDefinition]),
	);
	return {
		register: () => {},
		get: (type) => map.get(type),
		getAll: () => map as unknown as ReturnType<ShapeRegistry["getAll"]>,
	};
}

describe("serializeFreedrawForRecognition", () => {
	it("emits stroke entries only for shapes whose serializeForRecognition returns a stroke", () => {
		const stroke = makeShape({ id: "f1", type: "freedraw", x: 10, y: 20, width: 50, height: 30 });
		const text = makeShape({ id: "t1", type: "text" });
		const registry = makeRegistry({
			freedraw: {
				serializeForRecognition: () => ({
					kind: "stroke",
					points: [
						{ x: 10, y: 20 },
						{ x: 30, y: 40 },
					],
				}),
			},
			text: { serializeForRecognition: () => null },
		});

		const json = JSON.parse(serializeFreedrawForRecognition([stroke, text], registry));
		expect(json.strokes).toHaveLength(1);
		expect(json.strokes[0]).toMatchObject({
			id: "f1",
			pointCount: 2,
			bounds: { x: 10, y: 20, w: 50, h: 30 },
		});
		expect(Array.isArray(json.strokes[0].points)).toBe(true);
	});

	it("ignores shapes whose plugin doesn't implement serializeForRecognition", () => {
		const stray = makeShape({ id: "s1", type: "rect" });
		const registry = makeRegistry({ rect: {} });

		const json = JSON.parse(serializeFreedrawForRecognition([stray], registry));
		expect(json.strokes).toHaveLength(0);
	});

	it("ignores recognition payloads of the wrong shape (image, malformed)", () => {
		const img = makeShape({ id: "i1", type: "image" });
		const registry = makeRegistry({
			image: { serializeForRecognition: () => ({ kind: "image", src: "x" }) },
		});

		const json = JSON.parse(serializeFreedrawForRecognition([img], registry));
		expect(json.strokes).toHaveLength(0);
	});

	it("downsamples large stroke payloads while preserving pointCount", () => {
		const big = makeShape({ id: "b1", type: "freedraw" });
		const points = Array.from({ length: 200 }, (_, i) => ({ x: i, y: i * 2 }));
		const registry = makeRegistry({
			freedraw: { serializeForRecognition: () => ({ kind: "stroke", points }) },
		});

		const json = JSON.parse(serializeFreedrawForRecognition([big], registry));
		expect(json.strokes[0].pointCount).toBe(200);
		expect(json.strokes[0].points.length).toBe(80);
	});
});
