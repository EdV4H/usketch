import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";

export function renderTabs(data: ShapeData) {
	const tabs = (data.tabs as string[]) || ["Tab 1", "Tab 2", "Tab 3"];
	const activeIndex = (data.activeIndex as number) ?? 0;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "stretch",
				fontFamily: WF.font,
				borderBottom: `2px solid ${WF.colors.border}`,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			{tabs.map((tab, i) => (
				<div
					key={`${i}-${tab}`}
					style={{
						padding: "0 16px",
						display: "flex",
						alignItems: "center",
						fontSize: WF.fontSize.base,
						fontWeight: i === activeIndex ? 600 : 400,
						color: i === activeIndex ? WF.colors.primary : WF.colors.secondary,
						borderBottom:
							i === activeIndex ? `2px solid ${WF.colors.primary}` : "2px solid transparent",
						marginBottom: -2,
					}}
				>
					{tab}
				</div>
			))}
		</div>
	);
}

export function createDefaultTabs(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "wireframe-tabs",
		x: params.x,
		y: params.y,
		width: 320,
		height: 40,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		tabs: ["Tab 1", "Tab 2", "Tab 3"],
		activeIndex: 0,
	};
}
