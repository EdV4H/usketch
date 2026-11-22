import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { type ReactElement, useSyncExternalStore } from "react";
import { readZoneMeta, type TabletopZoneMeta } from "./zone.js";
import { zoneCount } from "./zone-ops.js";

/** What a zone's look is drawn from (see `CreateTabletopPluginOptions.render`). */
export interface TabletopZoneRenderProps {
	zone: ShapeData;
	meta: TabletopZoneMeta;
	/** How many shapes the zone holds now. */
	count: number;
}

/** The built-in look: a dashed rounded frame with the label and, for a pile, the count. */
export function DefaultZone({ meta, count }: TabletopZoneRenderProps): ReactElement {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				boxSizing: "border-box",
				border: "2px dashed rgba(60, 60, 67, 0.45)",
				borderRadius: 10,
				background: "rgba(60, 60, 67, 0.06)",
				position: "relative",
				fontFamily: "system-ui, sans-serif",
				userSelect: "none",
				pointerEvents: "none",
			}}
		>
			{meta.label && (
				<div
					style={{
						position: "absolute",
						left: 8,
						top: 6,
						right: 8,
						fontSize: 12,
						fontWeight: 600,
						color: "rgba(60, 60, 67, 0.8)",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
				>
					{meta.label}
				</div>
			)}
			{meta.arrange === "pile" && count > 1 && (
				<div
					style={{
						position: "absolute",
						right: 6,
						bottom: 6,
						minWidth: 20,
						padding: "1px 6px",
						borderRadius: 10,
						background: "rgba(30, 30, 30, 0.75)",
						color: "#fff",
						fontSize: 11,
						fontWeight: 700,
						textAlign: "center",
					}}
				>
					{count}
				</div>
			)}
		</div>
	);
}

/** Keeps the count live: re-renders when what the zone holds changes. */
export function ZoneView({
	store,
	zone,
	render,
}: {
	store: BoardStore;
	zone: ShapeData;
	render: (props: TabletopZoneRenderProps) => ReactElement;
}): ReactElement {
	const count = useSyncExternalStore(
		(listener) => store.subscribe(listener),
		() => zoneCount(store, zone.id),
		() => zoneCount(store, zone.id),
	);
	return render({ zone, meta: readZoneMeta(zone), count });
}
