import { createServiceRegistry } from "@edv4h/usketch-core";
import { type View3dPick, view3dPickService } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it, vi } from "vitest";
import { EDIT_TOOL_ID, mode7CaptureHandlers } from "../mode7-runtime.js";
import { createMode7Store } from "../mode7-store.js";
import { shapeDoubleClickExit } from "../plugin.js";

function setup(pick: (p: { x: number; y: number }) => View3dPick | null) {
	const board = createBoardStore();
	board.setActiveToolId(EDIT_TOOL_ID);
	const services = createServiceRegistry();
	view3dPickService.provide(services, { pickAt: pick });
	const mode7 = createMode7Store({ active: true });
	const exit = vi.fn();
	return { board, mode7, exit, handlers: mode7CaptureHandlers({ board, services, mode7, exit }) };
}

const onShape = (p: { x: number; y: number }): View3dPick | null =>
	p.x < 100
		? { point: { x: 1, y: 2 }, height: 0, shapeId: "a" }
		: { point: p, height: 0, shapeId: null };

describe("the 3D view's capture layer", () => {
	it("hands a press on a shape to the select tool, keeps the ground for the camera", () => {
		const { handlers, board } = setup(onShape);
		expect(handlers.editsAt?.({ x: 10, y: 10 })).toBe(true);
		expect(handlers.editsAt?.({ x: 200, y: 10 })).toBe(false);
		board.setActiveToolId("rectangle");
		expect(handlers.editsAt?.({ x: 10, y: 10 })).toBe(false);
	});

	it("keeps every press for the camera without a pick (no canvas)", () => {
		const board = createBoardStore();
		board.setActiveToolId(EDIT_TOOL_ID);
		const handlers = mode7CaptureHandlers({
			board,
			services: createServiceRegistry(),
			mode7: createMode7Store({ active: true }),
		});
		expect(handlers.editsAt?.({ x: 10, y: 10 })).toBe(false);
	});

	it("clears the selection on a click on the ground", () => {
		const { handlers, board } = setup(onShape);
		board.addShape({
			id: "a",
			type: "rectangle",
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			rotation: 0,
			zIndex: "a0",
		} as never);
		board.setSelection(["a"]);
		handlers.onGroundTap?.();
		expect(board.getSelection().size).toBe(0);
	});

	it("leaves for flat on a double click on a shape only", () => {
		const { handlers, exit } = setup(onShape);
		handlers.onShapeDoubleClick?.({ x: 200, y: 10 });
		expect(exit).not.toHaveBeenCalled();
		handlers.onShapeDoubleClick?.({ x: 10, y: 10 });
		expect(exit).toHaveBeenCalledTimes(1);
	});

	it("stays in 3D on a double click when the host keeps it (exitOnShapeDoubleClick: false)", () => {
		const disable = vi.fn();
		expect(shapeDoubleClickExit({}, disable)).toBe(disable);
		expect(shapeDoubleClickExit({ exitOnShapeDoubleClick: true }, disable)).toBe(disable);
		const exit = shapeDoubleClickExit({ exitOnShapeDoubleClick: false }, disable);
		expect(exit).toBeUndefined();
		const board = createBoardStore();
		board.setActiveToolId(EDIT_TOOL_ID);
		const services = createServiceRegistry();
		view3dPickService.provide(services, { pickAt: onShape });
		const mode7 = createMode7Store({ active: true });
		const handlers = mode7CaptureHandlers({ board, services, mode7, exit });
		handlers.onShapeDoubleClick?.({ x: 10, y: 10 });
		expect(disable).not.toHaveBeenCalled();
		expect(mode7.getState().active).toBe(true);
	});
});
