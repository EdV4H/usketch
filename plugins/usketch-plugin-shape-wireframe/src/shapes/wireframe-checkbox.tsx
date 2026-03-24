import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";

export function renderCheckbox(data: ShapeData) {
	const checkboxLabel = (data.checkboxLabel as string) || "Checkbox";
	const checked = data.checked === true;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				gap: 8,
				fontFamily: WF.font,
				fontSize: WF.fontSize.base,
				color: WF.colors.text,
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			<div
				style={{
					width: 16,
					height: 16,
					flexShrink: 0,
					border: `1.5px solid ${checked ? WF.colors.primary : WF.colors.border}`,
					borderRadius: 3,
					background: checked ? WF.colors.primary : WF.colors.bg,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					boxSizing: "border-box",
				}}
			>
				{checked && (
					<svg width="10" height="10" viewBox="0 0 10 10">
						<path
							d="M2 5l2.5 2.5L8 3"
							fill="none"
							stroke="#fff"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				)}
			</div>
			<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
				{checkboxLabel}
			</span>
		</div>
	);
}

export function createDefaultCheckbox(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "wireframe-checkbox",
		x: params.x,
		y: params.y,
		width: 160,
		height: 24,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		checkboxLabel: "Checkbox",
		checked: false,
	};
}
