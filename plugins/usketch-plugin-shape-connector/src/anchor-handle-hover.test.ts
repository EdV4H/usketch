import { createEventBus } from "@edv4h/usketch-core";
import type { CanvasPointerEvent, PluginContext, Point, ShapeData } from "@edv4h/usketch-shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupAnchorHandles } from "./anchor-handle-overlay.js";

const rect = (id: string, x: number): ShapeData =>
	({ id, type: "rect", x, y: 0, width: 100, height: 100, rotation: 0 }) as ShapeData;

function setup() {
	const shapes = [rect("a", 0), rect("b", 200)];
	const hitTest = vi.fn(
		(s: ShapeData, p: Point) =>
			p.x >= s.x && p.x <= s.x + s.width && p.y >= s.y && p.y <= s.y + s.height,
	);
	const events = createEventBus();
	const ctx = {
		events,
		store: {
			getActiveToolId: () => "select",
			getShapes: () => new Map(shapes.map((s) => [s.id, s])),
			getShapesSorted: () => shapes,
		},
		shapes: { get: () => ({ hitTest }) },
	} as unknown as PluginContext;
	const teardown = setupAnchorHandles(ctx);
	const emit = (type: string, x: number) =>
		events.emit<CanvasPointerEvent>(type, {
			worldPoint: { x, y: 50 },
			screenPoint: { x, y: 50 },
		} as CanvasPointerEvent);
	return { hitTest, emit, teardown };
}

let teardown: (() => void) | undefined;
afterEach(() => teardown?.());

describe("anchor handle hover", () => {
	it("ホバー中は pointermove ごとに図形を当たり判定する", () => {
		const t = setup();
		teardown = t.teardown;
		t.emit("canvas:pointermove", 50);
		t.emit("canvas:pointermove", 150);
		expect(t.hitTest).toHaveBeenCalled();
	});

	it("押している間（ドラッグ・範囲選択）は当たり判定せず、離した位置で 1 回だけ判定する", () => {
		const t = setup();
		teardown = t.teardown;
		t.emit("canvas:pointerdown", 150);
		for (let x = 150; x < 190; x++) t.emit("canvas:pointermove", x);
		expect(t.hitTest).not.toHaveBeenCalled();

		t.emit("canvas:pointerup", 250);
		// One front-to-back lookup at the release point: hits "b" first (topmost).
		expect(t.hitTest).toHaveBeenCalledTimes(1);
		expect(t.hitTest.mock.calls[0]?.[0].id).toBe("b");
	});
});
