import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";
import type { WireframeBreadcrumbShapeData } from "../types.js";

export function renderBreadcrumb(shape: ShapeData) {
	const data = shape as WireframeBreadcrumbShapeData;
	const items = data.items || ["Home", "Page", "Current"];

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				gap: 6,
				fontFamily: WF.font,
				fontSize: WF.fontSize.sm,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			{items.map((item, i) => (
				<span key={`${i}-${item}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
					{i > 0 && <span style={{ color: WF.colors.placeholder }}>/</span>}
					<span
						style={{
							color: i === items.length - 1 ? WF.colors.text : WF.colors.primary,
							fontWeight: i === items.length - 1 ? 600 : 400,
						}}
					>
						{item}
					</span>
				</span>
			))}
		</div>
	);
}

export function createDefaultBreadcrumb(params: {
	id: string;
	x: number;
	y: number;
}): WireframeBreadcrumbShapeData {
	return {
		id: params.id,
		type: "wireframe-breadcrumb",
		x: params.x,
		y: params.y,
		width: 240,
		height: 24,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		items: ["Home", "Page", "Current"],
	};
}
