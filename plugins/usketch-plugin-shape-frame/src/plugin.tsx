import type {
	CanvasPointerEvent,
	PluginContext,
	ShapeData,
	ToolContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { generateId, SHAPE_VIEW_3D_MODES, withRotation } from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { FrameTitleEditor, setEditingFrameTitle } from "./frame-title-editor.js";
import {
	createDefaultFrame,
	getBoundsFrame,
	hitTestFrame,
	renderFrame,
	resizeFrame,
} from "./shapes/frame.js";
import type { FrameShapeData } from "./types.js";

/**
 * LOD component: labeled empty frame — dashed border + top-left title.
 * Frames are containers, so they mostly need to show where they are.
 */
function SimplifiedFrame({ shape }: { shape: ShapeData }) {
	const data = shape as FrameShapeData;
	const label = data.name || data.frameTitle || "Frame";
	const rotation = typeof shape.rotation === "number" ? shape.rotation : 0;
	return (
		<div
			style={{
				position: "absolute",
				left: shape.x,
				top: shape.y,
				width: shape.width,
				height: shape.height,
				border: "1px dashed #999",
				background: "rgba(255,255,255,0.3)",
				pointerEvents: "none",
				overflow: "hidden",
				transform: rotation ? `rotate(${rotation}deg)` : undefined,
				transformOrigin: "center center",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: 4,
					left: 6,
					fontSize: 11,
					color: "#666",
					fontWeight: 500,
					whiteSpace: "nowrap",
				}}
			>
				{label}
			</div>
		</div>
	);
}

function FrameIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
			{/* Hash/frame grid */}
			<line x1="7" y1="2" x2="7" y2="18" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="13" y1="2" x2="13" y2="18" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="2" y1="7" x2="18" y2="7" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="2" y1="13" x2="18" y2="13" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}

/** Screen pixels the pointer may travel and still count as a click. */
const CLICK_SLOP_PX = 4;

function exceedsClickSlop(start: { x: number; y: number }, event: CanvasPointerEvent): boolean {
	return Math.hypot(event.screenPoint.x - start.x, event.screenPoint.y - start.y) >= CLICK_SLOP_PX;
}

export interface FramePluginOptions {
	/**
	 * When true, a click without a drag (the pointer moves less than a few
	 * screen pixels, at any zoom) places a default-size frame centered on the
	 * click point, and selects it. Default false: a click without a drag
	 * creates nothing (only a drag creates a frame).
	 */
	clickToPlace?: boolean;
}

export function createFramePlugin(options: FramePluginOptions = {}): UsketchPlugin {
	const { clickToPlace = false } = options;
	return {
		id: "usketch-plugin-shape-frame",
		name: "フレーム",

		setup(ctx: PluginContext) {
			// Register the "frame" shape type
			ctx.shapes.register("frame", {
				// Fills its box: may also be a block in 3D (stand / box / float).
				view3d: { modes: SHAPE_VIEW_3D_MODES },
				render: renderFrame,
				getBounds: getBoundsFrame,
				hitTest: withRotation(hitTestFrame),
				resize: resizeFrame,
				createDefault: createDefaultFrame,
				renderTarget: "html",
				minSize: { width: 50, height: 50 },
				simplifiedComponent: SimplifiedFrame,
				// Frames are containers whose children stay individually selectable
				// and are auto-attached on overlap (handled by the container plugin).
				container: { selectableChildren: true, autoAttach: true },
			});

			// Drawing tool state
			let drawState: {
				startX: number;
				startY: number;
				shapeId: string;
				startScreen: { x: number; y: number };
				/** Pointer travelled at least CLICK_SLOP_PX on screen (i.e. not a click). */
				moved: boolean;
			} | null = null;

			function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
				const id = generateId();
				drawState = {
					startX: event.worldPoint.x,
					startY: event.worldPoint.y,
					shapeId: id,
					startScreen: { ...event.screenPoint },
					moved: false,
				};
				const shape = createDefaultFrame({ id, x: event.worldPoint.x, y: event.worldPoint.y });
				shape.width = 0;
				shape.height = 0;
				shape.style = {
					...shape.style,
					stroke: toolCtx.store.getStyleSettings().stroke,
				};
				toolCtx.store.addShape(shape);
			}

			function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
				if (!drawState) return;
				if (exceedsClickSlop(drawState.startScreen, event)) drawState.moved = true;
				const x = Math.min(drawState.startX, event.worldPoint.x);
				const y = Math.min(drawState.startY, event.worldPoint.y);
				const width = Math.abs(event.worldPoint.x - drawState.startX);
				const height = Math.abs(event.worldPoint.y - drawState.startY);
				toolCtx.store.updateShape(drawState.shapeId, { x, y, width, height });
			}

			function onPointerUp(toolCtx: ToolContext, event: CanvasPointerEvent) {
				if (!drawState) return;
				const draw = drawState;
				if (exceedsClickSlop(draw.startScreen, event)) draw.moved = true;
				const shape = toolCtx.store.getShape(draw.shapeId);
				if (clickToPlace && !draw.moved && shape) {
					// A click (the pointer barely moved on screen, at any zoom) places
					// a default-size frame with the click point at its center.
					toolCtx.store.deleteShape(draw.shapeId);
					const placed = createDefaultFrame({
						id: draw.shapeId,
						x: draw.startX,
						y: draw.startY,
					});
					placed.x -= placed.width / 2;
					placed.y -= placed.height / 2;
					placed.style = {
						...placed.style,
						stroke: toolCtx.store.getStyleSettings().stroke,
					};
					toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, placed));
					toolCtx.store.setSelection([placed.id]);
				} else if (shape && shape.width > 10 && shape.height > 10) {
					toolCtx.store.deleteShape(draw.shapeId);
					toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
				} else {
					toolCtx.store.deleteShape(draw.shapeId);
				}
				drawState = null;
				toolCtx.store.resetToDefaultTool();
			}

			ctx.tools.register("frame-draw", {
				icon: FrameIcon,
				cursor: "crosshair",
				shortcut: "f",
				order: 11,
				onPointerDown,
				onPointerMove,
				onPointerUp,
				onDeactivate() {
					if (drawState) {
						ctx.store.deleteShape(drawState.shapeId);
						drawState = null;
					}
				},
			});

			// ── Auto-parenting ──
			//
			// Attaching shapes to a containing frame (and detaching on exit) is now
			// handled generically by `usketch-plugin-container` via the frame's
			// `container.autoAttach` flag, so no frame-specific reparent logic lives
			// here. Frame moves also drag children along via the select tool's
			// container-aware descendant snapshotting.

			// ── Title inline editing overlay ──
			//
			// The title bar (renderFrame) starts editing on double-click via
			// `setEditingFrameTitle`; this overlay renders the input + commits.
			// Editing closes on the input's blur/Enter/Escape.
			ctx.layers.register({
				id: "usketch-plugin-shape-frame:title-editor",
				view3d: "tilt",
				order: 84,
				fixed: true,
				// World-anchored: follow the camera rotation (see Layer.worldOverlay).
				worldOverlay: true,
				render: (renderCtx) => <FrameTitleEditor ctx={ctx} viewport={renderCtx.viewport} />,
			});

			return () => {
				setEditingFrameTitle(null);
			};
		},
	};
}
