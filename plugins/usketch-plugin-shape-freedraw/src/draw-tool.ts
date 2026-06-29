import {
	type BoundingBox,
	type CanvasPointerEvent,
	DEFAULT_STYLE,
	generateId,
	type ShapeData,
	type ToolContext,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { TUNING } from "./config.js";
import { createEraseStrokesCommand, findErasedStrokes } from "./eraser.js";
import { smoothPressure, speedPressure } from "./geometry/brush-outline.js";
import { simplifyPoints } from "./geometry/simplify.js";
import { penMeta } from "./pen-meta.js";
import type { FreedrawSettingsStore } from "./settings-store.js";
import type { FreedrawShapeData, PenKind, StrokePoint } from "./types.js";
import type { PointerStore } from "./ui/cursor-overlay.js";

interface StrokeState {
	id: string;
	pen: PenKind;
	size: number;
	color: string;
	alpha: number;
	variable: boolean;
	points: StrokePoint[];
	lastScreenX: number;
	lastScreenY: number;
	lastT: number;
	prevP: number;
}

interface EraseState {
	removed: Map<string, ShapeData>;
}

function halfWidthForPen(variable: boolean, size: number): number {
	return variable ? (size * 1.55) / 2 : size / 2;
}

function boundsOf(points: StrokePoint[], pad: number): BoundingBox {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const p of points) {
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
	}
	return {
		x: minX - pad,
		y: minY - pad,
		width: maxX - minX + pad * 2,
		height: maxY - minY + pad * 2,
	};
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export interface DrawController {
	onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent): void;
	onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent): void;
	onPointerUp(toolCtx: ToolContext, event: CanvasPointerEvent): void;
	/** ツール無効化時のクリーンアップ。 */
	reset(): void;
}

export function createDrawController(
	settings: FreedrawSettingsStore,
	pointer: PointerStore,
): DrawController {
	let stroke: StrokeState | null = null;
	let erase: EraseState | null = null;
	let raf = 0;

	function buildStyle(color: string, size: number, alpha: number) {
		return { ...DEFAULT_STYLE, stroke: color, strokeWidth: size, opacity: alpha };
	}

	function flush(toolCtx: ToolContext) {
		if (raf) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
			if (!stroke) return;
			const pad = halfWidthForPen(stroke.variable, stroke.size);
			const b = boundsOf(stroke.points, pad);
			toolCtx.store.updateShape(stroke.id, {
				x: b.x,
				y: b.y,
				width: b.width,
				height: b.height,
				points: [...stroke.points],
			} as Partial<FreedrawShapeData>);
		});
	}

	function doErase(toolCtx: ToolContext, world: { x: number; y: number }) {
		if (!erase) return;
		const eraserSize = settings.getSnapshot().eraserSize;
		const hits = findErasedStrokes(toolCtx.store, world, eraserSize);
		for (const s of hits) {
			if (!erase.removed.has(s.id)) {
				erase.removed.set(s.id, { ...s });
				toolCtx.store.deleteShape(s.id);
			}
		}
	}

	return {
		onPointerDown(toolCtx, event) {
			if (event.button !== 0) return;
			pointer.set(event.worldPoint);
			const s = settings.getSnapshot();

			if (s.mode === "eraser") {
				erase = { removed: new Map() };
				doErase(toolCtx, event.worldPoint);
				return;
			}

			const pen = s.pen;
			const size = s.sizes[pen];
			const m = penMeta(pen);
			const id = generateId();
			const first: StrokePoint = {
				x: event.worldPoint.x,
				y: event.worldPoint.y,
				p: m.variable ? TUNING.startPressure : undefined,
			};
			stroke = {
				id,
				pen,
				size,
				color: s.color,
				alpha: m.alpha,
				variable: m.variable,
				points: [first],
				lastScreenX: event.screenPoint.x,
				lastScreenY: event.screenPoint.y,
				lastT: now(),
				prevP: TUNING.startPressure,
			};
			const shape: FreedrawShapeData = {
				id,
				type: "freedraw",
				x: event.worldPoint.x,
				y: event.worldPoint.y,
				width: 0,
				height: 0,
				style: buildStyle(s.color, size, m.alpha),
				points: [first],
				pen,
			};
			toolCtx.store.addShape(shape);
		},

		onPointerMove(toolCtx, event) {
			pointer.set(event.worldPoint);
			const s = settings.getSnapshot();

			if (s.mode === "eraser") {
				if (erase) doErase(toolCtx, event.worldPoint);
				return;
			}
			if (!stroke) return;

			const world = event.worldPoint;
			const last = stroke.points[stroke.points.length - 1];
			const movedWorld = Math.hypot(world.x - last.x, world.y - last.y);
			const zoom = toolCtx.store.getViewport().zoom || 1;
			// 間引き（screen px 基準を world に換算）。最初の点は除く。
			if (movedWorld < TUNING.minSampleDist / zoom && stroke.points.length > 1) {
				stroke.lastScreenX = event.screenPoint.x;
				stroke.lastScreenY = event.screenPoint.y;
				stroke.lastT = now();
				return;
			}

			let p: number | undefined;
			if (stroke.variable) {
				const t = now();
				const movedScreen = Math.hypot(
					event.screenPoint.x - stroke.lastScreenX,
					event.screenPoint.y - stroke.lastScreenY,
				);
				const target = speedPressure(movedScreen, t - stroke.lastT, s.brushDynamics);
				const sm = smoothPressure(stroke.prevP, target, TUNING.widthSmoothing);
				stroke.prevP = sm;
				p = sm;
			}
			stroke.points.push({ x: world.x, y: world.y, p });
			stroke.lastScreenX = event.screenPoint.x;
			stroke.lastScreenY = event.screenPoint.y;
			stroke.lastT = now();
			flush(toolCtx);
		},

		onPointerUp(toolCtx, _event) {
			const s = settings.getSnapshot();

			if (s.mode === "eraser") {
				if (erase) {
					const removed = [...erase.removed.values()];
					erase = null;
					if (removed.length > 0) {
						toolCtx.commands.execute(createEraseStrokesCommand(toolCtx.store, removed));
					}
				}
				return;
			}

			if (!stroke) return;
			if (raf) {
				cancelAnimationFrame(raf);
				raf = 0;
			}
			const cur = stroke;
			stroke = null;

			// 確定: scratch を削除 → 間引き → undo 可能な追加コマンド。
			toolCtx.store.deleteShape(cur.id);
			const points = simplifyPoints(cur.points, TUNING.simplifyTolerance);
			const pad = halfWidthForPen(cur.variable, cur.size);
			const b = boundsOf(points, pad);
			const shape: FreedrawShapeData = {
				id: cur.id,
				type: "freedraw",
				x: b.x,
				y: b.y,
				width: b.width,
				height: b.height,
				style: buildStyle(cur.color, cur.size, cur.alpha),
				points,
				pen: cur.pen,
			};
			toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
		},

		reset() {
			if (raf) {
				cancelAnimationFrame(raf);
				raf = 0;
			}
			stroke = null;
			erase = null;
			pointer.set(null);
		},
	};
}
