import { type AnchorType, clampToShapeEdge, getAnchorPoint } from "@edv4h/usketch-connector-anchor";
import type {
	CanvasPointerEvent,
	PluginContext,
	Point,
	ShapeData,
	Viewport,
} from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { useCallback, useSyncExternalStore } from "react";
import { createDefaultConnector } from "./shapes/connector.js";
import type { ConnectorShapeData } from "./types.js";

const HANDLE_RADIUS = 5;
const STROKE_COLOR = "#2680eb";
const SELECTED_OFFSET = 16;
/** Snap distance in world coordinates */
const SNAP_DISTANCE = 12;

// ── Pointer down state (to hide handles during shape drag) ──

let pointerDown = false;
const pointerListeners = new Set<() => void>();

function setPointerDown(v: boolean) {
	if (pointerDown === v) return;
	pointerDown = v;
	for (const fn of pointerListeners) fn();
}

function getPointerDown(): boolean {
	return pointerDown;
}

function subscribePointerDown(cb: () => void): () => void {
	pointerListeners.add(cb);
	return () => pointerListeners.delete(cb);
}

// ── Hover state ──

let hoveredShapeId: string | null = null;
const hoverListeners = new Set<() => void>();

function setAnchorHover(id: string | null) {
	if (hoveredShapeId === id) return;
	hoveredShapeId = id;
	for (const fn of hoverListeners) fn();
}

function getAnchorHover(): string | null {
	return hoveredShapeId;
}

function subscribeAnchorHover(cb: () => void): () => void {
	hoverListeners.add(cb);
	return () => hoverListeners.delete(cb);
}

// ── Drawing state ──

interface AnchorDrawState {
	connectorId: string;
	sourceShape: ShapeData;
	sourceAnchor: AnchorType;
	/** Target shape being hovered during draw */
	targetShapeId: string | null;
	/** Resolved target anchor (snapped or custom) */
	targetAnchor: AnchorType;
	/** Resolved target point */
	targetPoint: Point | null;
}

let drawState: AnchorDrawState | null = null;
const drawListeners = new Set<() => void>();

function setAnchorDraw(state: AnchorDrawState | null) {
	drawState = state;
	for (const fn of drawListeners) fn();
}

function getAnchorDraw(): AnchorDrawState | null {
	return drawState;
}

function subscribeAnchorDraw(cb: () => void): () => void {
	drawListeners.add(cb);
	return () => drawListeners.delete(cb);
}

// ── Snap helpers ──

const SNAP_ANCHORS: AnchorType[] = ["top", "right", "bottom", "left"];

/** Penalty multiplier for center snap — makes edge anchors preferred over center. */
const CENTER_SNAP_PENALTY = 3;

/** Find the closest snap anchor on a shape. Returns the anchor type and distance. */
function findSnapAnchor(
	shape: ShapeData,
	worldPoint: Point,
): { anchor: AnchorType; point: Point; dist: number } {
	const cx = shape.x + shape.width / 2;
	const cy = shape.y + shape.height / 2;
	const center: Point = { x: cx, y: cy };
	const centerDist = Math.hypot(worldPoint.x - cx, worldPoint.y - cy);

	// Center uses penalized distance so edge anchors are preferred
	let best = {
		anchor: "auto" as AnchorType,
		point: center,
		dist: centerDist * CENTER_SNAP_PENALTY,
		realDist: centerDist,
	};

	for (const anchor of SNAP_ANCHORS) {
		const p = getAnchorPoint(shape, anchor);
		const dist = Math.hypot(worldPoint.x - p.x, worldPoint.y - p.y);
		if (dist < best.dist) {
			best = { anchor, point: p, dist, realDist: dist };
		}
	}

	return { anchor: best.anchor, point: best.point, dist: best.realDist };
}

// ── Setup ──

