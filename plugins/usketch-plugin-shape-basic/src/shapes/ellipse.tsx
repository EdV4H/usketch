import { DEFAULT_STYLE, type ShapeData } from "@edv4h/usketch-shared";

export function renderEllipse(data: ShapeData) {
	const cx = data.x + data.width / 2;
	const cy = data.y + data.height / 2;
	const rx = data.width / 2;
	const ry = data.height / 2;
	return (
		<ellipse
			cx={cx}
			cy={cy}
			rx={rx}
			ry={ry}
			fill={data.style.fill}
			stroke={data.style.stroke}
			strokeWidth={data.style.strokeWidth}
			opacity={data.style.opacity}
		/>
	);
}

export function createDefaultEllipse(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "ellipse",
		x: params.x,
		y: params.y,
		width: 100,
		height: 80,
		style: { ...DEFAULT_STYLE },
	};
}
