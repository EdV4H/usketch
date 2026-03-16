export type SnapEdge = "min" | "center" | "max";

export interface SnapPoint {
	value: number;
	sourceShapeId: string;
	edge: SnapEdge;
}

export interface SnapIndicator {
	x: number;
	y: number;
	edge: SnapEdge;
}

export interface SnapLine {
	axis: "x" | "y";
	position: number;
	from: number;
	to: number;
	movingEdge: SnapEdge;
	candidateEdge: SnapEdge;
	indicators: SnapIndicator[];
}

export interface SnapResult {
	dx: number;
	dy: number;
	lines: SnapLine[];
}

export interface SnapSettings {
	enabled: boolean;
	threshold: number;
	edgeSnap: boolean;
	centerSnap: boolean;
	viewportOnly: boolean;
}
