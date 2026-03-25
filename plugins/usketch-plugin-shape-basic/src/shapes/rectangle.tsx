import { DEFAULT_STYLE, type ShapeData } from "@edv4h/usketch-shared";

export function renderRectangle(data: ShapeData) {
	return (
		<rect
			x={data.x}
			y={data.y}
			width={data.width}
			height={data.height}
			rx={(data.cornerRadius as number) ?? 0}
			fill={data.style.fill}
			stroke={data.style.stroke}
			strokeWidth={data.style.strokeWidth}
			opacity={data.style.opacity}
		/>
	);
}

export function createDefaultRectangle(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "rectangle",
		x: params.x,
		y: params.y,
		width: 100,
		height: 80,
		style: { ...DEFAULT_STYLE },
		cornerRadius: 0,
	};
}
