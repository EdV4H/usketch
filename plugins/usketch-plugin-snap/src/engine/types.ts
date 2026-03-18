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
	/** Which edge of the moving box matched on the X axis (null if no x snap) */
	xEdge: SnapEdge | null;
	/** Which edge of the moving box matched on the Y axis (null if no y snap) */
	yEdge: SnapEdge | null;
	lines: SnapLine[];
}

export interface GuideStyle {
	color: string;
	dash: string;
	strokeWidth: number;
	indicatorRadius: number;
	diamondSize: number;
}

export interface SnapSettings {
	enabled: boolean;
	threshold: number;
	edgeSnap: boolean;
	centerSnap: boolean;
	viewportOnly: boolean;
	guideStyle: GuideStyle;
}
