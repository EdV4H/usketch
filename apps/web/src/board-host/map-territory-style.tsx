// Stock territory look for the community "World" map. The map plugin is headless —
// it derives each base's region (cells / outline / beacon+radius) but draws nothing
// itself — so the demo app owns the appearance here and passes it via
// `createMapPlugin({ territory })`. This is the reference look that used to ship
// inside the plugin: translucent fill + coloured border + dashed radius ring, plus
// a name-chip label. Hosts with their own design supply their own render hooks.
import type {
	BaseRegionAnchor,
	EnterBannerState,
	TerritoryRegion,
	TerritoryStyle,
} from "@edv4h/usketch-plugin-map";
import type { ReactElement } from "react";

const FILL_OPACITY = 0.24;
const BORDER_OPACITY = 0.85;
const BORDER_RATIO = 0.16; // border band thickness as a fraction of a tile
const RING = { strokeWidth: 2, dash: "8 6", opacity: 0.7 };
const BANNER_MS = 2600;

/** Parse a `"c,r"` cell key into integer [col, row]. */
function parseCell(key: string): [number, number] {
	const i = key.indexOf(",");
	return [Number(key.slice(0, i)), Number(key.slice(i + 1))];
}

/** Fill + border + radius ring for one region, in WORLD coordinates. */
function renderRegion(region: TerritoryRegion): ReactElement {
	const { color, tile, cells, outline, beaconCell, radius } = region;
	const fills = cells.map((k) => {
		const [c, r] = parseCell(k);
		return (
			<rect
				key={`f-${k}`}
				x={c * tile}
				y={r * tile}
				width={tile}
				height={tile}
				fill={color}
				fillOpacity={FILL_OPACITY}
			/>
		);
	});
	let ring: ReactElement | null = null;
	if (beaconCell) {
		const [c, r] = parseCell(beaconCell);
		ring = (
			<circle
				cx={(c + 0.5) * tile}
				cy={(r + 0.5) * tile}
				r={radius * tile}
				fill="none"
				stroke={color}
				strokeWidth={RING.strokeWidth}
				strokeDasharray={RING.dash}
				opacity={RING.opacity}
				vectorEffect="non-scaling-stroke"
			/>
		);
	}
	return (
		<>
			{fills}
			{outline ? (
				<path
					d={outline}
					fill="none"
					stroke={color}
					strokeWidth={BORDER_RATIO * tile}
					strokeOpacity={BORDER_OPACITY}
					strokeLinecap="round"
				/>
			) : null}
			{ring}
		</>
	);
}

/** Name-chip label positioned at the region centre (screen space). */
function renderLabel(anchor: BaseRegionAnchor): ReactElement {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 5,
				padding: "3px 9px",
				background: "rgba(255,255,255,.9)",
				border: `2px solid ${anchor.color}`,
				borderRadius: 20,
				font: "700 12px system-ui, sans-serif",
				color: "#1c1c1c",
				whiteSpace: "nowrap",
				boxShadow: "0 2px 8px rgba(0,0,0,.14)",
			}}
		>
			<span
				style={{
					width: 10,
					height: 10,
					borderRadius: "50%",
					background: anchor.color,
					flex: "none",
				}}
			/>
			{anchor.name}
		</div>
	);
}

/** RPG-style "you entered <Base>'s area" toast + persistent current-area chip. */
function renderEnterBanner({
	current,
	entered,
	enteredKey,
}: EnterBannerState): ReactElement | null {
	if (!current && !entered) return null;
	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			<style>
				{
					"@keyframes uskmap-enter{0%{opacity:0;transform:translate(-50%,-16px)}12%{opacity:1;transform:translate(-50%,0)}88%{opacity:1}100%{opacity:0}}"
				}
			</style>
			{entered ? (
				<div
					key={enteredKey}
					style={{
						position: "absolute",
						left: "50%",
						top: 26,
						transform: "translate(-50%,0)",
						display: "flex",
						alignItems: "center",
						gap: 10,
						padding: "10px 22px",
						background: "rgba(255,255,255,.96)",
						border: `3px solid ${entered.color}`,
						borderRadius: 14,
						font: "800 18px system-ui, sans-serif",
						color: "#1c1c1c",
						whiteSpace: "nowrap",
						boxShadow: "0 8px 26px rgba(0,0,0,.2)",
						animation: `uskmap-enter ${BANNER_MS}ms ease-out forwards`,
					}}
				>
					<span style={{ fontSize: 20 }}>⚔</span>
					<span>
						<span style={{ color: entered.color }}>{entered.name}</span> のエリアに入った
					</span>
				</div>
			) : null}
			{current ? (
				<div
					style={{
						position: "absolute",
						left: "50%",
						bottom: 18,
						transform: "translateX(-50%)",
						display: "flex",
						alignItems: "center",
						gap: 7,
						padding: "5px 13px",
						background: "rgba(255,255,255,.9)",
						border: `2px solid ${current.color}`,
						borderRadius: 20,
						font: "700 13px system-ui, sans-serif",
						color: "#1c1c1c",
						whiteSpace: "nowrap",
						boxShadow: "0 2px 10px rgba(0,0,0,.14)",
					}}
				>
					<span
						style={{
							width: 11,
							height: 11,
							borderRadius: "50%",
							background: current.color,
							flex: "none",
						}}
					/>
					現在地: {current.name}
				</div>
			) : null}
		</div>
	);
}

/** The stock territory appearance, for `createMapPlugin({ territory })`. */
export const stockTerritoryStyle: TerritoryStyle = {
	region: { render: renderRegion },
	label: { render: renderLabel },
	enterBanner: { render: renderEnterBanner },
};
