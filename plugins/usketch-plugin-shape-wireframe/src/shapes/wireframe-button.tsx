import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";
import type { WireframeButtonShapeData } from "../types.js";

export function renderButton(shape: ShapeData) {
	const data = shape as WireframeButtonShapeData;
	const label = data.label || "Button";
	const variant = data.variant || "primary";

	const variantStyles: Record<string, { bg: string; color: string; border: string }> = {
		primary: { bg: WF.colors.primary, color: WF.colors.primaryText, border: WF.colors.primary },
		secondary: {
			bg: WF.colors.secondary,
			color: WF.colors.secondaryText,
			border: WF.colors.secondary,
		},
		outline: { bg: "transparent", color: WF.colors.text, border: WF.colors.border },
	};
	const s = variantStyles[variant] || variantStyles.primary;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: s.bg,
				color: s.color,
				border: `1.5px solid ${s.border}`,
				borderRadius: WF.radius,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: WF.font,
				fontSize: WF.fontSize.base,
				fontWeight: 500,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			{label}
		</div>
	);
}

export function createDefaultButton(params: {
	id: string;
	x: number;
	y: number;
}): WireframeButtonShapeData {
	return {
		id: params.id,
		type: "wireframe-button",
		x: params.x,
		y: params.y,
		width: 120,
		height: 40,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		label: "Button",
		variant: "primary",
	};
}
