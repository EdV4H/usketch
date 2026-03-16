export type SnapEdge = "min" | "center" | "max";

export interface SnapPoint {
	value: number;
	sourceShapeId: string;
	edge: SnapEdge;
}

export interface SnapLine {
	axis: "x" | "y";
	position: number;
	from: number;
	to: number;
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
}
