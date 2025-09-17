import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import { selectToolMachine } from "./select-tool";

// Mock the store and geometry utilities
vi.mock("@usketch/store", () => ({
	whiteboardStore: {
		getState: vi.fn(() => ({
			selectedShapeIds: new Set(["shape1", "shape2"]),
			shapes: new Map([
				["shape1", { id: "shape1", type: "rectangle", x: 10, y: 10, width: 50, height: 50 }],
				["shape2", { id: "shape2", type: "rectangle", x: 100, y: 100, width: 50, height: 50 }],
			]),
			updateShape: vi.fn(),
		})),
	},
}));

vi.mock("../utils/geometry", () => ({
	getShape: vi.fn((id: string) => {
		const shapes = new Map([
			["shape1", { id: "shape1", type: "rectangle", x: 10, y: 10, width: 50, height: 50 }],
			["shape2", { id: "shape2", type: "rectangle", x: 100, y: 100, width: 50, height: 50 }],
		]);
		return shapes.get(id);
	}),
	updateShape: vi.fn(),
	commitShapeChanges: vi.fn(),
	getShapeAtPoint: vi.fn(),
	getShapesInBounds: vi.fn(),
	getResizeHandleAtPoint: vi.fn(),
	getCropHandleAtPoint: vi.fn(),
}));

describe("SelectTool Alignment", () => {
	it("should handle ALIGN_LEFT event when multiple shapes are selected", () => {
		const actor = createActor(selectToolMachine, {
			input: {
				selectedIds: new Set(["shape1", "shape2"]),
			},
		});
		actor.start();

		// Send align left event
		actor.send({ type: "ALIGN_LEFT" });

		// Check that updateShape was called to align both shapes to the left
		const { updateShape } = require("../utils/geometry");
		expect(updateShape).toHaveBeenCalledWith("shape1", { x: 10 });
		expect(updateShape).toHaveBeenCalledWith("shape2", { x: 10 });
	});

	it("should handle ALIGN_RIGHT event when multiple shapes are selected", () => {
		const actor = createActor(selectToolMachine, {
			input: {
				selectedIds: new Set(["shape1", "shape2"]),
			},
		});
		actor.start();

		// Send align right event
		actor.send({ type: "ALIGN_RIGHT" });

		// Check that updateShape was called to align both shapes to the right
		const { updateShape } = require("../utils/geometry");
		// shape2 right edge is at 150 (100 + 50)
		expect(updateShape).toHaveBeenCalledWith("shape1", { x: 100 }); // 150 - 50
		expect(updateShape).toHaveBeenCalledWith("shape2", { x: 100 }); // Already aligned
	});

	it("should not align when only one shape is selected", () => {
		const actor = createActor(selectToolMachine, {
			input: {
				selectedIds: new Set(["shape1"]),
			},
		});
		actor.start();

		const { updateShape } = require("../utils/geometry");
		vi.clearAllMocks();

		// Send align left event
		actor.send({ type: "ALIGN_LEFT" });

		// Check that updateShape was not called
		expect(updateShape).not.toHaveBeenCalled();
	});

	it("should handle ALIGN_TOP event", () => {
		const actor = createActor(selectToolMachine, {
			input: {
				selectedIds: new Set(["shape1", "shape2"]),
			},
		});
		actor.start();

		// Send align top event
		actor.send({ type: "ALIGN_TOP" });

		// Check that updateShape was called to align both shapes to the top
		const { updateShape } = require("../utils/geometry");
		expect(updateShape).toHaveBeenCalledWith("shape1", { y: 10 });
		expect(updateShape).toHaveBeenCalledWith("shape2", { y: 10 });
	});

	it("should handle ALIGN_BOTTOM event", () => {
		const actor = createActor(selectToolMachine, {
			input: {
				selectedIds: new Set(["shape1", "shape2"]),
			},
		});
		actor.start();

		// Send align bottom event
		actor.send({ type: "ALIGN_BOTTOM" });

		// Check that updateShape was called to align both shapes to the bottom
		const { updateShape } = require("../utils/geometry");
		// shape2 bottom edge is at 150 (100 + 50)
		expect(updateShape).toHaveBeenCalledWith("shape1", { y: 100 }); // 150 - 50
		expect(updateShape).toHaveBeenCalledWith("shape2", { y: 100 }); // Already aligned
	});
});
