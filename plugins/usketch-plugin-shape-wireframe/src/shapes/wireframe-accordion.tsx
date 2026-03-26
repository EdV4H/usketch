import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";

export function renderAccordion(data: ShapeData) {
	const sections = (data.sections as string[]) || ["Section 1", "Section 2", "Section 3"];
	const expandedIndex = (data.expandedIndex as number) ?? 0;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				border: `1.5px solid ${WF.colors.border}`,
				borderRadius: WF.radius,
				overflow: "hidden",
				fontFamily: WF.font,
				display: "flex",
				flexDirection: "column",
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			{sections.map((section, i) => (
				<div
					key={`${i}-${section}`}
					style={{ display: "flex", flexDirection: "column", flex: i === expandedIndex ? 1 : 0 }}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							padding: "10px 16px",
							background: WF.colors.surface,
							borderBottom: `1px solid ${WF.colors.border}`,
							fontSize: WF.fontSize.base,
							fontWeight: 600,
							color: WF.colors.text,
						}}
					>
						<span>{section}</span>
						<span style={{ color: WF.colors.placeholder, fontSize: WF.fontSize.sm }}>
							{i === expandedIndex ? "\u25B2" : "\u25BC"}
						</span>
					</div>
					{i === expandedIndex && (
						<div
							style={{
								flex: 1,
								padding: "12px 16px",
								fontSize: WF.fontSize.sm,
								color: WF.colors.secondary,
								lineHeight: 1.5,
								borderBottom: i < sections.length - 1 ? `1px solid ${WF.colors.border}` : "none",
							}}
						>
							Content for {section}
						</div>
					)}
				</div>
			))}
		</div>
	);
}

export function createDefaultAccordion(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "wireframe-accordion",
		x: params.x,
		y: params.y,
		width: 300,
		height: 200,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		sections: ["Section 1", "Section 2", "Section 3"],
		expandedIndex: 0,
	};
}
