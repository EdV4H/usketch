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

	// `ShapeLayer` が外側 `<svg>` を `viewBox=${shape.x} ${shape.y} ${w} ${h}` の
	// world 座標で wrap するため、renderer は `<g>` を返して world 座標で描画する。
	// meta.start / meta.end は AABB 相対なので、shape.x / shape.y を加算する。
	const start = meta.start ?? { x: 0, y: 0 };
	const end = meta.end ?? { x: shape.width, y: shape.height };
	const x1 = shape.x + start.x;
	const y1 = shape.y + start.y;
	const x2 = shape.x + end.x;
	const y2 = shape.y + end.y;
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
		<g opacity={shape.style.opacity}>
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
		</g>
	);
}
