import type { RectangleShape } from "@usketch/shared-types";
import { beforeEach, describe, expect, it } from "vitest";
import { whiteboardStore } from "../store";

describe("Undo/Redo functionality", () => {
	beforeEach(() => {
		// Reset store before each test
		const state = whiteboardStore.getState();
		state.clearSelection();
		state.clearHistory();
		// Clear all shapes
		Object.keys(state.shapes).forEach((id) => {
			state.removeShape(id);
		});
	});

	describe("Basic operations", () => {
		it("should undo shape creation", () => {
			const store = whiteboardStore.getState();

			// Create a shape
			const shape: RectangleShape = {
				id: "shape1",
				type: "rectangle",
				x: 100,
				y: 100,
				width: 200,
				height: 150,
				rotation: 0,
				opacity: 1,
				strokeColor: "#000000",
				fillColor: "#ffffff",
				strokeWidth: 2,
			};

			store.addShape(shape);

			// Verify shape was added and get fresh state
			const stateAfterAdd = whiteboardStore.getState();
			expect(stateAfterAdd.shapes[shape.id]).toBeDefined();
			expect(stateAfterAdd.canUndo).toBe(true);
			expect(stateAfterAdd.canRedo).toBe(false);

			// Undo
			const undoResult = store.undo();
			expect(undoResult).toBe(true);

			// Verify shape was removed
			const stateAfterUndo = whiteboardStore.getState();
			expect(stateAfterUndo.shapes[shape.id]).toBeUndefined();
			expect(stateAfterUndo.canUndo).toBe(false);
			expect(stateAfterUndo.canRedo).toBe(true);
		});

		it("should redo shape creation", () => {
			const store = whiteboardStore.getState();

			// Create a shape
			const shape: RectangleShape = {
				id: "shape2",
				type: "rectangle",
				x: 50,
				y: 50,
				width: 100,
				height: 100,
				rotation: 0,
				opacity: 1,
				strokeColor: "#000000",
				fillColor: "#ffffff",
				strokeWidth: 2,
			};

			store.addShape(shape);
			store.undo();

			// Redo
			const redoResult = store.redo();
			expect(redoResult).toBe(true);

			// Verify shape was restored
			const stateAfterRedo = whiteboardStore.getState();
			expect(stateAfterRedo.shapes[shape.id]).toBeDefined();
			const restoredShape = stateAfterRedo.shapes[shape.id];
			if (restoredShape) {
				expect(restoredShape.x).toBe(50);
			}
			expect(stateAfterRedo.canUndo).toBe(true);
			expect(stateAfterRedo.canRedo).toBe(false);
		});

		it("should undo shape deletion", () => {
			const store = whiteboardStore.getState();

			// Create and then delete a shape
			const shape: RectangleShape = {
				id: "shape3",
				type: "rectangle",
				x: 0,
				y: 0,
				width: 50,
				height: 50,
				rotation: 0,
				opacity: 1,
				strokeColor: "#000000",
				fillColor: "#ffffff",
				strokeWidth: 2,
			};

			store.addShape(shape);
			store.removeShape(shape.id);

			// Verify shape was deleted
			expect(store.shapes[shape.id]).toBeUndefined();

			// Undo deletion
			store.undo();

			// Verify shape was restored
			const stateAfterUndo = whiteboardStore.getState();
			expect(stateAfterUndo.shapes[shape.id]).toBeDefined();
			const restoredShape = stateAfterUndo.shapes[shape.id];
			if (restoredShape && "width" in restoredShape) {
				expect(restoredShape.width).toBe(50);
			}
		});

		it("should undo shape updates", () => {
			const store = whiteboardStore.getState();

			// Create a shape
			const shape: RectangleShape = {
				id: "shape4",
				type: "rectangle",
				x: 10,
				y: 10,
				width: 30,
				height: 40,
				rotation: 0,
				opacity: 1,
				strokeColor: "#000000",
				fillColor: "#ffffff",
				strokeWidth: 2,
			};

			store.addShape(shape);

			// Update the shape
			store.updateShape(shape.id, { x: 200, y: 300 });

			// Verify update
			let currentState = whiteboardStore.getState();
			const updatedShape = currentState.shapes[shape.id];
			if (updatedShape) {
				expect(updatedShape.x).toBe(200);
				expect(updatedShape.y).toBe(300);
			}

			// Undo update
			store.undo();

			// Verify original position restored
			currentState = whiteboardStore.getState();
			const revertedShape = currentState.shapes[shape.id];
			if (revertedShape) {
				expect(revertedShape.x).toBe(10);
				expect(revertedShape.y).toBe(10);
			}
		});
	});

	describe("Multiple operations", () => {
		it("should handle multiple undo/redo operations", () => {
			const store = whiteboardStore.getState();

			// Create multiple shapes
			const shapes = Array.from({ length: 3 }, (_, i) => ({
				id: `shape-multi-${i}`,
				type: "rectangle" as const,
				x: i * 100,
				y: i * 100,
				width: 50,
				height: 50,
				rotation: 0,
				opacity: 1,
				strokeColor: "#000000",
				fillColor: "#ffffff",
				strokeWidth: 2,
			}));

			// Add all shapes
			shapes.forEach((shape) => {
				store.addShape(shape);
			});

			// Verify all shapes added
			let currentState = whiteboardStore.getState();
			expect(Object.keys(currentState.shapes).length).toBe(3);

			// Undo all additions
			store.undo(); // Remove shape 2
			store.undo(); // Remove shape 1
			store.undo(); // Remove shape 0

			// Verify all shapes removed
			currentState = whiteboardStore.getState();
			expect(Object.keys(currentState.shapes).length).toBe(0);

			// Redo all additions
			store.redo(); // Add shape 0
			store.redo(); // Add shape 1
			store.redo(); // Add shape 2

			// Verify all shapes restored
			currentState = whiteboardStore.getState();
			expect(Object.keys(currentState.shapes).length).toBe(3);
		});

		it("should clear redo stack on new operation", () => {
			const store = whiteboardStore.getState();

			// Create shapes
			const shape1: RectangleShape = {
				id: "clear-test-1",
				type: "rectangle",
				x: 0,
				y: 0,
				width: 50,
				height: 50,
				rotation: 0,
				opacity: 1,
				strokeColor: "#000000",
				fillColor: "#ffffff",
				strokeWidth: 2,
			};

			const shape2: RectangleShape = {
				id: "clear-test-2",
				type: "rectangle",
				x: 100,
				y: 100,
				width: 50,
				height: 50,
				rotation: 0,
				opacity: 1,
				strokeColor: "#000000",
				fillColor: "#ffffff",
				strokeWidth: 2,
			};

			store.addShape(shape1);
			store.addShape(shape2);

			// Undo one operation
			store.undo();

			// Verify can redo - get fresh state
			const stateAfterUndo = whiteboardStore.getState();
			expect(stateAfterUndo.canRedo).toBe(true);

			// Perform new operation
			const shape3: RectangleShape = {
				id: "clear-test-3",
				type: "rectangle",
				x: 200,
				y: 200,
				width: 50,
				height: 50,
				rotation: 0,
				opacity: 1,
				strokeColor: "#000000",
				fillColor: "#ffffff",
				strokeWidth: 2,
			};
			store.addShape(shape3);

			// Verify redo stack is cleared
			const currentState = whiteboardStore.getState();
			expect(currentState.canRedo).toBe(false);
			expect(Object.keys(currentState.shapes).length).toBe(2); // shape1 and shape3
		});
	});

	describe("Command merging", () => {
		it("should merge consecutive shape updates", () => {
			const store = whiteboardStore.getState();

			// Create a shape
			const shape: RectangleShape = {
				id: "merge-test",
				type: "rectangle",
				x: 0,
				y: 0,
				width: 50,
				height: 50,
				rotation: 0,
				opacity: 1,
				strokeColor: "#000000",
				fillColor: "#ffffff",
				strokeWidth: 2,
			};

			store.addShape(shape);

			// Simulate dragging - multiple rapid updates
			store.updateShape(shape.id, { x: 10, y: 10 });
			store.updateShape(shape.id, { x: 20, y: 20 });
			store.updateShape(shape.id, { x: 30, y: 30 });

			// Verify final position
			let currentState = whiteboardStore.getState();
			const updatedShape = currentState.shapes[shape.id];
			if (updatedShape) {
				expect(updatedShape.x).toBe(30);
				expect(updatedShape.y).toBe(30);
			}

			// Check that we have only 2 commands in history (create + merged updates)
			// Note: We can't directly access history, but we can verify through undo
			store.undo(); // Undo the merged update

			// Should be back to original position
			currentState = whiteboardStore.getState();
			const afterUndo = currentState.shapes[shape.id];
			if (afterUndo) {
				expect(afterUndo.x).toBe(0);
				expect(afterUndo.y).toBe(0);
			}

			// Redo should go to final position
			store.redo();
			currentState = whiteboardStore.getState();
			const afterRedo = currentState.shapes[shape.id];
			if (afterRedo) {
				expect(afterRedo.x).toBe(30);
				expect(afterRedo.y).toBe(30);
			}
		});
	});

	describe("Batch operations", () => {
		it("should batch multiple operations into single undo/redo", () => {
			const store = whiteboardStore.getState();

			// Create initial shapes
			const shapes = Array.from({ length: 3 }, (_, i) => ({
				id: `batch-${i}`,
				type: "rectangle" as const,
				x: i * 50,
				y: i * 50,
				width: 40,
				height: 40,
				rotation: 0,
				opacity: 1,
				strokeColor: "#000000",
				fillColor: "#ffffff",
				strokeWidth: 2,
			}));

			// Add shapes in a batch
			store.beginBatch("Add multiple shapes");
			shapes.forEach((shape) => {
				store.addShape(shape);
			});
			store.endBatch();

			// Verify all shapes added
			let currentState = whiteboardStore.getState();
			expect(Object.keys(currentState.shapes).length).toBe(3);

			// Single undo should remove all shapes
			store.undo();

			// Verify all shapes removed
			currentState = whiteboardStore.getState();
			expect(Object.keys(currentState.shapes).length).toBe(0);

			// Single redo should restore all shapes
			store.redo();

			// Verify all shapes restored
			currentState = whiteboardStore.getState();
			expect(Object.keys(currentState.shapes).length).toBe(3);
		});
	});
});
