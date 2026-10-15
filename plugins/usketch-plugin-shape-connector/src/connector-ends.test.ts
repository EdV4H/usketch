import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { isTooShortDrag, moveConnectorEnd, resolveConnectorEnds } from "./connector-ends.js";
import { createDefaultConnector } from "./shapes/connector.js";
import type { ConnectorShapeData } from "./types.js";

function rect(id: string, x: number, y: number): ShapeData {
	return {
		id,
		type: "rectangle",
		x,
		y,
		width: 100,
		height: 60,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	};
}

// a: (0,0)-(100,60) center (50,30). b: (300,0)-(400,60) center (350,30).
const a = rect("a", 0, 0);
const b = rect("b", 300, 0);

describe("isTooShortDrag", () => {
	it("treats a drag under 4 screen px as a click", () => {
		expect(isTooShortDrag({ x: 0, y: 0 }, { x: 3, y: 0 }, 1)).toBe(true);
		expect(isTooShortDrag({ x: 0, y: 0 }, { x: 4, y: 0 }, 1)).toBe(false);
	});

	it("measures in screen px, so zoom scales the world distance", () => {
		// 3 world units at zoom 2 = 6 screen px.
		expect(isTooShortDrag({ x: 0, y: 0 }, { x: 3, y: 0 }, 2)).toBe(false);
		// 6 world units at zoom 0.5 = 3 screen px.
		expect(isTooShortDrag({ x: 0, y: 0 }, { x: 6, y: 0 }, 0.5)).toBe(true);
	});
});

describe("resolveConnectorEnds", () => {
	it("connects both ends to shapes with auto anchors", () => {
		const ends = resolveConnectorEnds(
			{ shape: a, anchor: "auto", point: { x: 50, y: 30 } },
			{ shape: b, anchor: "auto", point: { x: 350, y: 30 } },
		);
		expect(ends.sourceId).toBe("a");
		expect(ends.targetId).toBe("b");
		expect(ends.sourcePoint).toEqual({ x: 100, y: 30 });
		expect(ends.targetPoint).toEqual({ x: 300, y: 30 });
		expect(ends).toMatchObject({ x: 100, y: 30, width: 200, height: 0 });
	});

	it("fixes a free target at its point and aims the source anchor at it", () => {
		const ends = resolveConnectorEnds(
			{ shape: a, anchor: "auto", point: { x: 50, y: 30 } },
			{ shape: null, anchor: "auto", point: { x: 400, y: 30 } },
		);
		expect(ends.sourceId).toBe("a");
		expect(ends.targetId).toBeUndefined();
		expect(ends.sourcePoint).toEqual({ x: 100, y: 30 });
		expect(ends.targetPoint).toEqual({ x: 400, y: 30 });
	});

	it("fixes a free source and connects the target", () => {
		const ends = resolveConnectorEnds(
			{ shape: null, anchor: "auto", point: { x: 0, y: 30 } },
			{ shape: b, anchor: "auto", point: { x: 350, y: 30 } },
		);
		expect(ends.sourceId).toBeUndefined();
		expect(ends.targetId).toBe("b");
		expect(ends.sourcePoint).toEqual({ x: 0, y: 30 });
		expect(ends.targetPoint).toEqual({ x: 300, y: 30 });
	});

	it("keeps both points when both ends are free", () => {
		const ends = resolveConnectorEnds(
			{ shape: null, anchor: "auto", point: { x: 10, y: 50 } },
			{ shape: null, anchor: "auto", point: { x: 110, y: 20 } },
		);
		expect(ends.sourceId).toBeUndefined();
		expect(ends.targetId).toBeUndefined();
		expect(ends).toMatchObject({
			sourcePoint: { x: 10, y: 50 },
			targetPoint: { x: 110, y: 20 },
			x: 10,
			y: 20,
			width: 100,
			height: 30,
		});
	});

	it("honors a fixed side anchor and a custom point on a shape", () => {
		const ends = resolveConnectorEnds(
			{ shape: a, anchor: "bottom", point: { x: 50, y: 60 } },
			{ shape: b, anchor: "custom", point: { x: 300, y: 10 } },
		);
		expect(ends.sourceAnchor).toBe("bottom");
		expect(ends.sourcePoint).toEqual({ x: 50, y: 60 });
		expect(ends.targetAnchor).toBe("custom");
		expect(ends.targetPoint).toEqual({ x: 300, y: 10 });
	});
});

