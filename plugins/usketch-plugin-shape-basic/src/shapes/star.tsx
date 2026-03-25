import { DEFAULT_STYLE, type Point, type ShapeData } from "@edv4h/usketch-shared";

export function getStarPoints(data: ShapeData): Point[] {
	const { x, y, width: w, height: h } = data;
	const cx = x + w / 2;
	const cy = y + h / 2;
	const outerR = Math.min(w, h) / 2;
	const innerR = outerR * 0.38;
	const points: Point[] = [];
	for (let i = 0; i < 10; i++) {
		const angle = (Math.PI / 5) * i - Math.PI / 2;
		const r = i % 2 === 0 ? outerR : innerR;
		points.push({
			x: cx + r * Math.cos(angle),
			y: cy + r * Math.sin(angle),
		});
	}
	return points;
}

export function renderStar(data: ShapeData) {
	const pts = getStarPoints(data);
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

export function createDefaultStar(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "star",
		x: params.x,
		y: params.y,
		width: 100,
		height: 100,
		style: { ...DEFAULT_STYLE },
	};
}
