import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";
import type { WireframeAvatarShapeData } from "../types.js";

export function renderAvatar(shape: ShapeData) {
	const data = shape as WireframeAvatarShapeData;
	const avatarLabel = data.avatarLabel || "U";

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: WF.colors.border,
				borderRadius: "50%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: WF.font,
				fontSize: WF.fontSize.lg,
				fontWeight: 600,
				color: WF.colors.text,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			{avatarLabel}
		</div>
	);
}

export function createDefaultAvatar(params: {
	id: string;
	x: number;
	y: number;
}): WireframeAvatarShapeData {
	return {
		id: params.id,
		type: "wireframe-avatar",
		x: params.x,
		y: params.y,
		width: 40,
		height: 40,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		avatarLabel: "U",
	};
}
