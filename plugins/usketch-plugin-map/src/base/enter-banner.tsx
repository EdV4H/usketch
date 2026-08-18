// EnterBanner — RPG-style "you entered <Base>'s area" feedback. Local-only: each
// client watches the base that owns the tile under its own VIEWPORT CENTRE (a
// single, swappable definition of "where I am"). HEADLESS: the plugin owns the
// tracking (current base + entry transitions) and hands an `EnterBannerState` to
// the host's `enterBanner.render` — the host owns the look. No sync — presentation
// only. Not registered at all unless a render hook is provided (see plugin.tsx).
import type { BoardStore } from "@edv4h/usketch-shared";
import { useEffect, useRef, useState } from "react";
import { MAP_TOOL_ID } from "../map-tool-id.js";
import { useMapToolState } from "../tool-state.js";
import type { BaseInfo } from "./base-map-shape.js";
import { baseIdAtWorld, getBaseMap } from "./base-ops.js";
import { baseStateStore } from "./base-state.js";
import { computeTerritory } from "./territory.js";
import type { EnterBannerState } from "./territory-style.js";

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

export function EnterBanner({
	store,
	tile,
	render,
}: {
	store: BoardStore;
	tile: number;
	render: (state: EnterBannerState) => React.ReactNode;
}) {
	const tool = useMapToolState();
	const [activeTool, setActiveTool] = useState(store.getActiveToolId());
	const [current, setCurrent] = useState<BaseInfo | null>(null);
	const [banner, setBanner] = useState<BaseInfo | null>(null);
	const [bannerKey, setBannerKey] = useState(0);
	const prevRef = useRef<string | null>(null);
	const rafRef = useRef(0);
	const timerRef = useRef(0);

	// Only show the base indicator while actually in base mode (map tool + base submode).
	useEffect(() => store.subscribe(() => setActiveTool(store.getActiveToolId())), [store]);
	const inBaseMode = activeTool === MAP_TOOL_ID && tool.mode === "base";

	// Leaving base mode clears any in-flight entry banner + timeout so a stale
	// banner can't reappear when returning to base mode before it fades.
	useEffect(() => {
		if (!inBaseMode) {
			clearTimeout(timerRef.current);
			setBanner(null);
		}
	}, [inBaseMode]);

	useEffect(() => {
		const update = () => {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = requestAnimationFrame(() => {
				const base = getBaseMap(store);
				let id: string | null = null;
				const center = viewportCenterWorld(store);
				if (base && center) {
					const territory = computeTerritory(
						store,
						tile,
						new Set(baseStateStore.get().excludeTerrains),
					);
					id = baseIdAtWorld(territory, center.x, center.y, tile);
				}
				if (id === prevRef.current) return;
				prevRef.current = id;
				const info = id && base ? (base.bases[id] ?? null) : null;
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

	if (!inBaseMode || (!current && !banner)) return null;
	const content = render({ current, entered: banner, enteredKey: bannerKey });
	if (content == null) return null;
	return <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{content}</div>;
}
