import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";
import type { WireframeSelectShapeData } from "../types.js";

export function renderSelect(shape: ShapeData) {
	const data = shape as WireframeSelectShapeData;
	const placeholder = data.placeholder || "Select...";

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
				justifyContent: "space-between",
				padding: "0 10px",
				fontFamily: WF.font,
				fontSize: WF.fontSize.base,
				color: WF.colors.placeholder,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			<span>{placeholder}</span>
			<svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
				<path
					d="M3 5l3 3 3-3"
					fill="none"
					stroke={WF.colors.secondary}
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</div>
	);
}

export function createDefaultSelect(params: {
	id: string;
	x: number;
	y: number;
}): WireframeSelectShapeData {
	return {
		id: params.id,
		type: "wireframe-select",
		x: params.x,
		y: params.y,
		width: 240,
		height: 40,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		placeholder: "Select...",
		options: ["Option 1", "Option 2", "Option 3"],
	};
}
