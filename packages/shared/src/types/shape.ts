export interface ShapeStyle {
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
}

export interface ShapeData {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	style: ShapeStyle;
	rotation?: number;
	[key: string]: unknown;
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const DEFAULT_STYLE: ShapeStyle = {
	fill: "#ffffff",
	stroke: "#1e1e1e",
	strokeWidth: 2,
	opacity: 1,
};
