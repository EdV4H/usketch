import type { ShapeData } from "@edv4h/usketch-shared";
import { WF } from "../shared/wireframe-styles.js";

export function renderTable(data: ShapeData) {
	const columns = (data.columns as string[]) || ["Name", "Value", "Status"];
	const rows = (data.rows as number) ?? 3;

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
			<div
				style={{
					display: "flex",
					background: WF.colors.surface,
					borderBottom: `1.5px solid ${WF.colors.border}`,
				}}
			>
				{columns.map((col, i) => (
					<div
						key={`${i}-${col}`}
						style={{
							flex: 1,
							padding: "8px 12px",
							fontSize: WF.fontSize.sm,
							fontWeight: 600,
							color: WF.colors.text,
							borderRight: i < columns.length - 1 ? `1px solid ${WF.colors.border}` : "none",
						}}
					>
						{col}
					</div>
				))}
			</div>
			<div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
				{Array.from({ length: rows }, (_, rowIdx) => {
					const rowKey = `row-${String(rowIdx)}`;
					return (
						<div
							key={rowKey}
							style={{
								display: "flex",
								borderBottom: rowIdx < rows - 1 ? `1px solid ${WF.colors.border}` : "none",
								flex: 1,
							}}
						>
							{columns.map((col, colIdx) => {
								const cellKey = `cell-${String(colIdx)}-${col}`;
								return (
									<div
										key={cellKey}
										style={{
											flex: 1,
											padding: "6px 12px",
											fontSize: WF.fontSize.sm,
											color: WF.colors.placeholder,
											borderRight:
												colIdx < columns.length - 1 ? `1px solid ${WF.colors.border}` : "none",
											display: "flex",
											alignItems: "center",
										}}
									>
										---
									</div>
								);
							})}
						</div>
					);
				})}
			</div>
		</div>
	);
}

export function createDefaultTable(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "wireframe-table",
		x: params.x,
		y: params.y,
		width: 400,
		height: 180,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		columns: ["Name", "Value", "Status"],
		rows: 3,
	};
}
