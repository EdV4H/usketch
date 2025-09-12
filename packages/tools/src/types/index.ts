// === Common Types for XState Tool System ===

export interface Point {
	x: number;
	y: number;
}

export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Shape {
	id: string;
	type: "rectangle" | "ellipse" | "path" | "text" | "arrow" | "freedraw";
	x: number;
	y: number;
	width: number;
	height: number;
	rotation?: number;
	opacity?: number;
	strokeColor?: string;
	fillColor?: string;
	strokeWidth?: number;
	points?: Point[]; // For freedraw, points are relative to (x, y)
	style?: ShapeStyle;
}

export interface ShapeStyle {
	color: string;
	width: number;
	opacity: number;
	fill?: string;
}

// === Tool Context Base Type ===
export interface ToolContext {
	cursor: string;
	selectedIds: Set<string>;
	hoveredId: string | null;
}

// === Tool Event Base Type ===
export interface ToolEvent {
	type: string;
	point?: Point;
	shiftKey?: boolean;
	ctrlKey?: boolean;
	altKey?: boolean;
	metaKey?: boolean;
}
