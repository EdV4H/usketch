import { DEFAULT_STYLE, type ShapeData } from "@edv4h/usketch-shared";
import type { RectangleShapeData } from "../types.js";

export function renderRectangle(data: ShapeData) {
	const rect = data as RectangleShapeData;
	return (
		<rect
			x={data.x}
			y={data.y}
			width={data.width}
			height={data.height}
			rx={rect.cornerRadius ?? 0}
			fill={data.style.fill}
			stroke={data.style.stroke}
			strokeWidth={data.style.strokeWidth}
			opacity={data.style.opacity}
		/>
	);
}

export function createDefaultRectangle(params: {
	id: string;
	x: number;
	y: number;
}): RectangleShapeData {
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
