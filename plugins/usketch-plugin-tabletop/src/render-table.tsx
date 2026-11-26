import type { ShapeData } from "@edv4h/usketch-shared";
import { type ReactElement, useId } from "react";
import type { Point, TabletopTableMeta } from "./table.js";

/** What a table's look is drawn from (see `CreateTabletopPluginOptions.renderTable`). */
export interface TabletopTableRenderProps {
	table: ShapeData;
	meta: TabletopTableMeta;
	/** The outline in the table's own box (from its top left), clockwise. */
	outline: Point[];
}

/** `outline` as SVG `points`. */
export const outlinePoints = (outline: readonly Point[]): string =>
	outline.map((p) => `${p.x},${p.y}`).join(" ");

/** The built-in look: a green table with a wooden rim, in the table's form. */
export function DefaultTable({ table, outline }: TabletopTableRenderProps): ReactElement {
	const rim = 12;
	// Several tables on a board: each needs its own clip id (safe in `url(#…)`).
	const clipId = `tabletop-table-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
	const points = outlinePoints(outline);
	return (
		<svg
			width="100%"
			height="100%"
			viewBox={`0 0 ${table.width} ${table.height}`}
			preserveAspectRatio="none"
			style={{ display: "block", overflow: "visible", pointerEvents: "none" }}
		>
			<title>Table</title>
			{/* The stroke is centred on the outline: clip off its outer half, so the rim is
			    inside and the table keeps its size. */}
			<clipPath id={clipId}>
				<polygon points={points} />
			</clipPath>
			<polygon
				points={points}
				fill="#2f6b4f"
				stroke="#6b4a2f"
				strokeWidth={rim * 2}
				strokeLinejoin="round"
				clipPath={`url(#${clipId})`}
			/>
		</svg>
	);
}
