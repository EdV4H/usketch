import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { moveConnector } from "../move.js";
import type { ConnectableShapeData } from "../types.js";

const style = { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 };

function connector(extra: Partial<ConnectableShapeData>): ShapeData {
	return {
		id: "c1",
		type: "connector",
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		style,
		...extra,
	} as ShapeData;
}

describe("moveConnector", () => {
	it("x/y と絶対座標の Point フィールドを同じオフセットで平行移動する", () => {
		const shape = connector({
			sourcePoint: { x: 10, y: 20 },
			targetPoint: { x: 110, y: 70 },
			controlPoint: { x: 60, y: 45 },
		});
		const patch = moveConnector(shape, 5, -3) as Partial<ConnectableShapeData>;
		expect(patch.x).toBe(15);
		expect(patch.y).toBe(17);
		expect(patch.sourcePoint).toEqual({ x: 15, y: 17 });
		expect(patch.targetPoint).toEqual({ x: 115, y: 67 });
		expect(patch.controlPoint).toEqual({ x: 65, y: 42 });
	});

	it("未設定の Point フィールドは patch に含めない（x/y フォールバックと整合）", () => {
		const shape = connector({ sourcePoint: { x: 10, y: 20 } });
		const patch = moveConnector(shape, 8, 8) as Partial<ConnectableShapeData>;
		expect(patch.sourcePoint).toEqual({ x: 18, y: 28 });
		expect("targetPoint" in patch).toBe(false);
		expect("controlPoint" in patch).toBe(false);
	});
});
