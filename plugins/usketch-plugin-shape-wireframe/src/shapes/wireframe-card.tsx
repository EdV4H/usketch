import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";

export function renderCard(data: ShapeData) {
	const cardTitle = (data.cardTitle as string) || "Card Title";
	const cardContent = (data.cardContent as string) || "Card content goes here.";

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
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					padding: "12px 16px 8px",
					fontSize: WF.fontSize.lg,
					fontWeight: 600,
					color: WF.colors.text,
					borderBottom: `1px solid ${WF.colors.border}`,
				}}
			>
				{cardTitle}
			</div>
			<div
				style={{
					flex: 1,
					padding: "8px 16px 12px",
					fontSize: WF.fontSize.base,
					color: WF.colors.secondary,
					lineHeight: 1.5,
					overflow: "hidden",
				}}
			>
				{cardContent}
			</div>
		</div>
	);
}

export function createDefaultCard(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "wireframe-card",
		x: params.x,
		y: params.y,
		width: 280,
		height: 200,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		cardTitle: "Card Title",
		cardContent: "Card content goes here.",
	};
}
