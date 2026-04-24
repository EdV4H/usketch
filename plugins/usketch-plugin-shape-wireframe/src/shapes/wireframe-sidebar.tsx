import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";
import type { WireframeSidebarShapeData } from "../types.js";

export function renderSidebar(shape: ShapeData) {
	const data = shape as WireframeSidebarShapeData;
	const items = data.items || ["Dashboard", "Settings", "Profile"];
	const sidebarTitle = data.sidebarTitle || "Menu";

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
				overflow: "hidden",
				fontFamily: WF.font,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					padding: "12px 16px",
					fontSize: WF.fontSize.sm,
					fontWeight: 600,
					color: WF.colors.secondary,
					textTransform: "uppercase",
					letterSpacing: "0.05em",
					borderBottom: `1px solid ${WF.colors.border}`,
				}}
			>
				{sidebarTitle}
			</div>
			<div style={{ display: "flex", flexDirection: "column" }}>
				{items.map((item, i) => (
					<div
						key={`${i}-${item}`}
						style={{
							padding: "10px 16px",
							fontSize: WF.fontSize.base,
							color: i === 0 ? WF.colors.primary : WF.colors.text,
							fontWeight: i === 0 ? 600 : 400,
							background: i === 0 ? `${WF.colors.primary}11` : "transparent",
							borderLeft: i === 0 ? `3px solid ${WF.colors.primary}` : "3px solid transparent",
						}}
					>
						{item}
					</div>
				))}
			</div>
		</div>
	);
}

export function createDefaultSidebar(params: {
	id: string;
	x: number;
	y: number;
}): WireframeSidebarShapeData {
	return {
		id: params.id,
		type: "wireframe-sidebar",
		x: params.x,
		y: params.y,
		width: 200,
		height: 300,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		items: ["Dashboard", "Settings", "Profile"],
		sidebarTitle: "Menu",
	};
}