describe("moveConnectorEnd", () => {
	function connector(overrides: Partial<ConnectorShapeData>): ConnectorShapeData {
		return { ...createDefaultConnector({ id: "c1", x: 0, y: 0 }), ...overrides };
	}
	const shapes = new Map([
		["a", a],
		["b", b],
	]);
	const getShape = (id: string) => shapes.get(id);

	it("moves a free end to an empty spot", () => {
		const c = connector({
			sourceId: "a",
			sourcePoint: { x: 100, y: 30 },
			targetPoint: { x: 400, y: 30 },
		});
		const patch = moveConnectorEnd(
			c,
			"target",
			{ shape: null, point: { x: 50, y: 300 } },
			getShape,
		);
		expect(patch.targetId).toBeUndefined();
		expect(patch.targetPoint).toEqual({ x: 50, y: 300 });
		// a's auto anchor now faces down toward the free end.
		expect(patch.sourcePoint).toEqual({ x: 50, y: 60 });
	});

	it("connects a free end dropped on a shape", () => {
		const c = connector({
			sourceId: "a",
			sourcePoint: { x: 100, y: 30 },
			targetPoint: { x: 200, y: 30 },
		});
		const patch = moveConnectorEnd(c, "target", { shape: b, point: { x: 350, y: 30 } }, getShape);
		expect(patch.targetId).toBe("b");
		expect(patch.targetAnchor).toBe("auto");
		expect(patch.targetPoint).toEqual({ x: 300, y: 30 });
	});

	it("connects an end even when the other end is free", () => {
		const c = connector({
			sourcePoint: { x: 0, y: 30 },
			targetPoint: { x: 200, y: 30 },
		});
		const patch = moveConnectorEnd(c, "target", { shape: b, point: { x: 350, y: 30 } }, getShape);
		expect(patch.sourceId).toBeUndefined();
		expect(patch.sourcePoint).toEqual({ x: 0, y: 30 });
		expect(patch.targetId).toBe("b");
		expect(patch.targetPoint).toEqual({ x: 300, y: 30 });
	});

	it("detaches a connected end dropped on an empty spot", () => {
		const c = connector({
			sourceId: "a",
			targetId: "b",
			sourcePoint: { x: 100, y: 30 },
			targetPoint: { x: 300, y: 30 },
		});
		const patch = moveConnectorEnd(
			c,
			"source",
			{ shape: null, point: { x: 50, y: 200 } },
			getShape,
		);
		expect(patch.sourceId).toBeUndefined();
		expect(patch.sourcePoint).toEqual({ x: 50, y: 200 });
		expect(patch.targetId).toBe("b");
		expect("sourceId" in patch).toBe(true);
	});

	it("slides along the current shape as a custom anchor, even with a free other end", () => {
		const c = connector({
			sourceId: "a",
			sourcePoint: { x: 100, y: 30 },
			targetPoint: { x: 400, y: 30 },
		});
		const patch = moveConnectorEnd(c, "source", { shape: a, point: { x: 95, y: 10 } }, getShape);
		expect(patch.sourceId).toBe("a");
		expect(patch.sourceAnchor).toBe("custom");
		expect(patch.sourcePoint).toEqual({ x: 100, y: 10 });
		expect(patch.targetPoint).toEqual({ x: 400, y: 30 });
	});

	it("stores the slid custom point as a ratio of the shape so tracking can recompute it", () => {
		const c = connector({
			sourceId: "a",
			sourcePoint: { x: 100, y: 30 },
			targetPoint: { x: 400, y: 30 },
		});
		const patch = moveConnectorEnd(c, "source", { shape: a, point: { x: 95, y: 15 } }, getShape);
		expect(patch.sourceAnchorRatio).toEqual({ x: 1, y: 0.25 });
		expect(patch).not.toHaveProperty("targetAnchorRatio");
	});

	it("keeps the other end's custom point", () => {
		const c = connector({
			sourceId: "a",
			sourceAnchor: "custom",
			sourcePoint: { x: 100, y: 10 },
			targetPoint: { x: 400, y: 30 },
		});
		const patch = moveConnectorEnd(
			c,
			"target",
			{ shape: null, point: { x: 400, y: 200 } },
			getShape,
		);
		expect(patch.sourcePoint).toEqual({ x: 100, y: 10 });
		expect(patch.sourceAnchor).toBe("custom");
	});
});
