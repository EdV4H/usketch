import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";
import type { WireframeContainerShapeData } from "../types.js";

export function renderContainer(shape: ShapeData) {
	const data = shape as WireframeContainerShapeData;
	const containerTitle = data.containerTitle || "Container";
	const borderStyle = data.borderStyle || "solid";

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: WF.colors.surface,
				border: `1.5px ${borderStyle} ${WF.colors.border}`,
				borderRadius: WF.radius * 2,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				fontFamily: WF.font,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					padding: "8px 12px",
					fontSize: WF.fontSize.sm,
					fontWeight: 600,
					color: WF.colors.secondary,
					textTransform: "uppercase",
					letterSpacing: "0.05em",
				}}
			>
				{containerTitle}
			</div>
			<div style={{ flex: 1 }} />
		</div>
	);
}

export function createDefaultContainer(params: {
	id: string;
	x: number;
	y: number;
}): WireframeContainerShapeData {
	return {
		id: params.id,
		type: "wireframe-container",
		x: params.x,
		y: params.y,
		width: 400,
		height: 300,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		containerTitle: "Container",
		borderStyle: "solid",
	};
}
