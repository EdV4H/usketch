import type { ShapeData } from "@edv4h/usketch-shared";
import { type ContextMapConnectorMeta, type ContextMapRelation, readMeta } from "../types.js";

const RELATION_LABEL: Record<ContextMapRelation, { short: string; full: string }> = {
	"customer-supplier": { short: "C/S", full: "Customer/Supplier" },
	conformist: { short: "CF", full: "Conformist" },
	"anticorruption-layer": { short: "ACL", full: "Anticorruption Layer" },
	"shared-kernel": { short: "SK", full: "Shared Kernel" },
	"open-host-service": { short: "OHS", full: "Open Host Service" },
	partnership: { short: "P", full: "Partnership" },
	"published-language": { short: "PL", full: "Published Language" },
	"separate-ways": { short: "SW", full: "Separate Ways" },
};

export function renderContextMapConnector(shape: ShapeData) {
	const meta = readMeta<ContextMapConnectorMeta>(shape);
	const relation = meta.relation ?? "customer-supplier";
	const label = RELATION_LABEL[relation];

	// shape.width / shape.height は AABB のため非負。
	// 始点 / 終点は meta.start / meta.end（AABB 相対座標）から読む。
	// 後方互換: meta が無い場合は対角線の左上 → 右下を使う。
	const start = meta.start ?? { x: 0, y: 0 };
	const end = meta.end ?? { x: shape.width, y: shape.height };
	const x1 = start.x;
	const y1 = start.y;
	const x2 = end.x;
	const y2 = end.y;
	const dashed = relation === "separate-ways" || relation === "anticorruption-layer";
	const upstreamLabel =
		meta.upstream === "from" ? "U → D" : meta.upstream === "to" ? "D ← U" : null;

	const midX = (x1 + x2) / 2;
	const midY = (y1 + y2) / 2;

	return (
		<svg
			width="100%"
			height="100%"
			viewBox={`0 0 ${Math.max(shape.width, 1)} ${Math.max(shape.height, 1)}`}
			preserveAspectRatio="none"
			style={{ overflow: "visible", opacity: shape.style.opacity }}
		>
			<title>
				{label.full}
				{upstreamLabel ? ` (${upstreamLabel})` : ""}
			</title>
			<line
				x1={x1}
				y1={y1}
				x2={x2}
				y2={y2}
				stroke={shape.style.stroke}
				strokeWidth={shape.style.strokeWidth}
				strokeDasharray={dashed ? "6 4" : undefined}
			/>
			<g transform={`translate(${midX}, ${midY})`}>
				<rect
					x={-22}
					y={-9}
					width={44}
					height={18}
					rx={3}
					fill="#ffffff"
					stroke={shape.style.stroke}
					strokeWidth={1}
				/>
				<text
					x={0}
					y={1}
					textAnchor="middle"
					dominantBaseline="middle"
					fontSize={11}
					fontWeight={600}
					fill="#1e1e1e"
				>
					{label.short}
				</text>
			</g>
		</svg>
	);
}
