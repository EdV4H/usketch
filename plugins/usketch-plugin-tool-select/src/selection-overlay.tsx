import type { BoardStore, ShapeRegistry, Viewport } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { getHandlePositions, HANDLE_SIZE } from "./resize-utils.js";

interface SelectionOverlayProps {
	store: BoardStore;
	shapes: ShapeRegistry;
	viewport: Viewport;
}

const STROKE_COLOR = "#2680eb";

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

	if (activeToolId !== "select") return null;
	if (selection.size !== 1) return null;

	const shapeId = [...selection][0];
	const shape = store.getShape(shapeId);
	if (!shape) return null;

	const def = shapes.get(shape.type);
	const bounds = def
		? def.getBounds(shape)
		: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };

	// Convert bounds to screen coordinates
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
			{/* Bounding box */}
			<rect
				x={sx}
				y={sy}
				width={sw}
				height={sh}
				fill="none"
				stroke={STROKE_COLOR}
				strokeWidth={1}
			/>
			{/* Resize handles */}
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
