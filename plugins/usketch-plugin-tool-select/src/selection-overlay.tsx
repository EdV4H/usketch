import type { BoardStore, ShapeRegistry, Viewport } from "@edv4h/usketch-shared";
import { safeRotation } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { getMovingSelection, subscribeMovingSelection } from "./drag-state.js";
import { getDropTargetId, subscribeDropTarget } from "./drop-target-state.js";
import { getHoveredShapeId, subscribeHoveredShape } from "./hover-state.js";
import type { MarqueeMode } from "./marquee-state.js";
import {
	getMarqueeHitIds,
	getMarqueeMode,
	getMarqueeRect,
	subscribeMarquee,
} from "./marquee-state.js";
import {
	getHandlePositions,
	getMultiSelectionBounds,
	getShapeBounds,
	HANDLE_SIZE,
	ROTATION_HANDLE_OFFSET,
	ROTATION_HANDLE_RADIUS,
} from "./resize-utils.js";

interface SelectionOverlayProps {
	store: BoardStore;
	shapes: ShapeRegistry;
	viewport: Viewport;
}

const STROKE_COLOR = "#2680eb";

function ShapeBoundingBox({
	store,
	shapes,
	viewport,
	shapeId,
}: {
	store: BoardStore;
	shapes: ShapeRegistry;
	viewport: Viewport;
	shapeId: string;
}) {
	const bounds = getShapeBounds(store, shapes, shapeId);
	if (!bounds) return null;
	return (
		<rect
			x={bounds.x * viewport.zoom + viewport.x}
			y={bounds.y * viewport.zoom + viewport.y}
			width={bounds.width * viewport.zoom}
			height={bounds.height * viewport.zoom}
			fill="none"
			stroke={STROKE_COLOR}
			strokeWidth={1}
		/>
	);
}

