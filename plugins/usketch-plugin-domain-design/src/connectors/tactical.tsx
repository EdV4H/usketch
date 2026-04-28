import type { ShapeData } from "@edv4h/usketch-shared";
import { readMeta, type TacticalConnectorMeta, type TacticalRelation } from "../types.js";

interface RelationStyle {
	dashed: boolean;
	headFill: string;
	headShape: "triangle" | "diamond" | "open" | "none";
}

const RELATION_STYLE: Record<TacticalRelation, RelationStyle> = {
	inheritance: { dashed: false, headFill: "#ffffff", headShape: "triangle" },
	realization: { dashed: true, headFill: "#ffffff", headShape: "triangle" },
	composition: { dashed: false, headFill: "#1e1e1e", headShape: "diamond" },
	aggregation: { dashed: false, headFill: "#ffffff", headShape: "diamond" },
	association: { dashed: false, headFill: "#1e1e1e", headShape: "open" },
	dependency: { dashed: true, headFill: "#1e1e1e", headShape: "open" },
};

export function renderTacticalConnector(shape: ShapeData) {
	const meta = readMeta<TacticalConnectorMeta>(shape);
	const relation: TacticalRelation = meta.relation ?? "association";
	const styleSpec = RELATION_STYLE[relation];

	const x1 = 0;
	const y1 = 0;
	const x2 = shape.width;
	const y2 = shape.height;
	const stroke = shape.style.stroke;
	const sw = shape.style.strokeWidth;

	// 矢頭サイズは長さに対して相対化（極端な短い線でも描画可能）
	const length = Math.hypot(x2 - x1, y2 - y1) || 1;
	const headSize = Math.min(14, Math.max(8, length * 0.12));
	const angle = Math.atan2(y2 - y1, x2 - x1);
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	const lineEndX = x2 - cos * headSize * 0.6;
	const lineEndY = y2 - sin * headSize * 0.6;

	function head() {
		switch (styleSpec.headShape) {
			case "triangle": {
				// 二等辺三角形（先端が tip、底辺が base）
				const baseX = x2 - cos * headSize;
				const baseY = y2 - sin * headSize;
				const halfBase = headSize * 0.5;
				const px = -sin * halfBase;
				const py = cos * halfBase;
				return (
					<polygon
						points={`${x2},${y2} ${baseX + px},${baseY + py} ${baseX - px},${baseY - py}`}
						fill={styleSpec.headFill}
						stroke={stroke}
						strokeWidth={sw}
					/>
				);
			}
			case "diamond": {
				const tipX = x2;
				const tipY = y2;
				const midX = x2 - cos * headSize;
				const midY = y2 - sin * headSize;
				const baseX = x2 - cos * headSize * 2;
				const baseY = y2 - sin * headSize * 2;
				const halfWidth = headSize * 0.4;
				const px = -sin * halfWidth;
				const py = cos * halfWidth;
				return (
					<polygon
						points={`${tipX},${tipY} ${midX + px},${midY + py} ${baseX},${baseY} ${midX - px},${midY - py}`}
						fill={styleSpec.headFill}
						stroke={stroke}
						strokeWidth={sw}
					/>
				);
			}
			case "open": {
				const baseX = x2 - cos * headSize;
				const baseY = y2 - sin * headSize;
				const halfBase = headSize * 0.5;
				const px = -sin * halfBase;
				const py = cos * halfBase;
				return (
					<polyline
						points={`${baseX + px},${baseY + py} ${x2},${y2} ${baseX - px},${baseY - py}`}
						fill="none"
						stroke={stroke}
						strokeWidth={sw}
					/>
				);
			}
			default:
				return null;
		}
	}

	const labelText = meta.label ?? "";
	const fromLabel = meta.multiplicityFrom ?? "";
	const toLabel = meta.multiplicityTo ?? "";

	return (
		<svg
			width="100%"
			height="100%"
			viewBox={`0 0 ${Math.max(shape.width, 1)} ${Math.max(shape.height, 1)}`}
			preserveAspectRatio="none"
			style={{ overflow: "visible", opacity: shape.style.opacity }}
		>
			<title>{`${relation}${labelText ? `: ${labelText}` : ""}`}</title>
			<line
				x1={x1}
				y1={y1}
				x2={lineEndX}
				y2={lineEndY}
				stroke={stroke}
				strokeWidth={sw}
				strokeDasharray={styleSpec.dashed ? "5 4" : undefined}
			/>
			{head()}
			{labelText && (
				<text
					x={(x1 + x2) / 2}
					y={(y1 + y2) / 2 - 4}
					textAnchor="middle"
					fontSize={11}
					fill="#1e1e1e"
				>
					{labelText}
				</text>
			)}
			{fromLabel && (
				<text x={x1 + cos * 12 - sin * 8} y={y1 + sin * 12 + cos * 8} fontSize={10} fill="#475569">
					{fromLabel}
				</text>
			)}
			{toLabel && (
				<text
					x={x2 - cos * 12 - sin * 8}
					y={y2 - sin * 12 + cos * 8}
					fontSize={10}
					fill="#475569"
					textAnchor="end"
				>
					{toLabel}
				</text>
			)}
		</svg>
	);
}
