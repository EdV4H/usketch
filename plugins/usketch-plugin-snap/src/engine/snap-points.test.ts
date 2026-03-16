import { describe, expect, it } from "vitest";
import { extractSnapPoints } from "./snap-points.js";

describe("extractSnapPoints", () => {
	const box = { x: 100, y: 200, width: 50, height: 30 };
	const id = "shape-1";

	it("extracts edge snap points", () => {
		const { xPoints, yPoints } = extractSnapPoints(box, id, {
			edgeSnap: true,
			centerSnap: false,
		});

		expect(xPoints).toHaveLength(2);
		expect(xPoints.find((p) => p.edge === "min")?.value).toBe(100);
		expect(xPoints.find((p) => p.edge === "max")?.value).toBe(150);

		expect(yPoints).toHaveLength(2);
		expect(yPoints.find((p) => p.edge === "min")?.value).toBe(200);
		expect(yPoints.find((p) => p.edge === "max")?.value).toBe(230);
	});

	it("extracts center snap points", () => {
		const { xPoints, yPoints } = extractSnapPoints(box, id, {
			edgeSnap: false,
			centerSnap: true,
		});

		expect(xPoints).toHaveLength(1);
		expect(xPoints[0].value).toBe(125);
		expect(xPoints[0].edge).toBe("center");

		expect(yPoints).toHaveLength(1);
		expect(yPoints[0].value).toBe(215);
	});

	it("extracts all snap points when both enabled", () => {
		const { xPoints, yPoints } = extractSnapPoints(box, id, {
			edgeSnap: true,
			centerSnap: true,
		});

		expect(xPoints).toHaveLength(3);
		expect(yPoints).toHaveLength(3);
	});

	it("returns empty when both disabled", () => {
		const { xPoints, yPoints } = extractSnapPoints(box, id, {
			edgeSnap: false,
			centerSnap: false,
		});

		expect(xPoints).toHaveLength(0);
		expect(yPoints).toHaveLength(0);
	});

	it("sets sourceShapeId on all points", () => {
		const { xPoints, yPoints } = extractSnapPoints(box, id, {
			edgeSnap: true,
			centerSnap: true,
		});

		for (const p of [...xPoints, ...yPoints]) {
			expect(p.sourceShapeId).toBe(id);
		}
	});
});
