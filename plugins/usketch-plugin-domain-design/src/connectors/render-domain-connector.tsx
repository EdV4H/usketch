import {
	getDefaultControlPoint,
	getElbowPoints,
	getPathMidpoint,
} from "@edv4h/usketch-connector-anchor";
import type { Point, ShapeData } from "@edv4h/usketch-shared";
import {
	type ContextMapRelation,
	type DomainConnectorMeta,
	readMeta,
	type TacticalRelation,
} from "../types.js";

// ── ContextMap relation styling ──

const CONTEXT_MAP_LABEL: Record<ContextMapRelation, { short: string; full: string }> = {
	"customer-supplier": { short: "C/S", full: "Customer/Supplier" },
	conformist: { short: "CF", full: "Conformist" },
	"anticorruption-layer": { short: "ACL", full: "Anticorruption Layer" },
	"shared-kernel": { short: "SK", full: "Shared Kernel" },
	"open-host-service": { short: "OHS", full: "Open Host Service" },
	partnership: { short: "P", full: "Partnership" },
	"published-language": { short: "PL", full: "Published Language" },
	"separate-ways": { short: "SW", full: "Separate Ways" },
};

const CONTEXT_MAP_DASHED: ReadonlySet<ContextMapRelation> = new Set([
	"separate-ways",
	"anticorruption-layer",
]);

// ── Tactical relation styling ──

interface TacticalStyle {
	dashed: boolean;
	headFill: string;
	headShape: "triangle" | "diamond" | "open" | "none";
}

const TACTICAL_STYLE: Record<TacticalRelation, TacticalStyle> = {
	inheritance: { dashed: false, headFill: "#ffffff", headShape: "triangle" },
	realization: { dashed: true, headFill: "#ffffff", headShape: "triangle" },
	composition: { dashed: false, headFill: "#1e1e1e", headShape: "diamond" },
	aggregation: { dashed: false, headFill: "#ffffff", headShape: "diamond" },
	association: { dashed: false, headFill: "#1e1e1e", headShape: "open" },
	dependency: { dashed: true, headFill: "#1e1e1e", headShape: "open" },
};

// ── Renderer ──

export function renderDomainConnector(shape: ShapeData) {
	const meta = readMeta<DomainConnectorMeta>(shape);
	if (!meta.domainKind) return <g />;

	const sourcePoint = (shape as ShapeData & { sourcePoint?: Point }).sourcePoint ?? {
		x: shape.x,
		y: shape.y,
	};
	const targetPoint = (shape as ShapeData & { targetPoint?: Point }).targetPoint ?? {
		x: shape.x + shape.width,
		y: shape.y + shape.height,
	};
	const controlPoint = (shape as ShapeData & { controlPoint?: Point }).controlPoint;
	const pathType =
		((shape as ShapeData & { pathType?: "straight" | "elbow" | "curve" }).pathType ?? "straight") ||
		"straight";
	const stroke = shape.style.stroke;
	const sw = shape.style.strokeWidth;
	const opacity = shape.style.opacity;

	const args: RenderArgs = {
		shape,
		meta,
		sourcePoint,
		targetPoint,
		controlPoint,
		pathType,
		stroke,
		strokeWidth: sw,
		opacity,
	};

	if (meta.domainKind === "context-map") {
		return renderContextMapConnector(args);
	}
	return renderTacticalConnector(args);
}

interface RenderArgs {
	shape: ShapeData;
	meta: Partial<DomainConnectorMeta>;
	sourcePoint: Point;
	targetPoint: Point;
	controlPoint: Point | undefined;
	pathType: "straight" | "elbow" | "curve";
	stroke: string;
	strokeWidth: number;
	opacity: number;
}

