import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";
import type { WireframeToastShapeData } from "../types.js";

export function renderToast(shape: ShapeData) {
	const data = shape as WireframeToastShapeData;
	const toastMessage = data.toastMessage || "Notification";
	const toastType = data.toastType || "success";

	const typeIcons: Record<string, string> = {
		success: "\u2713",
		error: "\u2717",
		warning: "!",
		info: "i",
	};
	const typeColors: Record<string, string> = {
		success: "#22c55e",
		error: "#ef4444",
		warning: "#f59e0b",
		info: WF.colors.primary,
	};
	const icon = typeIcons[toastType] || typeIcons.success;
	const iconColor = typeColors[toastType] || typeColors.success;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: WF.colors.bg,
				border: `1.5px solid ${WF.colors.border}`,
				borderRadius: WF.radius,
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "0 16px",
				fontFamily: WF.font,
				boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					width: 24,
					height: 24,
					borderRadius: "50%",
					background: iconColor,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: WF.fontSize.sm,
					fontWeight: 700,
					color: "#fff",
					flexShrink: 0,
				}}
			>
				{icon}
			</div>
			<div
				style={{
					fontSize: WF.fontSize.base,
					color: WF.colors.text,
					flex: 1,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{toastMessage}
			</div>
		</div>
	);
}

export function createDefaultToast(params: {
	id: string;
	x: number;
	y: number;
}): WireframeToastShapeData {
	return {
		id: params.id,
		type: "wireframe-toast",
		x: params.x,
		y: params.y,
		width: 300,
		height: 48,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		toastMessage: "Notification",
		toastType: "success",
	};
}
