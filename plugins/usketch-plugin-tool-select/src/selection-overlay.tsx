import type { BoardStore, ShapeRegistry, Viewport } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { getDragging, subscribeDragging } from "./drag-state.js";
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

	const isDragging = useSyncExternalStore(subscribeDragging, getDragging, getDragging);

	if (activeToolId !== "select") return null;
	if (isDragging) return null;

	// Single selection: bounding box + handles
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
				<rect
					x={sx}
					y={sy}
					width={sw}
					height={sh}
					fill="none"
					stroke={STROKE_COLOR}
					strokeWidth={1}
				/>
				{[...positions.entries()].map(([handle, pos]) => (
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
			</svg>
		);
	}

	// Multi selection / marquee drag
	const multiBounds = selection.size > 1 ? getMultiSelectionBounds(store, shapes, selection) : null;
	const hasMarqueeHits = marqueeRect && marqueeHitIds.length > 0;

	if (!multiBounds && !marqueeRect) return null;

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
			{/* Marquee rectangle */}
			{marqueeRect && (
				<rect
					x={marqueeRect.x}
					y={marqueeRect.y}
					width={marqueeRect.width}
					height={marqueeRect.height}
					fill={marqueeMode === "contain" ? "rgba(38, 128, 235, 0.08)" : "rgba(38, 128, 235, 0.1)"}
					stroke={STROKE_COLOR}
					strokeWidth={1}
					strokeDasharray={marqueeMode === "contain" ? undefined : "4 2"}
				/>
			)}
		</svg>
	);
}
