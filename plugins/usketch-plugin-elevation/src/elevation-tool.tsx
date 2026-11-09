// The `elevation` tool: drag to shape the ground with the brush (settings on the HUD).
// While the button is down the stroke is drawn on a working copy (the layer shows it as
// a preview) and keeps acting while the pointer stands still, `strength × time`; on
// release it is written once, as one undo step. Shift swaps raise / lower, Alt + click
// in "flatten" picks the height under the pointer.
import type { CanvasPointerEvent, ToolContext, ToolDefinition } from "@edv4h/usketch-shared";
import {
	applyDabs,
	type BrushMode,
	type BrushSettings,
	beginStroke,
	dabsAlong,
	type Stroke,
	strokeChanges,
} from "./elevation-brush.js";
import type { StrokePreview } from "./elevation-layer.js";
import { boardElevation, elevationSampler } from "./elevation-model.js";
import { writeChunkEdits } from "./elevation-ops.js";
import type { ReactiveStore } from "./reactive-store.js";

export const ELEVATION_TOOL_ID = "elevation";

/** Where the pointer is over the board, for the brush cursor. */
export interface BrushCursor {
	x: number;
	y: number;
	/** Whether to show it (the pointer is over the board with this tool). */
	visible: boolean;
}

/** Longest time one frame of a held brush counts for (a stalled tab mustn't dump a mountain). */
const MAX_FRAME_SECONDS = 0.1;

function ElevationToolIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
			<path
				d="M2 16 L7 8 L10 12 L13 6 L18 16 Z"
				fill="#c9b27a"
				stroke="#141414"
				strokeWidth="1.4"
				strokeLinejoin="round"
			/>
			<path d="M11.4 8.6 L13 6 L14.4 8.8" stroke="#ffffff" strokeWidth="1.2" />
		</svg>
	);
}

export interface ElevationToolDeps {
	brush: ReactiveStore<BrushSettings>;
	preview: ReactiveStore<StrokePreview>;
	cursor: ReactiveStore<BrushCursor>;
	/** Frame scheduler (tests pass their own). Default: requestAnimationFrame. */
	requestFrame?: (cb: () => void) => number;
	cancelFrame?: (handle: number) => void;
	/** Clock in ms (tests pass their own). Default: performance.now. */
	now?: () => number;
}

export function createElevationToolDefinition(deps: ElevationToolDeps): ToolDefinition {
	const now = deps.now ?? (() => performance.now());
	const requestFrame =
		deps.requestFrame ??
		((cb: () => void) =>
			typeof requestAnimationFrame === "function"
				? requestAnimationFrame(() => cb())
				: (setTimeout(cb, 16) as unknown as number));
	const cancelFrame =
		deps.cancelFrame ??
		((h: number) => {
			if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(h);
			clearTimeout(h);
		});

	interface Active {
		stroke: Stroke;
		settings: BrushSettings;
		mode: BrushMode;
		target: number | undefined;
		/** Where the brush last acted, and where the pointer is now. */
		at: { x: number; y: number };
		pointer: { x: number; y: number };
		time: number;
		frame: number;
	}
	let active: Active | null = null;

	const step = (a: Active) => {
		const t = now();
		const dt = Math.min(MAX_FRAME_SECONDS, Math.max(0, (t - a.time) / 1000));
		a.time = t;
		if (dt <= 0) return;
		const dabs = dabsAlong(a.at, a.pointer, dt, a.settings.radius);
		a.at = { ...a.pointer };
		if (applyDabs(a.stroke, dabs, { settings: a.settings, mode: a.mode, target: a.target })) {
			deps.preview.set({ model: a.stroke.model });
		}
	};

	const loop = () => {
		const a = active;
		if (!a) return;
		step(a);
		a.frame = requestFrame(loop);
	};

	const end = (ctx: ToolContext, write: boolean) => {
		const a = active;
		if (!a) return;
		active = null;
		cancelFrame(a.frame);
		if (write) {
			step(a);
			writeChunkEdits({ store: ctx.store, commands: ctx.commands }, strokeChanges(a.stroke));
		}
		deps.preview.set({ model: null });
	};

	const heightUnder = (ctx: ToolContext, e: CanvasPointerEvent) => {
		const model = boardElevation(ctx.store);
		return model ? elevationSampler(model).heightAt(e.worldPoint.x, e.worldPoint.y) : 0;
	};

	return {
		icon: ElevationToolIcon,
		label: "標高ブラシ",
		cursor: "crosshair",
		shortcut: "g",
		order: 46,
		onPointerDown(ctx, e) {
			if (e.button !== 0) return;
			end(ctx, true); // a stroke whose pointer-up was missed
			const settings = deps.brush.get();
			if (e.altKey && settings.mode === "flatten") {
				deps.brush.set({ flattenHeight: Math.round(heightUnder(ctx, e) * 4) / 4 });
				return;
			}
			let mode = settings.mode;
			if (e.shiftKey && mode === "raise") mode = "lower";
			else if (e.shiftKey && mode === "lower") mode = "raise";
			const stroke = beginStroke(boardElevation(ctx.store));
			const target =
				mode === "flatten"
					? settings.flattenHeight >= 0
						? settings.flattenHeight
						: elevationSampler(stroke.model).heightAt(e.worldPoint.x, e.worldPoint.y)
					: undefined;
			const p = { x: e.worldPoint.x, y: e.worldPoint.y };
			// The first dab acts at once (a click alone shapes a little), as one frame.
			active = {
				stroke,
				settings,
				mode,
				target,
				at: p,
				pointer: p,
				time: now() - 1000 / 60,
				frame: 0,
			};
			step(active);
			active.frame = requestFrame(loop);
			deps.cursor.set({ x: p.x, y: p.y, visible: true });
		},
		onPointerMove(_ctx, e) {
			deps.cursor.set({ x: e.worldPoint.x, y: e.worldPoint.y, visible: true });
			if (active) active.pointer = { x: e.worldPoint.x, y: e.worldPoint.y };
		},
		onPointerUp(ctx, e) {
			if (active) active.pointer = { x: e.worldPoint.x, y: e.worldPoint.y };
			end(ctx, true);
		},
		onActivate() {
			deps.cursor.set({ visible: false });
		},
		onDeactivate(ctx) {
			// Switched away mid-stroke: nothing was written, so drop it.
			end(ctx, false);
			deps.cursor.set({ visible: false });
		},
	};
}
