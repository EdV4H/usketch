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

	// `ShapeLayer` が外側 `<svg>` を `viewBox=${shape.x} ${shape.y} ${w} ${h}` の
	// world 座標で wrap するため、renderer は `<g>` を返して world 座標で描画する。
	// meta.start / meta.end は AABB 相対なので、shape.x / shape.y を加算する。
	const start = meta.start ?? { x: 0, y: 0 };
	const end = meta.end ?? { x: shape.width, y: shape.height };
	const x1 = shape.x + start.x;
	const y1 = shape.y + start.y;
	const x2 = shape.x + end.x;
	const y2 = shape.y + end.y;
	const dashed = relation === "separate-ways" || relation === "anticorruption-layer";
	const upstreamLabel =
		meta.upstream === "from" ? "U → D" : meta.upstream === "to" ? "D ← U" : null;

	const midX = (x1 + x2) / 2;
	const midY = (y1 + y2) / 2;

	return (
		<g opacity={shape.style.opacity}>
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
		</g>
	);
}
