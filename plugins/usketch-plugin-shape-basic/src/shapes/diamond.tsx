import { DEFAULT_STYLE, type Point, type ShapeData } from "@edv4h/usketch-shared";

export function getDiamondPoints(data: ShapeData): Point[] {
	const { x, y, width: w, height: h } = data;
	return [
		{ x: x + w / 2, y },
		{ x: x + w, y: y + h / 2 },
		{ x: x + w / 2, y: y + h },
		{ x, y: y + h / 2 },
	];
}

export function renderDiamond(data: ShapeData) {
	const pts = getDiamondPoints(data);
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

export function createDefaultDiamond(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "diamond",
		x: params.x,
		y: params.y,
		width: 100,
		height: 100,
		style: { ...DEFAULT_STYLE },
	};
}
