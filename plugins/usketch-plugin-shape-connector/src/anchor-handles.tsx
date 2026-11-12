import {
	type AnchorType,
	clampToShapeEdge,
	getAnchorPoint,
	getAnchorRatio,
} from "@edv4h/usketch-connector-anchor";
import type {
	CanvasPointerEvent,
	Point,
	SelectionHandle,
	SelectionHandleDrag,
	SelectionHandleProvider,
	SelectionHandleRenderContext,
	ShapeData,
	ToolContext,
} from "@edv4h/usketch-shared";
import { generateId, safeRotation, worldToScreen } from "@edv4h/usketch-shared";
import {
	createAddShapeCommand,
	isEffectivelyHidden,
	isEffectivelyLocked,
} from "@edv4h/usketch-store";
import { useSyncExternalStore } from "react";
import { MIN_DRAG_SCREEN_PX, resolveConnectorEnds } from "./connector-ends.js";
import { findEndShapeAtPoint, findShapeAtPoint } from "./find-shape-at-point.js";
import type { AnchorDrawState, ConnectorHandleStore } from "./handle-state.js";
import { createDefaultConnector } from "./shapes/connector.js";
import type { ConnectorShapeData } from "./types.js";

const HANDLE_RADIUS = 5;
/** How far (screen px) a selected shape's handles sit outside its edge. */
const SELECTED_OFFSET = 16;
/** Snap distance in world coordinates. */
const SNAP_DISTANCE = 12;

/** Shapes a connector never starts from (other connectors). */
const CONNECTOR_TYPES = new Set(["connector", "domain-connector"]);

/**
 * When to surface selected-shape anchor handles. See
 * `ConnectorPluginOptions.anchorHandles`.
 */
export type AnchorHandleMode = "hover" | "single" | "selection";

const EDGE_ANCHORS: AnchorType[] = ["top", "right", "bottom", "left"];

// ── Snap helpers ──

/** Penalty multiplier for center snap — makes edge anchors preferred over center. */
const CENTER_SNAP_PENALTY = 3;

