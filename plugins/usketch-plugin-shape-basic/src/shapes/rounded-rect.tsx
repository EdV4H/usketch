import { DEFAULT_STYLE, type ShapeData } from "@edv4h/usketch-shared";

export function renderRoundedRect(data: ShapeData) {
	const rx = Math.min(data.width, data.height) / 4;
	return (
		<rect
			x={data.x}
			y={data.y}
			width={data.width}
			height={data.height}
			rx={rx}
			fill={data.style.fill}
			stroke={data.style.stroke}
			strokeWidth={data.style.strokeWidth}
			opacity={data.style.opacity}
		/>
	);
}

export function createDefaultRoundedRect(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "rounded-rect",
		x: params.x,
		y: params.y,
		width: 100,
		height: 80,
		style: { ...DEFAULT_STYLE },
	};
}
