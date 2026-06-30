import type { ShapeData, ShapeStyle } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { createEraseStrokesCommand, findErasedStrokes } from "../eraser.js";
import type { FreedrawShapeData, StrokePoint } from "../types.js";

const style: ShapeStyle = { fill: "#fff", stroke: "#000", strokeWidth: 4, opacity: 1 };

function stroke(id: string, points: StrokePoint[]): FreedrawShapeData {
	return { id, type: "freedraw", x: 0, y: 0, width: 0, height: 0, style, points };
}

function rect(id: string): ShapeData {
	return { id, type: "rectangle", x: 0, y: 0, width: 10, height: 10, style };
}

describe("findErasedStrokes", () => {
	it("触れた freedraw のみ返す（他 shape は対象外）", () => {
		const store = createBoardStore();
		store.addShape(
			stroke("a", [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
			]),
		);
		store.addShape(stroke("b", [{ x: 200, y: 200 }]));
		store.addShape(rect("r")); // freedraw でない（消しゴム対象外）
		const hits = findErasedStrokes(store, { x: 50, y: 2 }, 10);
		expect(hits.map((s) => s.id)).toEqual(["a"]);
	});
});

describe("createEraseStrokesCommand", () => {
	it("execute で削除、undo で復元（1アクション）", () => {
		const store = createBoardStore();
		const a = stroke("a", [
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
		]);
		const b = stroke("b", [
			{ x: 0, y: 0 },
			{ x: 10, y: 10 },
		]);
		store.addShape(a);
		store.addShape(b);
		const cmd = createEraseStrokesCommand(store, [a, b]);
		cmd.execute();
		expect(store.getShapes().size).toBe(0);
		cmd.undo();
		expect(store.getShapes().size).toBe(2);
		expect(store.getShape("a")?.type).toBe("freedraw");
	});
});
