import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";
import type { WireframeAlertShapeData } from "../types.js";

export function renderAlert(shape: ShapeData) {
	const data = shape as WireframeAlertShapeData;
	const alertMessage = data.alertMessage || "Alert message";
	const alertType = data.alertType || "info";

	const typeColors: Record<string, string> = {
		info: WF.colors.primary,
		success: "#22c55e",
		warning: "#f59e0b",
		error: "#ef4444",
	};
	const borderColor = typeColors[alertType] || typeColors.info;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: WF.colors.surface,
				borderLeft: `4px solid ${borderColor}`,
				borderRadius: WF.radius,
				display: "flex",
				alignItems: "center",
				padding: "0 16px",
				fontFamily: WF.font,
				fontSize: WF.fontSize.base,
				color: WF.colors.text,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			{alertMessage}
		</div>
	);
}

export function createDefaultAlert(params: {
	id: string;
	x: number;
	y: number;
}): WireframeAlertShapeData {
	return {
		id: params.id,
		type: "wireframe-alert",
		x: params.x,
		y: params.y,
		width: 320,
		height: 48,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		alertMessage: "Alert message",
		alertType: "info",
	};
}