export function SelectionOverlay({ store, shapes, viewport }: SelectionOverlayProps) {
	const selection = useSyncExternalStore(
		(cb) => store.subscribe(cb),
		() => store.getSelection(),
		() => store.getSelection(),
	);

	const activeToolId = useSyncExternalStore(
		(cb) => store.subscribe(cb),
		() => store.getActiveToolId(),
		() => store.getActiveToolId(),
	);

	const marqueeRect = useSyncExternalStore(subscribeMarquee, getMarqueeRect, getMarqueeRect);
	const marqueeHitIds = useSyncExternalStore(subscribeMarquee, getMarqueeHitIds, getMarqueeHitIds);
	const marqueeMode: MarqueeMode = useSyncExternalStore(
		subscribeMarquee,
		getMarqueeMode,
		getMarqueeMode,
	);

	const isMoving = useSyncExternalStore(
		subscribeMovingSelection,
		getMovingSelection,
		getMovingSelection,
	);

	const hoveredId = useSyncExternalStore(
		subscribeHoveredShape,
		getHoveredShapeId,
		getHoveredShapeId,
	);
	const dropTargetId = useSyncExternalStore(subscribeDropTarget, getDropTargetId, getDropTargetId);

	if (activeToolId !== "select") return null;

	// Drop target indicator: shown during move even when isMoving is true
	const dropBounds = dropTargetId ? getShapeBounds(store, shapes, dropTargetId) : null;
	const dropIndicator = dropBounds ? (
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
			<rect
				x={dropBounds.x * viewport.zoom + viewport.x}
				y={dropBounds.y * viewport.zoom + viewport.y}
				width={dropBounds.width * viewport.zoom}
				height={dropBounds.height * viewport.zoom}
				fill="none"
				stroke={STROKE_COLOR}
				strokeWidth={2}
			/>
		</svg>
	) : null;

	if (isMoving) return dropIndicator;

	// Hover indicator: show outline on shape under cursor (if not already selected)
	const showHover = hoveredId && !selection.has(hoveredId);
	const hoverBounds = showHover ? getShapeBounds(store, shapes, hoveredId) : null;
	const hoverIndicator = hoverBounds ? (
		<rect
			x={hoverBounds.x * viewport.zoom + viewport.x}
			y={hoverBounds.y * viewport.zoom + viewport.y}
			width={hoverBounds.width * viewport.zoom}
			height={hoverBounds.height * viewport.zoom}
			fill="none"
			stroke={STROKE_COLOR}
			strokeWidth={2}
			opacity={0.8}
		/>
	) : null;

	// Single selection: bounding box + handles + rotation handle
	if (selection.size === 1 && !marqueeRect) {
		const shapeId = [...selection][0];
		const shape = store.getShape(shapeId);
		if (!shape) return null;

		const def = shapes.get(shape.type);
		const bounds = def
			? def.getBounds(shape)
			: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };

		const sx = bounds.x * viewport.zoom + viewport.x;
		const sy = bounds.y * viewport.zoom + viewport.y;
		const sw = bounds.width * viewport.zoom;
		const sh = bounds.height * viewport.zoom;

		const rotation = safeRotation(shape.rotation);
		const screenCx = sx + sw / 2;
		const screenCy = sy + sh / 2;

		// Hide resize handles when shape definition declares resizable: false
		const hideHandles = def?.resizable === false;
		const positions = getHandlePositions(bounds, viewport);
		const half = HANDLE_SIZE / 2;

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
				{hoverIndicator}
				<g transform={rotation ? `rotate(${rotation}, ${screenCx}, ${screenCy})` : undefined}>
					<rect
						x={sx}
						y={sy}
						width={sw}
						height={sh}
						fill="none"
						stroke={STROKE_COLOR}
						strokeWidth={1}
					/>
					{!hideHandles &&
						[...positions.entries()].map(([handle, pos]) => (
							<rect
								key={handle}
								x={pos.x - half}
								y={pos.y - half}
								width={HANDLE_SIZE}
								height={HANDLE_SIZE}
								fill="#ffffff"
								stroke={STROKE_COLOR}
								strokeWidth={1}
							/>
						))}
					{/* Rotation handle: line + circle above top-center */}
					{!hideHandles && (
						<>
							<line
								x1={sx + sw / 2}
								y1={sy}
								x2={sx + sw / 2}
								y2={sy - ROTATION_HANDLE_OFFSET}
								stroke={STROKE_COLOR}
								strokeWidth={1}
							/>
							<circle
								cx={sx + sw / 2}
								cy={sy - ROTATION_HANDLE_OFFSET}
								r={ROTATION_HANDLE_RADIUS}
								fill="#ffffff"
								stroke={STROKE_COLOR}
								strokeWidth={1.5}
							/>
						</>
					)}
				</g>
			</svg>
		);
	}

	// Multi selection / marquee drag
	const multiBounds = selection.size > 1 ? getMultiSelectionBounds(store, shapes, selection) : null;
	const hasMarqueeHits = marqueeRect && marqueeHitIds.length > 0;

	if (!multiBounds && !marqueeRect && !hoverIndicator) return null;

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
			{hoverIndicator}
			{/* Individual bounding boxes for confirmed selection */}
			{multiBounds &&
				[...selection].map((id) => (
					<ShapeBoundingBox
						key={id}
						store={store}
						shapes={shapes}
						viewport={viewport}
						shapeId={id}
					/>
				))}
			{/* Combined bounding box for confirmed selection */}
			{multiBounds && (
				<>
					<rect
						x={multiBounds.x * viewport.zoom + viewport.x}
						y={multiBounds.y * viewport.zoom + viewport.y}
						width={multiBounds.width * viewport.zoom}
						height={multiBounds.height * viewport.zoom}
						fill="none"
						stroke={STROKE_COLOR}
						strokeWidth={1}
						strokeDasharray="4 2"
					/>
					{[...getHandlePositions(multiBounds, viewport).entries()].map(([handle, pos]) => (
						<rect
							key={`multi-handle-${handle}`}
							x={pos.x - HANDLE_SIZE / 2}
							y={pos.y - HANDLE_SIZE / 2}
							width={HANDLE_SIZE}
							height={HANDLE_SIZE}
							fill="#ffffff"
							stroke={STROKE_COLOR}
							strokeWidth={1}
						/>
					))}
				</>
			)}
			{/* Individual bounding boxes for marquee-hovered shapes */}
			{hasMarqueeHits &&
				marqueeHitIds.map((id) => (
					<ShapeBoundingBox
						key={`marquee-${id}`}
						store={store}
						shapes={shapes}
						viewport={viewport}
						shapeId={id}
					/>
				))}
			{/* Marquee rectangle (world-space → screen-space) */}
			{marqueeRect && (
				<rect
					x={marqueeRect.x * viewport.zoom + viewport.x}
					y={marqueeRect.y * viewport.zoom + viewport.y}
					width={marqueeRect.width * viewport.zoom}
					height={marqueeRect.height * viewport.zoom}
					fill={marqueeMode === "contain" ? "rgba(38, 128, 235, 0.08)" : "rgba(38, 128, 235, 0.1)"}
					stroke={STROKE_COLOR}
					strokeWidth={1}
					strokeDasharray={marqueeMode === "contain" ? undefined : "4 2"}
				/>
			)}
		</svg>
	);
}
