import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { computeAnchorChange } from "./anchor-change.js";
import type { ConnectorShapeData } from "./types.js";

const rect = (id: string, x: number, y: number): ShapeData =>
	({ id, type: "rect", x, y, width: 100, height: 60, rotation: 0 }) as ShapeData;

const a = rect("a", 0, 0);
const b = rect("b", 300, 100);

function connector(extra: Partial<ConnectorShapeData> = {}): ConnectorShapeData {
	return {
		id: "c1",
		type: "connector",
		x: 100,
		y: 30,
		width: 200,
		height: 100,
		sourceId: "a",
		targetId: "b",
		sourceAnchor: "auto",
		targetAnchor: "auto",
		sourcePoint: { x: 100, y: 30 },
		targetPoint: { x: 300, y: 130 },
		...extra,
	} as ConnectorShapeData;
}

describe("computeAnchorChange", () => {
	it("switching to custom keeps the current endpoint on the edge and stores its ratio", () => {
		const { to } = computeAnchorChange(connector(), "source", "custom", { source: a, target: b });
		expect(to.sourceAnchor).toBe("custom");
		expect(to.sourcePoint).toEqual({ x: 100, y: 30 });
		expect(to.sourceAnchorRatio).toEqual({ x: 1, y: 0.5 });
	});

	it("keeps an existing ratio when the endpoint is already custom", () => {
		const c = connector({
			sourceAnchor: "custom",
			sourceAnchorRatio: { x: 1, y: 1 / 3 },
			sourcePoint: { x: 100, y: 20 },
		});
		const { to } = computeAnchorChange(c, "source", "custom", { source: a, target: b });
		expect(to.sourceAnchorRatio).toEqual({ x: 1, y: 1 / 3 });
		expect(to.sourcePoint).toEqual({ x: 100, y: 20 });
	});

	it("does not move the other custom endpoint to the shape center", () => {
		const c = connector({
			targetAnchor: "custom",
			targetAnchorRatio: { x: 0, y: 2 / 3 },
			targetPoint: { x: 300, y: 140 },
		});
		const { to } = computeAnchorChange(c, "source", "right", { source: a, target: b });
		expect(to.sourcePoint).toEqual({ x: 100, y: 30 });
		expect(to.targetPoint).toEqual({ x: 300, y: 140 });
	});

	it("stores the ratio even when the other end is not connected", () => {
		const c = connector({ targetId: undefined });
		const { from, to } = computeAnchorChange(c, "source", "custom", { source: a });
		expect(to).toEqual({ sourceAnchor: "custom", sourceAnchorRatio: { x: 1, y: 0.5 } });
		expect(from).toEqual({ sourceAnchor: "auto", sourceAnchorRatio: undefined });
	});

	it("records the previous values for undo", () => {
		const c = connector();
		const { from } = computeAnchorChange(c, "target", "left", { source: a, target: b });
		expect(from).toMatchObject({
			targetAnchor: "auto",
			sourcePoint: c.sourcePoint,
			targetPoint: c.targetPoint,
			x: c.x,
			y: c.y,
			width: c.width,
			height: c.height,
		});
	});
});
