import type { ShapeData } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import type { TabletopViewMeta } from "./view.js";

/** What a view's look is drawn from (see `CreateTabletopPluginOptions.renderView`). */
export interface TabletopViewRenderProps {
	view: ShapeData;
	meta: TabletopViewMeta;
}

/** Height of the label strip along a view's top edge, in world units (it takes clicks too). */
export const VIEW_LABEL_HEIGHT = 32;

/** The built-in look: a dashed frame with a camera mark and the label at the top left. */
export function DefaultView({ meta }: TabletopViewRenderProps): ReactElement {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				boxSizing: "border-box",
				border: "3px dashed rgba(0, 122, 255, 0.6)",
				borderRadius: 4,
				position: "relative",
				fontFamily: "system-ui, sans-serif",
				userSelect: "none",
				pointerEvents: "none",
			}}
		>
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					maxWidth: "100%",
					height: VIEW_LABEL_HEIGHT,
					boxSizing: "border-box",
					display: "flex",
					alignItems: "center",
					gap: 6,
					padding: "0 10px",
					background: "rgba(0, 122, 255, 0.85)",
					color: "#fff",
					fontSize: 14,
					fontWeight: 600,
					borderBottomRightRadius: 6,
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
				}}
			>
				<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor">
					<title>View</title>
					<rect x="2" y="5" width="12" height="10" rx="2" strokeWidth="1.6" />
					<path d="M14 9l4-2.5v7L14 11" strokeWidth="1.6" strokeLinejoin="round" />
				</svg>
				{meta.label}
			</div>
		</div>
	);
}
