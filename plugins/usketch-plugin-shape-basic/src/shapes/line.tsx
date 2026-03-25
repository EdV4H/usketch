import { DEFAULT_STYLE, type ShapeData } from "@edv4h/usketch-shared";

export function renderLine(data: ShapeData) {
	return (
		<line
			x1={data.x}
			y1={data.y}
			x2={data.x + data.width}
			y2={data.y + data.height}
			stroke={data.style.stroke}
			strokeWidth={data.style.strokeWidth}
			opacity={data.style.opacity}
			strokeLinecap="round"
		/>
	);
}

export function createDefaultLine(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "line",
		x: params.x,
		y: params.y,
		width: 100,
		height: 4,
		style: { ...DEFAULT_STYLE, fill: "transparent" },
	};
}
