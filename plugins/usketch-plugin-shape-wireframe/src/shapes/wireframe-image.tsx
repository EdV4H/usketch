import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";

export function renderImage(data: ShapeData) {
	const imageAlt = (data.imageAlt as string) || "Image";

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: WF.colors.surface,
				border: `1.5px solid ${WF.colors.border}`,
				borderRadius: WF.radius,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 8,
				fontFamily: WF.font,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					fontSize: 32,
					lineHeight: 1,
					color: WF.colors.placeholder,
				}}
			>
				&#9968;
			</div>
			<div
				style={{
					fontSize: WF.fontSize.sm,
					color: WF.colors.placeholder,
				}}
			>
				{imageAlt}
			</div>
		</div>
	);
}

export function createDefaultImage(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "wireframe-image",
		x: params.x,
		y: params.y,
		width: 240,
		height: 160,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		imageAlt: "Image",
	};
}
