import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";

export function renderList(data: ShapeData) {
	const listItems = (data.listItems as string[]) || ["Item 1", "Item 2", "Item 3"];

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				gap: 4,
				fontFamily: WF.font,
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
			}}
		>
			{listItems.map((item, i) => (
				<div
					key={`${i}-${item}`}
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						fontSize: WF.fontSize.base,
						color: WF.colors.text,
						lineHeight: 1.6,
					}}
				>
					<span style={{ color: WF.colors.placeholder, fontSize: WF.fontSize.sm }}>&#8226;</span>
					<span>{item}</span>
				</div>
			))}
		</div>
	);
}

export function createDefaultList(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "wireframe-list",
		x: params.x,
		y: params.y,
		width: 200,
		height: 120,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		listItems: ["Item 1", "Item 2", "Item 3"],
	};
}
