import { DEFAULT_STYLE, type Point, type ShapeData } from "@edv4h/usketch-shared";

export function getArrowPoints(data: ShapeData): Point[] {
	const { x, y, width: w, height: h } = data;
	const shaftWidth = w * 0.6;
	const shaftTop = y + h * 0.3;
	const shaftBottom = y + h * 0.7;
	return [
		{ x, y: shaftTop },
		{ x: x + shaftWidth, y: shaftTop },
		{ x: x + shaftWidth, y },
		{ x: x + w, y: y + h / 2 },
		{ x: x + shaftWidth, y: y + h },
		{ x: x + shaftWidth, y: shaftBottom },
		{ x, y: shaftBottom },
	];
}

export function renderArrow(data: ShapeData) {
	const pts = getArrowPoints(data);
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

export function createDefaultArrow(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "arrow",
		x: params.x,
		y: params.y,
		width: 120,
		height: 60,
		style: { ...DEFAULT_STYLE },
	};
}
