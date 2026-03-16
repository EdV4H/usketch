import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { useCallback, useSyncExternalStore } from "react";

interface ShapeBoundsOverlayProps {
	shape: ShapeData | undefined;
	store: BoardStore;
}

export function ShapeBoundsOverlay({ shape, store }: ShapeBoundsOverlayProps) {
	// Subscribe to store so viewport changes trigger re-render
	const viewport = useSyncExternalStore(
		useCallback((cb: () => void) => store.subscribe(cb), [store]),
		() => store.getViewport(),
	);

	if (!shape) return null;

	const screenX = shape.x * viewport.zoom + viewport.x;
	const screenY = shape.y * viewport.zoom + viewport.y;
	const screenW = shape.width * viewport.zoom;
	const screenH = shape.height * viewport.zoom;

	return (
		<div
			style={{
				position: "absolute",
				left: screenX,
				top: screenY,
				width: screenW,
				height: screenH,
				border: "2px dashed rgba(99, 102, 241, 0.7)",
				borderRadius: 2,
				pointerEvents: "none",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: -16,
					left: 0,
					fontSize: 9,
					fontFamily: "'SF Mono', monospace",
					color: "rgba(99, 102, 241, 0.9)",
					background: "rgba(0, 0, 0, 0.6)",
					padding: "1px 4px",
					borderRadius: 2,
					whiteSpace: "nowrap",
				}}
			>
				{shape.type} ({Math.round(shape.width)}×{Math.round(shape.height)})
			</div>
		</div>
	);
}
