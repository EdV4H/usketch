// EnterBanner — RPG-style "you entered <Team>'s area" feedback. Local-only: each
// client watches the team that owns the tile under its own VIEWPORT CENTRE (a
// single, swappable definition of "where I am") and shows a banner on entry plus
// a persistent current-area chip. No sync — presentation only.
import type { BoardStore } from "@edv4h/usketch-shared";
import { useEffect, useRef, useState } from "react";
import { MAP_TOOL_ID } from "../map-tool-id.js";
import { useMapToolState } from "../tool-state.js";
import type { TeamInfo } from "./team-map-shape.js";
import { getTeamMap, teamIdAtWorld } from "./team-ops.js";

const BANNER_MS = 2600;

/** World point the local user is "standing on" — the viewport centre. */
function viewportCenterWorld(store: BoardStore): { x: number; y: number } | null {
	if (typeof window === "undefined") return null;
	const vp = store.getViewport();
	return {
		x: (window.innerWidth / 2 - vp.x) / vp.zoom,
		y: (window.innerHeight / 2 - vp.y) / vp.zoom,
	};
}

export function EnterBanner({ store, tile }: { store: BoardStore; tile: number }) {
	const tool = useMapToolState();
	const [activeTool, setActiveTool] = useState(store.getActiveToolId());
	const [current, setCurrent] = useState<TeamInfo | null>(null);
	const [banner, setBanner] = useState<TeamInfo | null>(null);
	const [bannerKey, setBannerKey] = useState(0);
	const prevRef = useRef<string | null>(null);
	const rafRef = useRef(0);
	const timerRef = useRef(0);

	// Only show the team indicator while actually in team mode (map tool + team submode).
	useEffect(() => store.subscribe(() => setActiveTool(store.getActiveToolId())), [store]);
	const inTeamMode = activeTool === MAP_TOOL_ID && tool.mode === "team";

	// Leaving team mode clears any in-flight entry banner + timeout so a stale
	// banner can't reappear when returning to team mode before it fades.
	useEffect(() => {
		if (!inTeamMode) {
			clearTimeout(timerRef.current);
			setBanner(null);
		}
	}, [inTeamMode]);

	useEffect(() => {
		const update = () => {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = requestAnimationFrame(() => {
				const team = getTeamMap(store);
				let id: string | null = null;
				const center = viewportCenterWorld(store);
				if (team && center && Object.keys(team.owner).length > 0) {
					id = teamIdAtWorld(team.owner, center.x, center.y, tile);
				}
				if (id === prevRef.current) return;
				prevRef.current = id;
				const info = id && team ? (team.teams[id] ?? null) : null;
				setCurrent(info);
				if (info) {
					setBanner(info);
					setBannerKey((k) => k + 1); // restart the entrance animation
					clearTimeout(timerRef.current);
					timerRef.current = window.setTimeout(() => setBanner(null), BANNER_MS);
				}
			});
		};
		update();
		const u = store.subscribe(update);
		return () => {
			u();
			cancelAnimationFrame(rafRef.current);
			clearTimeout(timerRef.current);
		};
	}, [store, tile]);

	if (!inTeamMode || (!current && !banner)) return null;

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			<style>
				{
					"@keyframes uskmap-enter{0%{opacity:0;transform:translate(-50%,-16px)}12%{opacity:1;transform:translate(-50%,0)}88%{opacity:1}100%{opacity:0}}"
				}
			</style>

			{/* Entry banner (transient) */}
			{banner && (
				<div
					key={bannerKey}
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
						border: `3px solid ${banner.color}`,
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
						<span style={{ color: banner.color }}>{banner.name}</span> のエリアに入った
					</span>
				</div>
			)}

			{/* Persistent current-area chip */}
			{current && (
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
			)}
		</div>
	);
}
