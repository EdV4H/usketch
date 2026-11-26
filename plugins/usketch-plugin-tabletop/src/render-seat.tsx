import type { ShapeData } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import type { TabletopSeatMeta } from "./seat.js";

/** What a seat's look is drawn from (see `CreateTabletopPluginOptions.renderSeat`). */
export interface TabletopSeatRenderProps {
	seat: ShapeData;
	meta: TabletopSeatMeta;
}

/** The built-in look: a white tag with a person mark and the label. */
export function DefaultSeat({ meta }: TabletopSeatRenderProps): ReactElement {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				boxSizing: "border-box",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 8,
				padding: "0 12px",
				borderRadius: 999,
				background: "rgba(255, 255, 255, 0.92)",
				color: "#1f2933",
				fontFamily: "system-ui, sans-serif",
				fontSize: 18,
				fontWeight: 600,
				whiteSpace: "nowrap",
				overflow: "hidden",
				userSelect: "none",
				pointerEvents: "none",
			}}
		>
			<svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor">
				<title>Seat</title>
				<circle cx="10" cy="6.5" r="3.5" />
				<path d="M3 17c0-3.9 3.1-6 7-6s7 2.1 7 6z" />
			</svg>
			<span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{meta.label}</span>
		</div>
	);
}
