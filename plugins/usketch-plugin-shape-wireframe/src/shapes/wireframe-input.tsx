import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";
import type { WireframeInputShapeData } from "../types.js";

export function renderInput(shape: ShapeData) {
	const data = shape as WireframeInputShapeData;
	const placeholder = data.placeholder || "Enter text...";
	const inputLabel = data.inputLabel || "";
	const inputType = data.inputType || "text";

	const isPassword = inputType === "password";
	const displayText = isPassword ? "••••••••" : placeholder;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				gap: 4,
				fontFamily: WF.font,
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			{inputLabel && (
				<div
					style={{
						fontSize: WF.fontSize.sm,
						fontWeight: 500,
						color: WF.colors.text,
						lineHeight: 1,
					}}
				>
					{inputLabel}
				</div>
			)}
			<div
				style={{
					flex: 1,
					minHeight: 32,
					background: WF.colors.bg,
					border: `1.5px solid ${WF.colors.border}`,
					borderRadius: WF.radius,
					display: "flex",
					alignItems: "center",
					padding: "0 10px",
					fontSize: WF.fontSize.base,
					color: WF.colors.placeholder,
					boxSizing: "border-box",
				}}
			>
				{displayText}
			</div>
		</div>
	);
}

export function createDefaultInput(params: {
	id: string;
	x: number;
	y: number;
}): WireframeInputShapeData {
	return {
		id: params.id,
		type: "wireframe-input",
		x: params.x,
		y: params.y,
		width: 240,
		height: 56,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		placeholder: "Enter text...",
		inputLabel: "Label",
		inputType: "text",
	};
}