export function setupAnchorHandles(ctx: PluginContext): () => void {
	const unsubMove = ctx.events.on<CanvasPointerEvent>("canvas:pointermove", (event) => {
		if (drawState) {
			handleDrawMove(ctx, event.worldPoint);
			return;
		}

		const activeToolId = ctx.store.getActiveToolId();
		if (activeToolId !== "select") {
			setAnchorHover(null);
			return;
		}

		const shape = findNonConnectorShape(ctx, event.worldPoint);
		setAnchorHover(shape?.id ?? null);
	});

	const unsubDown = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", () => {
		if (!drawState) setPointerDown(true);
	});

	const unsubUp = ctx.events.on<CanvasPointerEvent>("canvas:pointerup", (event) => {
		setPointerDown(false);
		if (!drawState) return;
		handleDrawEnd(ctx, event.worldPoint);
	});

	return () => {
		unsubMove();
		unsubDown();
		unsubUp();
		setAnchorHover(null);
		setAnchorDraw(null);
		setPointerDown(false);
	};
}

function handleDrawMove(ctx: PluginContext, worldPoint: Point) {
	if (!drawState) return;

	const targetShape = findNonConnectorShape(ctx, worldPoint);

	if (targetShape && targetShape.id !== drawState.sourceShape.id) {
		// Over a target shape — snap to nearest anchor or clamp to edge
		const snap = findSnapAnchor(targetShape, worldPoint);

		let targetAnchor: AnchorType;
		let targetPoint: Point;

		if (snap.dist <= SNAP_DISTANCE) {
			// Snap to cardinal anchor or center (auto)
			targetAnchor = snap.anchor;
			targetPoint = snap.point;
		} else {
			// Custom: clamp to shape edge
			targetAnchor = "custom";
			targetPoint = clampToShapeEdge(targetShape, worldPoint);
		}

		const sourcePoint = getAnchorPoint(drawState.sourceShape, drawState.sourceAnchor, targetPoint);

		ctx.store.updateShape(drawState.connectorId, {
			sourcePoint,
			targetPoint,
			x: Math.min(sourcePoint.x, targetPoint.x),
			y: Math.min(sourcePoint.y, targetPoint.y),
			width: Math.abs(targetPoint.x - sourcePoint.x),
			height: Math.abs(targetPoint.y - sourcePoint.y),
		} as Partial<ConnectorShapeData>);

		setAnchorDraw({
			...drawState,
			targetShapeId: targetShape.id,
			targetAnchor,
			targetPoint,
		});
	} else {
		// Not over a target shape — free line
		const sourcePoint = getAnchorPoint(drawState.sourceShape, drawState.sourceAnchor, worldPoint);

		ctx.store.updateShape(drawState.connectorId, {
			sourcePoint,
			targetPoint: worldPoint,
			x: Math.min(sourcePoint.x, worldPoint.x),
			y: Math.min(sourcePoint.y, worldPoint.y),
			width: Math.abs(worldPoint.x - sourcePoint.x),
			height: Math.abs(worldPoint.y - sourcePoint.y),
		} as Partial<ConnectorShapeData>);

		setAnchorDraw({
			...drawState,
			targetShapeId: null,
			targetAnchor: "auto",
			targetPoint: null,
		});
	}
}

function handleDrawEnd(ctx: PluginContext, worldPoint: Point) {
	if (!drawState) return;

	const targetShape = drawState.targetShapeId ? ctx.store.getShape(drawState.targetShapeId) : null;
	const connector = ctx.store.getShape(drawState.connectorId);

	if (!connector || !targetShape) {
		// Also try to find shape at release point
		const releaseTarget = findNonConnectorShape(ctx, worldPoint);
		if (!connector || !releaseTarget || releaseTarget.id === drawState.sourceShape.id) {
			ctx.store.deleteShape(drawState.connectorId);
			setAnchorDraw(null);
			return;
		}
		// Use release target with snap
		const snap = findSnapAnchor(releaseTarget, worldPoint);
		const targetAnchor = snap.dist <= SNAP_DISTANCE ? snap.anchor : "custom";
		const targetPoint =
			snap.dist <= SNAP_DISTANCE ? snap.point : clampToShapeEdge(releaseTarget, worldPoint);
		const sourcePoint = getAnchorPoint(drawState.sourceShape, drawState.sourceAnchor, targetPoint);

		ctx.store.deleteShape(drawState.connectorId);
		const finalShape: ConnectorShapeData = {
			...connector,
			targetId: releaseTarget.id,
			targetAnchor,
			sourcePoint,
			targetPoint,
			x: Math.min(sourcePoint.x, targetPoint.x),
			y: Math.min(sourcePoint.y, targetPoint.y),
			width: Math.abs(targetPoint.x - sourcePoint.x),
			height: Math.abs(targetPoint.y - sourcePoint.y),
		};
		ctx.commands.execute(createAddShapeCommand(ctx.store, finalShape));
		setAnchorDraw(null);
		return;
	}

	const targetAnchor = drawState.targetAnchor;
	const targetPoint =
		drawState.targetPoint ??
		getAnchorPoint(targetShape, "auto", {
			x: drawState.sourceShape.x + drawState.sourceShape.width / 2,
			y: drawState.sourceShape.y + drawState.sourceShape.height / 2,
		});
	const sourcePoint = getAnchorPoint(drawState.sourceShape, drawState.sourceAnchor, targetPoint);

	ctx.store.deleteShape(drawState.connectorId);
	const finalShape: ConnectorShapeData = {
		...connector,
		targetId: targetShape.id,
		targetAnchor,
		sourcePoint,
		targetPoint,
		x: Math.min(sourcePoint.x, targetPoint.x),
		y: Math.min(sourcePoint.y, targetPoint.y),
		width: Math.abs(targetPoint.x - sourcePoint.x),
		height: Math.abs(targetPoint.y - sourcePoint.y),
	};
	ctx.commands.execute(createAddShapeCommand(ctx.store, finalShape));
	setAnchorDraw(null);
}