/** Center of a shape, used as the reference point for resolving `auto` anchors. */
function shapeCenter(shape: ShapeData): Point {
	return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

/**
 * Find the closest snap anchor on a shape. Returns the anchor type and distance.
 * For the `auto` (center) snap, `point` is the edge intersection facing `from`
 * (the other end of the connector), matching what `tracking` recomputes later.
 */
function findSnapAnchor(
	shape: ShapeData,
	worldPoint: Point,
	from: Point,
): { anchor: AnchorType; point: Point; dist: number } {
	const c = shapeCenter(shape);
	const centerDist = Math.hypot(worldPoint.x - c.x, worldPoint.y - c.y);

	// Center uses penalized distance so edge anchors are preferred
	let best = {
		anchor: "auto" as AnchorType,
		point: getAnchorPoint(shape, "auto", from),
		dist: centerDist * CENTER_SNAP_PENALTY,
		realDist: centerDist,
	};
	for (const anchor of EDGE_ANCHORS) {
		const p = getAnchorPoint(shape, anchor);
		const dist = Math.hypot(worldPoint.x - p.x, worldPoint.y - p.y);
		if (dist < best.dist) best = { anchor, point: p, dist, realDist: dist };
	}
	return { anchor: best.anchor, point: best.point, dist: best.realDist };
}

/** The target end for a pointer over `target`: a snapped anchor, or a point on its edge. */
function resolveTarget(
	target: ShapeData,
	worldPoint: Point,
	source: ShapeData,
): { anchor: AnchorType; point: Point } {
	const snap = findSnapAnchor(target, worldPoint, shapeCenter(source));
	return snap.dist <= SNAP_DISTANCE
		? { anchor: snap.anchor, point: snap.point }
		: { anchor: "custom", point: clampToShapeEdge(target, worldPoint) };
}

/**
 * Push a selected shape's anchor handle outward so it clears the shape edge.
 * The outward direction is rotated by the shape's rotation so the offset stays
 * perpendicular to the (rotated) edge.
 */
function selectedOffset(anchor: AnchorType, rotationDeg: number): Point | undefined {
	const dir =
		anchor === "top"
			? { x: 0, y: -1 }
			: anchor === "bottom"
				? { x: 0, y: 1 }
				: anchor === "left"
					? { x: -1, y: 0 }
					: anchor === "right"
						? { x: 1, y: 0 }
						: null;
	if (!dir) return undefined;
	const rad = (rotationDeg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return {
		x: (dir.x * cos - dir.y * sin) * SELECTED_OFFSET,
		y: (dir.x * sin + dir.y * cos) * SELECTED_OFFSET,
	};
}

/** Handle id ↔ (shape, anchor). */
const handleId = (shapeId: string, anchor: AnchorType) => `${shapeId}:${anchor}`;
const anchorOf = (handle: SelectionHandle) =>
	handle.id.slice(handle.id.lastIndexOf(":") + 1) as AnchorType;

// ── Drawing a connector from a handle ──

function startAnchorDraw(
	ctx: ToolContext,
	source: ShapeData,
	sourceAnchor: AnchorType,
	pressed: CanvasPointerEvent,
	freeEnds: boolean,
	state: ConnectorHandleStore,
): SelectionHandleDrag {
	const connectorId = generateId();
	/** The preview connector is added only once the pointer has really moved. */
	let added = false;

	const set = (patch: Partial<AnchorDrawState>) => {
		const cur = state.get().anchorDraw;
		if (cur) state.set({ anchorDraw: { ...cur, ...patch } });
	};
	state.set({
		anchorDraw: {
			connectorId,
			sourceShape: source,
			sourceAnchor,
			targetShapeId: null,
			targetAnchor: "auto",
			targetPoint: null,
		},
	});

	const dropTarget = (point: Point) =>
		freeEnds
			? findEndShapeAtPoint(ctx, point, ctx.store.getViewport().zoom)
			: findShapeAtPoint(ctx, point);

	const finish = () => state.set({ anchorDraw: null });

	return {
		cursor: "crosshair",
		move(event) {
			if (!added) {
				const d = Math.hypot(
					event.screenPoint.x - pressed.screenPoint.x,
					event.screenPoint.y - pressed.screenPoint.y,
				);
				if (d < MIN_DRAG_SCREEN_PX) return;
				const sourcePoint = getAnchorPoint(source, sourceAnchor);
				const connector: ConnectorShapeData = {
					...createDefaultConnector({ id: connectorId, x: sourcePoint.x, y: sourcePoint.y }),
					sourceId: source.id,
					targetId: undefined,
					sourceAnchor,
					targetAnchor: "auto",
					sourcePoint,
					targetPoint: sourcePoint,
					style: { ...ctx.store.getStyleSettings(), fill: "transparent" },
				};
				ctx.store.addShape(connector);
				added = true;
			}

			const worldPoint = event.worldPoint;
			const target = dropTarget(worldPoint);
			const over = target && target.id !== source.id ? target : null;
			const resolved = over ? resolveTarget(over, worldPoint, source) : null;
			const targetPoint = resolved?.point ?? worldPoint;
			const sourcePoint = getAnchorPoint(source, sourceAnchor, targetPoint);
			ctx.store.updateShape(connectorId, {
				sourcePoint,
				targetPoint,
				x: Math.min(sourcePoint.x, targetPoint.x),
				y: Math.min(sourcePoint.y, targetPoint.y),
				width: Math.abs(targetPoint.x - sourcePoint.x),
				height: Math.abs(targetPoint.y - sourcePoint.y),
			} as Partial<ConnectorShapeData>);
			set({
				targetShapeId: over?.id ?? null,
				targetAnchor: resolved?.anchor ?? "auto",
				targetPoint: resolved?.point ?? null,
			});
		},
		end(event) {
			finish();
			// A click on a handle (no drag) adds nothing.
			if (!added) return false;
			const connector = ctx.store.getShape(connectorId) as ConnectorShapeData | undefined;
			// The preview is never kept as-is: it is replaced below through one
			// undoable command, or dropped.
			ctx.store.deleteShape(connectorId);
			if (!connector) return true;

			const worldPoint = event.worldPoint;
			const target = dropTarget(worldPoint);
			if (target?.id === source.id) return true;
			if (!target && !freeEnds) return true;

			const ends = target
				? (() => {
						const { anchor, point } = resolveTarget(target, worldPoint, source);
						const sourcePoint = getAnchorPoint(source, sourceAnchor, point);
						return {
							targetId: target.id,
							targetAnchor: anchor,
							...(anchor === "custom" ? { targetAnchorRatio: getAnchorRatio(target, point) } : {}),
							sourcePoint,
							targetPoint: point,
							x: Math.min(sourcePoint.x, point.x),
							y: Math.min(sourcePoint.y, point.y),
							width: Math.abs(point.x - sourcePoint.x),
							height: Math.abs(point.y - sourcePoint.y),
						};
					})()
				: // Released on empty space → a free end fixed at the release point.
					resolveConnectorEnds(
						{ shape: source, anchor: sourceAnchor, point: getAnchorPoint(source, sourceAnchor) },
						{ shape: null, anchor: "auto", point: worldPoint },
					);
			ctx.commands.execute(createAddShapeCommand(ctx.store, { ...connector, ...ends }));
			return true;
		},
		cancel() {
			finish();
			if (added) ctx.store.deleteShape(connectorId);
		},
	};
}

// ── Provider ──

/**
 * Anchor handles: dots on the four edges of the selected shape (pushed just
 * outside it) and of the hovered shape. Drag one to draw a connector from that
 * anchor; drop on a shape to connect, snapping to its anchors.
 */
export function createAnchorHandleProvider(options: {
	id: string;
	mode: AnchorHandleMode;
	freeEnds: boolean;
	state: ConnectorHandleStore;
}): SelectionHandleProvider {
	const { id, mode, freeEnds, state } = options;
	return {
		id,
		getHandles({ store, selection, hoveredShapeId }) {
			const targets: { shape: ShapeData; selected: boolean }[] = [];
			const usable = (s: ShapeData | undefined): s is ShapeData =>
				!!s && !CONNECTOR_TYPES.has(s.type) && !isEffectivelyHidden(store, s);
			// - "selection": every selected shape
			// - "single": only when exactly one shape is selected (default — a
			//   connector starts from one source, so a multi-select showing every
			//   shape's anchors is noise)
			// - "hover": nothing from the selection
			if (mode === "selection" || (mode === "single" && selection.size === 1)) {
				for (const sid of selection) {
					const s = store.getShape(sid);
					if (usable(s)) targets.push({ shape: s, selected: true });
				}
			}
			// The hovered shape shows its anchors in every mode. A locked shape can't
			// be a connector's target, so it doesn't offer them on hover either.
			if (hoveredShapeId && !selection.has(hoveredShapeId)) {
				const s = store.getShape(hoveredShapeId);
				if (usable(s) && !isEffectivelyLocked(store, s))
					targets.push({ shape: s, selected: false });
			}
			return targets.flatMap(({ shape, selected }) =>
				EDGE_ANCHORS.map(
					(anchor): SelectionHandle => ({
						id: handleId(shape.id, anchor),
						point: getAnchorPoint(shape, anchor),
						offset: selected ? selectedOffset(anchor, safeRotation(shape.rotation)) : undefined,
						cursor: "crosshair",
						shapeId: shape.id,
					}),
				),
			);
		},
		startDrag(handle, event, ctx) {
			const source = handle.shapeId ? ctx.store.getShape(handle.shapeId) : undefined;
			if (!source) return null;
			return startAnchorDraw(ctx, source, anchorOf(handle), event, freeEnds, state);
		},
		render: (ctx) => <AnchorHandles ctx={ctx} state={state} />,
	};
}

const svgStyle = {
	position: "absolute",
	left: 0,
	top: 0,
	width: "100%",
	height: "100%",
	overflow: "visible",
	pointerEvents: "none",
} as const;

function AnchorHandles({
	ctx,
	state,
}: {
	ctx: SelectionHandleRenderContext;
	state: ConnectorHandleStore;
}) {
	const drawing = useSyncExternalStore(state.subscribe, state.get, state.get).anchorDraw;
	const { colors, viewport } = ctx;

	// While drawing: the target shape's anchors, the one it would snap to filled.
	if (ctx.dragging) {
		const target = drawing?.targetShapeId ? ctx.store.getShape(drawing.targetShapeId) : undefined;
		if (!drawing || !target) return null;
		const anchors: AnchorType[] = [...EDGE_ANCHORS, "auto"];
		return (
			<svg style={svgStyle} aria-hidden>
				{anchors.map((anchor) => {
					const p = getAnchorPoint(target, anchor);
					const s = worldToScreen(p.x, p.y, viewport);
					const active = drawing.targetAnchor === anchor;
					return (
						<circle
							key={anchor}
							cx={s.x}
							cy={s.y}
							r={active ? HANDLE_RADIUS + 2 : HANDLE_RADIUS}
							strokeWidth={active ? 2 : 1.5}
							opacity={active ? 1 : 0.6}
							style={{ fill: active ? colors.stroke : colors.fill, stroke: colors.stroke }}
						/>
					);
				})}
			</svg>
		);
	}

	if (ctx.handles.length === 0) return null;
	return (
		<svg style={svgStyle} aria-hidden>
			{ctx.handles.map((h) => {
				const s = ctx.toScreen(h);
				const hovered = ctx.hoveredHandleId === h.id;
				return (
					<g key={h.id} opacity={hovered ? 1 : 0.85}>
						<circle
							cx={s.x}
							cy={s.y}
							r={HANDLE_RADIUS + (hovered ? 1 : 0)}
							strokeWidth={1.5}
							style={{ fill: colors.fill, stroke: colors.stroke }}
						/>
						<circle cx={s.x} cy={s.y} r={2} style={{ fill: colors.stroke }} />
					</g>
				);
			})}
		</svg>
	);
}
