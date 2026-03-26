import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";

export function renderNavbar(data: ShapeData) {
	const items = (data.items as string[]) || ["Home", "About", "Contact"];
	const brand = (data.brand as string) || "Brand";

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
				padding: "0 16px",
				gap: 24,
				fontFamily: WF.font,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					fontSize: WF.fontSize.lg,
					fontWeight: 700,
					color: WF.colors.text,
				}}
			>
				{brand}
			</div>
			<div style={{ display: "flex", gap: 16, marginLeft: "auto" }}>
				{items.map((item, i) => (
					<div
						key={`${i}-${item}`}
						style={{
							fontSize: WF.fontSize.base,
							color: i === 0 ? WF.colors.primary : WF.colors.secondary,
						}}
					>
						{item}
					</div>
				))}
			</div>
		</div>
	);
}

export function createDefaultNavbar(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "wireframe-navbar",
		x: params.x,
		y: params.y,
		width: 600,
		height: 48,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		items: ["Home", "About", "Contact"],
		brand: "Brand",
	};
}
