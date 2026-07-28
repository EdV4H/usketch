// The `range-erase` tool: drag a rectangle to clear the terrain + base ownership
// inside it. A standalone tool (its own radial-menu entry + shortcut), separate
// from the map paint tool. Reuses the shared drag-rect preview (gen-state's
// pendingRect, drawn by the MapLayer).
import type { CanvasPointerEvent, ToolContext, ToolDefinition } from "@edv4h/usketch-shared";
import type { CellBox } from "./autotile.js";
import { genStateStore } from "./gen-state.js";
import { eraseRangeBox } from "./range-erase.js";
import { rangeEraseStore } from "./range-erase-state.js";
import { DEFAULT_TILE } from "./tilemap-shape.js";

export const RANGE_ERASE_TOOL_ID = "range-erase";

function RangeEraseIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
			<rect
				x="2.5"
				y="2.5"
				width="15"
				height="15"
				rx="2"
				fill="none"
				stroke="#EF5350"
				strokeWidth="1.6"
				strokeDasharray="3 2.4"
			/>
			<path d="M6 6 L14 14 M14 6 L6 14" stroke="#EF5350" strokeWidth="1.6" strokeLinecap="round" />
		</svg>
	);
}

export function createRangeEraseToolDefinition(tile: number = DEFAULT_TILE): ToolDefinition {
	let drag: { x0: number; y0: number } | null = null;

	return {
		icon: RangeEraseIcon,
		cursor: "crosshair",
		shortcut: "x",
		order: 46,
		onPointerDown(_ctx, event) {
			drag = { x0: event.worldPoint.x, y0: event.worldPoint.y };
			genStateStore.set({
				pendingRect: { x: event.worldPoint.x, y: event.worldPoint.y, w: 0, h: 0 },
			});
		},
		onPointerMove(_ctx: ToolContext, event: CanvasPointerEvent) {
			if (!drag) return;
			const x = Math.min(drag.x0, event.worldPoint.x);
			const y = Math.min(drag.y0, event.worldPoint.y);
			const w = Math.abs(event.worldPoint.x - drag.x0);
			const h = Math.abs(event.worldPoint.y - drag.y0);
			genStateStore.set({ pendingRect: { x, y, w, h } });
		},
		onPointerUp(ctx: ToolContext) {
			if (!drag) return;
			const rect = genStateStore.get().pendingRect;
			drag = null;
			genStateStore.set({ pendingRect: null });
			if (rect && rect.w >= tile / 2 && rect.h >= tile / 2) {
				// Right/bottom edges exclusive → ceil-1 so a boundary drag doesn't grab
				// an extra cell (matches the generate tool).
				const box: CellBox = {
					minC: Math.floor(rect.x / tile),
					minR: Math.floor(rect.y / tile),
					maxC: Math.ceil((rect.x + rect.w) / tile) - 1,
					maxR: Math.ceil((rect.y + rect.h) / tile) - 1,
				};
				eraseRangeBox(
					{ store: ctx.store, commands: ctx.commands, tile },
					box,
					rangeEraseStore.get(),
				);
			}
		},
		onDeactivate() {
			if (drag) {
				drag = null;
				genStateStore.set({ pendingRect: null });
			}
		},
	};
}
