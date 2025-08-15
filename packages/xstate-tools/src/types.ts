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
	type: "rectangle" | "ellipse" | "path" | "text" | "arrow";
	x: number;
	y: number;
	width?: number;
	height?: number;
	points?: Point[];
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
