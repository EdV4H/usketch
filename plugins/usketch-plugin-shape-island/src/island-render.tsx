import type { BoundingBox, Point, ShapeData } from "@edv4h/usketch-shared";
import type { IslandShapeData } from "./types.js";

const MIN_W = 100;
const MIN_H = 100;

// ── CSS injection for animations ──

let styleInjected = false;
function injectStyle() {
	if (styleInjected) return;
	styleInjected = true;
	const style = document.createElement("style");
	style.textContent = `
		@keyframes usketch-island-merge-pulse {
			0% { box-shadow: 0 0 0 0 rgba(100, 200, 150, 0.6), 0 4px 16px rgba(0,0,0,0.1); }
			50% { box-shadow: 0 0 24px 12px rgba(100, 200, 150, 0.3), 0 4px 16px rgba(0,0,0,0.1); }
			100% { box-shadow: 0 0 16px 4px rgba(100, 200, 150, 0.15), 0 4px 16px rgba(0,0,0,0.1); }
		}
		@keyframes usketch-island-merge-ring {
			0% { transform: scale(0.8); opacity: 0.8; }
			100% { transform: scale(2); opacity: 0; }
		}
	`;
	document.head.appendChild(style);
}

export function renderIsland(shape: ShapeData) {
	injectStyle();

	const data = shape as IslandShapeData;
	const justMerged = data._islandJustMerged;

	// Island body is transparent — background is rendered by the metaball layer.
	// This div serves as the container for child shapes and hit-test target.
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				borderRadius: 24,
				background: "transparent",
				boxSizing: "border-box",
				position: "relative",
				pointerEvents: "none",
				overflow: "visible",
				animation: justMerged ? "usketch-island-merge-pulse 600ms ease-out" : undefined,
			}}
		/>
	);
}

export function getBoundsIsland(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

export function hitTestIsland(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

export function resizeIsland(data: ShapeData, handle: string, delta: Point): ShapeData {
	const result = { ...data };

	if (handle.includes("e")) {
		result.width = Math.max(MIN_W, data.width + delta.x);
	}
	if (handle.includes("w")) {
		const newWidth = Math.max(MIN_W, data.width - delta.x);
		result.x = data.x + data.width - newWidth;
		result.width = newWidth;
	}
	if (handle.includes("s")) {
		result.height = Math.max(MIN_H, data.height + delta.y);
	}
	if (handle.includes("n")) {
		const newHeight = Math.max(MIN_H, data.height - delta.y);
		result.y = data.y + data.height - newHeight;
		result.height = newHeight;
	}

	return result;
}

export function createDefaultIsland(params: { id: string; x: number; y: number }): IslandShapeData {
	return {
		id: params.id,
		type: "island",
		x: params.x,
		y: params.y,
		width: 400,
		height: 300,
		style: { fill: "#a8d5ba", stroke: "#8bc4a0", strokeWidth: 2, opacity: 1 },
		islandTitle: "Island",
		islandColor: "#a8d5ba",
	};
}
