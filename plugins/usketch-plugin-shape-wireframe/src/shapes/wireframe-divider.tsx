import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";

export function renderDivider(data: ShapeData) {
	const dividerStyle = (data.dividerStyle as string) || "solid";

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					width: "100%",
					borderTop: `1.5px ${dividerStyle} ${WF.colors.border}`,
				}}
			/>
		</div>
	);
}

export function createDefaultDivider(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "wireframe-divider",
		x: params.x,
		y: params.y,
		width: 300,
		height: 16,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		dividerStyle: "solid",
	};
}
