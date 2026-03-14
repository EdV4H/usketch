import type {
	CanvasPointerEvent,
	PluginContext,
	Point,
	ToolContext,
	UsketchPlugin,
} from "@usketch/shared";
import { createDeleteShapeCommand, createMoveShapesCommand } from "@usketch/store";

// ── Local drag state ──

let dragState: {
	mode: "move";
	startPoint: Point;
	startPositions: Map<string, Point>;
} | null = null;

// ── Hit test helpers ──

function findShapeAtPoint(ctx: ToolContext, point: Point): string | null {
	const shapes = ctx.store.getShapes();
	// Iterate in reverse insertion order (top-most shape first)
	const entries = [...shapes.entries()].reverse();
	for (const [id, data] of entries) {
		const def = ctx.shapes.get(data.type);
		if (def?.hitTest(data, point)) {
			return id;
		}
	}
	return null;
}

// ── Tool handlers ──

function onPointerDown(ctx: ToolContext, event: CanvasPointerEvent) {
	const hitId = findShapeAtPoint(ctx, event.worldPoint);
	const selection = ctx.store.getSelection();

	if (hitId) {
		if (event.shiftKey) {
			// Toggle shape in selection
			if (selection.has(hitId)) {
				ctx.store.removeFromSelection(hitId);
			} else {
				ctx.store.addToSelection(hitId);
			}
		} else {
			// If clicking on an already-selected shape, keep selection (for multi-drag)
			if (!selection.has(hitId)) {
				ctx.store.setSelection([hitId]);
			}
		}

		// Start drag-move for all selected shapes
		const currentSelection = ctx.store.getSelection();
		const startPositions = new Map<string, Point>();
		for (const id of currentSelection) {
			const shape = ctx.store.getShape(id);
			if (shape) {
				startPositions.set(id, { x: shape.x, y: shape.y });
			}
		}
		dragState = {
			mode: "move",
			startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
			startPositions,
		};
	} else {
		// Click on empty — clear selection
		if (!event.shiftKey) {
			ctx.store.clearSelection();
		}
		dragState = null;
	}
}

function onPointerMove(ctx: ToolContext, event: CanvasPointerEvent) {
	if (!dragState) return;

	const dx = event.worldPoint.x - dragState.startPoint.x;
	const dy = event.worldPoint.y - dragState.startPoint.y;

	for (const [id, startPos] of dragState.startPositions) {
		ctx.store.updateShape(id, {
			x: startPos.x + dx,
			y: startPos.y + dy,
		});
	}
}

function onPointerUp(ctx: ToolContext, event: CanvasPointerEvent) {
	if (!dragState) return;

	const dx = event.worldPoint.x - dragState.startPoint.x;
	const dy = event.worldPoint.y - dragState.startPoint.y;

	// Only create undoable command if shapes actually moved
	if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
		const shapeIds = [...dragState.startPositions.keys()];

		// Reset positions to start, then execute command for undo support
		for (const [id, startPos] of dragState.startPositions) {
			ctx.store.updateShape(id, { x: startPos.x, y: startPos.y });
		}
		ctx.commands.execute(createMoveShapesCommand(ctx.store, shapeIds, dx, dy));
	}

	dragState = null;
}

function onDeactivate(_ctx: ToolContext) {
	dragState = null;
}

// ── Icon ──

function SelectIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<path
				d="M6 2L6 16L10 12L14 16L16 14L12 10L16 6Z"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

// ── Plugin ──

export const selectToolPlugin: UsketchPlugin = {
	id: "usketch-plugin-tool-select",
	name: "選択",
	type: "tool",

	setup(ctx: PluginContext) {
		ctx.tools.register("select", {
			icon: SelectIcon,
			shortcut: "v",
			order: 0,
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onDeactivate,
		});

		// Delete selected shapes
		ctx.shortcuts.register("Delete", () => {
			const selection = ctx.store.getSelection();
			if (selection.size === 0) return;
			if (ctx.store.getActiveToolId() !== "select") return;
			for (const id of selection) {
				ctx.commands.execute(createDeleteShapeCommand(ctx.store, id));
			}
			ctx.store.clearSelection();
		});

		ctx.shortcuts.register("Backspace", () => {
			const selection = ctx.store.getSelection();
			if (selection.size === 0) return;
			if (ctx.store.getActiveToolId() !== "select") return;
			for (const id of selection) {
				ctx.commands.execute(createDeleteShapeCommand(ctx.store, id));
			}
			ctx.store.clearSelection();
		});
	},
};
