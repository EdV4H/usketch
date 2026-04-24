import type { BoundingBox, Point, ShapeData } from "@edv4h/usketch-shared";
import type { FrameShapeData } from "../types.js";

const TITLE_HEIGHT = 24;

export function renderFrame(shape: ShapeData) {
	const data = shape as FrameShapeData;
	const title = data.frameTitle ?? "Frame";
	const bgColor = data.style.fill === "transparent" ? "#f8f8f8" : data.style.fill;

	// Position/size is handled by ShapeWrapper (position: absolute; left/top/width/height).
	// Render content at (0,0) within the wrapper — no position styling needed.
	return (
		<>
			{/* Title bar — positioned above the frame via negative margin */}
			<div
				style={{
					marginTop: -TITLE_HEIGHT,
					height: TITLE_HEIGHT,
					display: "flex",
					alignItems: "center",
					paddingLeft: 6,
					fontSize: 12,
					fontFamily: "system-ui, sans-serif",
					color: "#666",
					userSelect: "none",
					whiteSpace: "nowrap",
					overflow: "hidden",
					pointerEvents: "none",
				}}
			>
				{title}
			</div>
			{/* Frame body */}
			<div
				style={{
					width: "100%",
					height: "100%",
					backgroundColor: bgColor,
					opacity: data.style.opacity,
					border: `${data.style.strokeWidth}px solid ${data.style.stroke}`,
					borderRadius: 4,
					boxSizing: "border-box",
					pointerEvents: "none",
				}}
			/>
		</>
	);
}

export function getBoundsFrame(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

export function hitTestFrame(data: ShapeData, point: Point): boolean {
	// Frame body
	if (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	) {
		return true;
	}
	// Title label above the frame
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y - TITLE_HEIGHT &&
		point.y < data.y
	);
}

export function resizeFrame(data: ShapeData, handle: string, delta: Point): ShapeData {
	const result = { ...data };
	const minW = 50;
	const minH = 50;

	if (handle.includes("e")) {
		result.width = Math.max(minW, data.width + delta.x);
	}
	if (handle.includes("w")) {
		const newWidth = Math.max(minW, data.width - delta.x);
		result.x = data.x + data.width - newWidth;
		result.width = newWidth;
	}
	if (handle.includes("s")) {
		result.height = Math.max(minH, data.height + delta.y);
	}
	if (handle.includes("n")) {
		const newHeight = Math.max(minH, data.height - delta.y);
		result.y = data.y + data.height - newHeight;
		result.height = newHeight;
	}

	return result;
}

export function createDefaultFrame(params: { id: string; x: number; y: number }): FrameShapeData {
	return {
		id: params.id,
		type: "frame",
		x: params.x,
		y: params.y,
		width: 300,
		height: 200,
		style: { fill: "#f8f8f8", stroke: "#cccccc", strokeWidth: 1, opacity: 1 },
		frameTitle: "Frame",
	};
}
