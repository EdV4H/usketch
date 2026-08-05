import type { Point, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { rotateConnector } from "../rotate.js";
import type { ConnectableShapeData } from "../types.js";

const style = { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 };

function connector(extra: Partial<ConnectableShapeData>): ShapeData {
	return {
		id: "c1",
		type: "connector",
		x: 0,
		y: 0,
		width: 100,
		height: 0,
		style,
		...extra,
	} as ShapeData;
}

function near(a: Point, b: Point, eps = 1e-9) {
	expect(Math.abs(a.x - b.x)).toBeLessThan(eps);
	expect(Math.abs(a.y - b.y)).toBeLessThan(eps);
}

describe("rotateConnector", () => {
	it("端点を center まわりに回転し、rotation は据え置く", () => {
		const shape = connector({
			sourcePoint: { x: 0, y: 0 },
			targetPoint: { x: 100, y: 0 },
		});
		// 90° (時計回り) around the midpoint (50, 0)
		const patch = rotateConnector(shape, Math.PI / 2, {
			x: 50,
			y: 0,
		}) as Partial<ConnectableShapeData>;
		near(patch.sourcePoint as Point, { x: 50, y: -50 });
		near(patch.targetPoint as Point, { x: 50, y: 50 });
		// Connectors are defined by points, so no rotation is baked.
		expect("rotation" in patch).toBe(false);
	});

	it("回転後のジオメトリから AABB (x/y/width/height) を再計算する", () => {
		const shape = connector({
			sourcePoint: { x: 0, y: 0 },
			targetPoint: { x: 100, y: 0 },
		});
		const patch = rotateConnector(shape, Math.PI / 2, {
			x: 50,
			y: 0,
		}) as Partial<ConnectableShapeData>;
		// Rotated to a vertical segment from (50,-50) to (50,50).
		expect(patch.x).toBeCloseTo(50);
		expect(patch.y).toBeCloseTo(-50);
		expect(patch.width).toBeCloseTo(0);
		expect(patch.height).toBeCloseTo(100);
	});

	it("controlPoint も回転する（curve）／未設定は含めない", () => {
		const withCp = connector({
			sourcePoint: { x: 0, y: 0 },
			targetPoint: { x: 100, y: 0 },
			controlPoint: { x: 50, y: 0 },
			pathType: "curve",
		});
		const patch = rotateConnector(withCp, Math.PI / 2, {
			x: 50,
			y: 0,
		}) as Partial<ConnectableShapeData>;
		near(patch.controlPoint as Point, { x: 50, y: 0 });

		const noCp = connector({ sourcePoint: { x: 0, y: 0 }, targetPoint: { x: 100, y: 0 } });
		const patch2 = rotateConnector(noCp, Math.PI / 2, {
			x: 50,
			y: 0,
		}) as Partial<ConnectableShapeData>;
		expect("controlPoint" in patch2).toBe(false);
	});
});