function findNonConnectorShape(ctx: PluginContext, point: Point): ShapeData | null {
	const shapes = ctx.store.getShapes();
	const entries = [...shapes.entries()].reverse();
	let fallbackContainer: ShapeData | null = null;
	for (const [, data] of entries) {
		if (data.type === "connector") continue;
		const def = ctx.shapes.get(data.type);
		if (!def?.hitTest(data, point)) continue;
		if (data.type === "frame" || data.type === "group") {
			if (!fallbackContainer) fallbackContainer = data;
			continue;
		}
		return data;
	}
	return fallbackContainer;
}

// ── Overlay Component ──

/**
 * When to surface selected-shape anchor handles. See
 * `ConnectorPluginOptions.anchorHandles`. Defined here (rather than in
 * `plugin.tsx`) so the overlay owns the enum it consumes and `plugin.tsx` can
 * import it without a back-reference cycle.
 */
export type AnchorHandleMode = "hover" | "single" | "selection";

interface AnchorHandleOverlayProps {
	ctx: PluginContext;
	viewport: Viewport;
	/** Which shapes get anchor handles from the selection. Default `"single"`. */
	mode?: AnchorHandleMode;
}

export function AnchorHandleOverlay({ ctx, viewport, mode = "single" }: AnchorHandleOverlayProps) {
	const hoverId = useSyncExternalStore(subscribeAnchorHover, getAnchorHover);
	const drawing = useSyncExternalStore(subscribeAnchorDraw, getAnchorDraw);
	const isDragging = useSyncExternalStore(subscribePointerDown, getPointerDown);

	const activeToolId = useSyncExternalStore(
		(cb) => ctx.store.subscribe(cb),
		() => ctx.store.getActiveToolId(),
	);

	const shapes = useSyncExternalStore(
		(cb) => ctx.store.subscribe(cb),
		() => ctx.store.getShapes(),
	);

	const selection = useSyncExternalStore(
		(cb) => ctx.store.subscribe(cb),
		() => ctx.store.getSelection(),
	);

	if (activeToolId !== "select") return null;

	// During drawing: show target shape anchor indicators
	if (drawing && drawing.targetShapeId) {
		const targetShape = shapes.get(drawing.targetShapeId);
		if (!targetShape) return null;

		const anchors: AnchorType[] = ["top", "right", "bottom", "left", "auto"];
		return (
			<svg
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: "100%",
					height: "100%",
					overflow: "visible",
					pointerEvents: "none",
				}}
			>
				{anchors.map((anchor) => {
					const point = getAnchorPoint(targetShape, anchor);
					const screen = worldToScreen(point, viewport);
					const isActive = drawing.targetAnchor === anchor;
					return (
						<circle
							key={anchor}
							cx={screen.x}
							cy={screen.y}
							r={isActive ? HANDLE_RADIUS + 2 : HANDLE_RADIUS}
							fill={isActive ? STROKE_COLOR : "white"}
							stroke={STROKE_COLOR}
							strokeWidth={isActive ? 2 : 1.5}
							opacity={isActive ? 1 : 0.6}
						/>
					);
				})}
			</svg>
		);
	}

	if (drawing) return null;

	// Hide anchor handles while dragging shapes
	if (isDragging) return null;

	// Not drawing: show anchor handles on the selected + hovered shape, per `mode`.
	// - "selection": every selected shape
	// - "single": only when exactly one shape is selected (default — a connector
	//   starts from one source, so a multi-select showing every shape's anchors
	//   is noise; #675)
	// - "hover": nothing from the selection
	// Hovering an individual shape still reveals its anchors in every mode
	// (handled below).
	const targets: { shape: ShapeData; isSelected: boolean }[] = [];

	const showSelectionAnchors = mode === "selection" || (mode === "single" && selection.size === 1);
	if (showSelectionAnchors) {
		for (const id of selection) {
			const s = shapes.get(id);
			if (s && s.type !== "connector") {
				targets.push({ shape: s, isSelected: true });
			}
		}
	}

	if (hoverId && !selection.has(hoverId)) {
		const s = shapes.get(hoverId);
		if (s && s.type !== "connector") {
			targets.push({ shape: s, isSelected: false });
		}
	}

	if (targets.length === 0) return null;

	const anchors: AnchorType[] = ["top", "right", "bottom", "left"];

	return (
		<svg
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				width: "100%",
				height: "100%",
				overflow: "visible",
				pointerEvents: "none",
			}}
		>
			{targets.map(({ shape, isSelected }) =>
				anchors.map((anchor) => {
					const point = getAnchorPoint(shape, anchor);
					const screen = worldToScreen(point, viewport);
					const offsetScreen = isSelected ? applySelectedOffset(screen, anchor) : screen;
					return (
						<AnchorHandle
							key={`${shape.id}-${anchor}`}
							screen={offsetScreen}
							anchor={anchor}
							shape={shape}
							ctx={ctx}
						/>
					);
				}),
			)}
		</svg>
	);
}

