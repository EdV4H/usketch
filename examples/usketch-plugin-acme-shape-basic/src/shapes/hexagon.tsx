import { DEFAULT_STYLE, type Point, type ShapeData } from "@edv4h/usketch-shared";

export function getHexagonPoints(data: ShapeData): Point[] {
	const { x, y, width, height } = data;
	const cx = x + width / 2;
	const cy = y + height / 2;
	const rx = width / 2;
	const ry = height / 2;
	return Array.from({ length: 6 }, (_, i) => {
		const angle = (Math.PI / 3) * i - Math.PI / 2;
		return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
	});
}

export function renderHexagon(data: ShapeData) {
	const points = getHexagonPoints(data)
		.map((p) => `${p.x},${p.y}`)
		.join(" ");
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

export function createDefaultHexagon(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "acme-hexagon",
		x: params.x,
		y: params.y,
		width: 120,
		height: 104,
		style: { ...DEFAULT_STYLE },
	};
}
