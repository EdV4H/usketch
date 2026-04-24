import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";
import type { WireframeBadgeShapeData } from "../types.js";

export function renderBadge(shape: ShapeData) {
	const data = shape as WireframeBadgeShapeData;
	const badgeLabel = data.badgeLabel || "Badge";
	const badgeVariant = data.badgeVariant || "default";

	const variantStyles: Record<string, { bg: string; color: string }> = {
		default: { bg: WF.colors.surface, color: WF.colors.text },
		primary: { bg: WF.colors.primary, color: WF.colors.primaryText },
		secondary: { bg: WF.colors.secondary, color: WF.colors.secondaryText },
	};
	const style = variantStyles[badgeVariant] || variantStyles.default;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: style.bg,
				border: badgeVariant === "default" ? `1px solid ${WF.colors.border}` : "none",
				borderRadius: WF.radius * 2,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: WF.font,
				fontSize: WF.fontSize.sm,
				fontWeight: 500,
				color: style.color,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			{badgeLabel}
		</div>
	);
}

export function createDefaultBadge(params: {
	id: string;
	x: number;
	y: number;
}): WireframeBadgeShapeData {
	return {
		id: params.id,
		type: "wireframe-badge",
		x: params.x,
		y: params.y,
		width: 64,
		height: 24,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		badgeLabel: "Badge",
		badgeVariant: "default",
	};
}