function applySelectedOffset(screen: Point, anchor: AnchorType): Point {
	switch (anchor) {
		case "top":
			return { x: screen.x, y: screen.y - SELECTED_OFFSET };
		case "bottom":
			return { x: screen.x, y: screen.y + SELECTED_OFFSET };
		case "left":
			return { x: screen.x - SELECTED_OFFSET, y: screen.y };
		case "right":
			return { x: screen.x + SELECTED_OFFSET, y: screen.y };
		default:
			return screen;
	}
}

function AnchorHandle({
	screen,
	anchor,
	shape,
	ctx,
}: {
	screen: Point;
	anchor: AnchorType;
	shape: ShapeData;
	ctx: PluginContext;
}) {
	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			e.preventDefault();

			const id = generateId();
			const sourcePoint = getAnchorPoint(shape, anchor);

			const connector: ConnectorShapeData = {
				...createDefaultConnector({ id, x: sourcePoint.x, y: sourcePoint.y }),
				sourceId: shape.id,
				targetId: undefined,
				sourceAnchor: anchor,
				targetAnchor: "auto",
				sourcePoint,
				targetPoint: sourcePoint,
				style: { ...ctx.store.getStyleSettings(), fill: "transparent" },
			};

			ctx.store.addShape(connector);
			setAnchorDraw({
				connectorId: id,
				sourceShape: shape,
				sourceAnchor: anchor,
				targetShapeId: null,
				targetAnchor: "auto",
				targetPoint: null,
			});
		},
		[shape, anchor, ctx],
	);

	return (
		<g onPointerDown={handlePointerDown} style={{ cursor: "crosshair", pointerEvents: "auto" }}>
			<circle cx={screen.x} cy={screen.y} r={HANDLE_RADIUS + 4} fill="transparent" />
			<circle
				cx={screen.x}
				cy={screen.y}
				r={HANDLE_RADIUS}
				fill="white"
				stroke={STROKE_COLOR}
				strokeWidth={1.5}
				opacity={0.8}
			/>
			<circle cx={screen.x} cy={screen.y} r={2} fill={STROKE_COLOR} />
		</g>
	);
}

function worldToScreen(point: Point, viewport: Viewport): Point {
	return {
		x: point.x * viewport.zoom + viewport.x,
		y: point.y * viewport.zoom + viewport.y,
	};
}
