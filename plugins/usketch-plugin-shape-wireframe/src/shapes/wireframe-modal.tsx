import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";
import type { WireframeModalShapeData } from "../types.js";

export function renderModal(shape: ShapeData) {
	const data = shape as WireframeModalShapeData;
	const modalTitle = data.modalTitle || "Modal Title";
	const modalContent = data.modalContent || "Modal content goes here.";

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: WF.colors.bg,
				border: `1.5px solid ${WF.colors.border}`,
				borderRadius: WF.radius * 2,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				fontFamily: WF.font,
				boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "12px 16px",
					borderBottom: `1px solid ${WF.colors.border}`,
				}}
			>
				<div
					style={{
						fontSize: WF.fontSize.lg,
						fontWeight: 600,
						color: WF.colors.text,
					}}
				>
					{modalTitle}
				</div>
				<div
					style={{
						fontSize: WF.fontSize.lg,
						color: WF.colors.placeholder,
						cursor: "default",
					}}
				>
					&#10005;
				</div>
			</div>
			<div
				style={{
					flex: 1,
					padding: "16px",
					fontSize: WF.fontSize.base,
					color: WF.colors.secondary,
					lineHeight: 1.5,
					overflow: "hidden",
				}}
			>
				{modalContent}
			</div>
			<div
				style={{
					display: "flex",
					justifyContent: "flex-end",
					gap: 8,
					padding: "12px 16px",
					borderTop: `1px solid ${WF.colors.border}`,
				}}
			>
				<div
					style={{
						padding: "6px 16px",
						borderRadius: WF.radius,
						border: `1px solid ${WF.colors.border}`,
						fontSize: WF.fontSize.sm,
						color: WF.colors.secondary,
					}}
				>
					Cancel
				</div>
				<div
					style={{
						padding: "6px 16px",
						borderRadius: WF.radius,
						background: WF.colors.primary,
						fontSize: WF.fontSize.sm,
						color: WF.colors.primaryText,
					}}
				>
					Confirm
				</div>
			</div>
		</div>
	);
}

export function createDefaultModal(params: {
	id: string;
	x: number;
	y: number;
}): WireframeModalShapeData {
	return {
		id: params.id,
		type: "wireframe-modal",
		x: params.x,
		y: params.y,
		width: 360,
		height: 220,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		modalTitle: "Modal Title",
		modalContent: "Modal content goes here.",
	};
}
