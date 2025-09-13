export interface AlignmentPoint {
	x: number;
	y: number;
	type: "top" | "center-vertical" | "bottom" | "left" | "center-horizontal" | "right";
	shapeId: string;
}

export interface AlignmentGuide {
	id: string;
	type: "vertical" | "horizontal";
	position: number;
	start: { x: number; y: number };
	end: { x: number; y: number };
	alignedShapes: string[];
}

export interface AlignmentOptions {
	snapEnabled: boolean;
	snapThreshold: number;
	strongSnapThreshold: number;
	isStrongSnap?: boolean;
	excludeShapeIds?: string[];
}

export interface AlignmentResult {
	snappedPosition: { x: number; y: number };
	guides: AlignmentGuide[];
	didSnap: boolean;
}

export interface AlignmentConfig {
	enabled: boolean;
	snapThreshold: number;
	showGuides: boolean;
	strongSnapModifier: "shift" | "ctrl" | "alt";
	disableModifier: "alt" | "ctrl" | "shift";
}
