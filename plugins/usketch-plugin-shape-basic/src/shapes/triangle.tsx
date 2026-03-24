import { DEFAULT_STYLE, type Point, type ShapeData } from "@edv4h/usketch-shared";

export function getTrianglePoints(data: ShapeData): Point[] {
	const { x, y, width: w, height: h } = data;
	return [
		{ x: x + w / 2, y },
		{ x, y: y + h },
		{ x: x + w, y: y + h },
	];
}

export function renderTriangle(data: ShapeData) {
	const pts = getTrianglePoints(data);
	const points = pts.map((p) => `${p.x},${p.y}`).join(" ");
	return (
		<polygon
			points={points}
			fill={data.style.fill}
			stroke={data.style.stroke}
			strokeWidth={data.style.strokeWidth}
			opacity={data.style.opacity}
		/>
	);
}

export function createDefaultTriangle(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "triangle",
		x: params.x,
		y: params.y,
		width: 100,
		height: 90,
		style: { ...DEFAULT_STYLE },
	};
}