function renderContextMapConnector(args: RenderArgs) {
	const meta = args.meta as { relation?: ContextMapRelation; upstream?: "from" | "to" };
	const relation: ContextMapRelation = meta.relation ?? "customer-supplier";
	const label = CONTEXT_MAP_LABEL[relation];
	const dashed = CONTEXT_MAP_DASHED.has(relation);
	const upstreamLabel =
		meta.upstream === "from" ? "U → D" : meta.upstream === "to" ? "D ← U" : null;

	// Use the actual on-path midpoint so the badge stays on the line/curve/elbow
	// regardless of pathType (arithmetic midpoint drifts off curves).
	const mid = getPathMidpoint(args.pathType, args.sourcePoint, args.targetPoint, args.controlPoint);

	return (
		<g opacity={args.opacity}>
			<title>
				{label.full}
				{upstreamLabel ? ` (${upstreamLabel})` : ""}
			</title>
			{renderPath(args, dashed)}
			<g transform={`translate(${mid.x}, ${mid.y})`}>
				<rect
					x={-22}
					y={-9}
					width={44}
					height={18}
					rx={3}
					fill="#ffffff"
					stroke={args.stroke}
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

function renderTacticalConnector(args: RenderArgs) {
	const meta = args.meta as {
		relation?: TacticalRelation;
		multiplicityFrom?: string;
		multiplicityTo?: string;
		label?: string;
	};
	const relation: TacticalRelation = meta.relation ?? "association";
	const styleSpec = TACTICAL_STYLE[relation];
	const stroke = args.stroke;
	const sw = args.strokeWidth;

	const x1 = args.sourcePoint.x;
	const y1 = args.sourcePoint.y;
	const x2 = args.targetPoint.x;
	const y2 = args.targetPoint.y;

	const length = Math.hypot(x2 - x1, y2 - y1) || 1;
	const headSize = Math.min(14, Math.max(8, length * 0.12));
	const angle = Math.atan2(y2 - y1, x2 - x1);
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	const head = renderTacticalArrowHead(styleSpec, x2, y2, cos, sin, headSize, stroke, sw);

	const labelText = meta.label ?? "";
	const fromLabel = meta.multiplicityFrom ?? "";
	const toLabel = meta.multiplicityTo ?? "";

	return (
		<g opacity={args.opacity}>
			<title>{`${relation}${labelText ? `: ${labelText}` : ""}`}</title>
			{renderPath(
				{
					...args,
					// Tactical arrow head occupies a small slice at the target end; pull
					// the line back by 60% of the head size so the line and head don't overlap.
					targetPoint: { x: x2 - cos * headSize * 0.6, y: y2 - sin * headSize * 0.6 },
				},
				styleSpec.dashed,
			)}
			{head}
			{labelText &&
				(() => {
					// Use on-path midpoint so the label sits on the actual rendered
					// path (curve/elbow/straight), not at the arithmetic midpoint.
					const mid = getPathMidpoint(
						args.pathType,
						args.sourcePoint,
						args.targetPoint,
						args.controlPoint,
					);
					return (
						<text x={mid.x} y={mid.y - 4} textAnchor="middle" fontSize={11} fill="#1e1e1e">
							{labelText}
						</text>
					);
				})()}
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

function renderPath(args: RenderArgs, dashed: boolean) {
	const dashArray = dashed ? "6 4" : undefined;
	if (args.pathType === "curve") {
		// Rebuild from current sourcePoint/targetPoint instead of trusting the
		// caller-passed `pathD`: tactical connectors shorten targetPoint to make
		// room for the arrow head, and we want the curve to follow that.
		const cp =
			(args.shape as ShapeData & { controlPoint?: Point }).controlPoint ??
			getDefaultControlPoint(args.sourcePoint, args.targetPoint);
		const d = `M ${args.sourcePoint.x},${args.sourcePoint.y} Q ${cp.x},${cp.y} ${args.targetPoint.x},${args.targetPoint.y}`;
		return (
			<path
				d={d}
				fill="none"
				stroke={args.stroke}
				strokeWidth={args.strokeWidth}
				strokeDasharray={dashArray}
			/>
		);
	}
	if (args.pathType === "elbow") {
		const points = getElbowPoints(args.sourcePoint, args.targetPoint)
			.map((p) => `${p.x},${p.y}`)
			.join(" ");
		return (
			<polyline
				points={points}
				fill="none"
				stroke={args.stroke}
				strokeWidth={args.strokeWidth}
				strokeDasharray={dashArray}
			/>
		);
	}
	return (
		<line
			x1={args.sourcePoint.x}
			y1={args.sourcePoint.y}
			x2={args.targetPoint.x}
			y2={args.targetPoint.y}
			stroke={args.stroke}
			strokeWidth={args.strokeWidth}
			strokeDasharray={dashArray}
		/>
	);
}

function renderTacticalArrowHead(
	style: TacticalStyle,
	tipX: number,
	tipY: number,
	cos: number,
	sin: number,
	headSize: number,
	stroke: string,
	sw: number,
) {
	switch (style.headShape) {
		case "triangle": {
			const baseX = tipX - cos * headSize;
			const baseY = tipY - sin * headSize;
			const halfBase = headSize * 0.5;
			const px = -sin * halfBase;
			const py = cos * halfBase;
			return (
				<polygon
					points={`${tipX},${tipY} ${baseX + px},${baseY + py} ${baseX - px},${baseY - py}`}
					fill={style.headFill}
					stroke={stroke}
					strokeWidth={sw}
				/>
			);
		}
		case "diamond": {
			const midX = tipX - cos * headSize;
			const midY = tipY - sin * headSize;
			const baseX = tipX - cos * headSize * 2;
			const baseY = tipY - sin * headSize * 2;
			const halfWidth = headSize * 0.4;
			const px = -sin * halfWidth;
			const py = cos * halfWidth;
			return (
				<polygon
					points={`${tipX},${tipY} ${midX + px},${midY + py} ${baseX},${baseY} ${midX - px},${midY - py}`}
					fill={style.headFill}
					stroke={stroke}
					strokeWidth={sw}
				/>
			);
		}
		case "open": {
			const baseX = tipX - cos * headSize;
			const baseY = tipY - sin * headSize;
			const halfBase = headSize * 0.5;
			const px = -sin * halfBase;
			const py = cos * halfBase;
			return (
				<polyline
					points={`${baseX + px},${baseY + py} ${tipX},${tipY} ${baseX - px},${baseY - py}`}
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
