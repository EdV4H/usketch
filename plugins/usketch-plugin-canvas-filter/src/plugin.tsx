import type { PluginContext, ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { compileFilter } from "./filter-engine.js";
import { FilterIndicator } from "./filter-indicator.js";
import { FilterPalette } from "./filter-palette.js";
import { TimeTravelBanner, TimeTravelPanel } from "./time-travel.js";
import type { FilterChangedEvent, ShapeFilterConfig } from "./types.js";

export interface FilterPluginOptions {
	/** Base URL for the board-room Durable Object HTTP API (for snapshots) */
	boardRoomApiUrl?: string;
}

export function createFilterPlugin(_options?: FilterPluginOptions): UsketchPlugin {
	let ctx: PluginContext | null = null;
	let currentConfig: ShapeFilterConfig | null = null;
	let paletteOpen = false;
	let timeTravelTs: number | null = null;
	let timeTravelShapes: Map<string, ShapeData> | null = null;
	const listeners = new Set<() => void>();

	function notify() {
		for (const cb of listeners) cb();
		// Trigger Canvas re-render so layer render functions pick up state changes
		ctx?.events.emit("layers:changed", {});
	}

	function subscribe(cb: () => void): () => void {
		listeners.add(cb);
		return () => listeners.delete(cb);
	}

	/** Convert a timestamp to its quarterly partition name */
	function tsToPartition(ts: number): string {
		const d = new Date(ts);
		const q = Math.floor(d.getMonth() / 3) + 1;
		return `shapes:${d.getFullYear()}-Q${q}`;
	}

	/** Request loading partitions that cover the filter's time range */
	function requestPartitionsForConfig(config: ShapeFilterConfig) {
		if (!ctx) return;
		const timeRules = config.rules.filter((r) => r.kind === "time-range");
		if (timeRules.length === 0) return;

		const partitions = new Set<string>();
		for (const rule of timeRules) {
			if (rule.kind !== "time-range") continue;
			const from = rule.from ?? 0;
			const to = rule.to ?? Date.now();
			// Generate quarterly partition names covering the range
			const start = new Date(from);
			const end = new Date(to);
			const cursor = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
			while (cursor.getTime() <= end.getTime()) {
				partitions.add(tsToPartition(cursor.getTime()));
				cursor.setMonth(cursor.getMonth() + 3);
			}
		}

		if (partitions.size > 0) {
			ctx.events.emit("partition:request", { partitions: Array.from(partitions) });
		}
	}

	function applyConfig(config: ShapeFilterConfig) {
		if (!ctx) return;
		if (config.rules.length === 0) {
			currentConfig = null;
			ctx.events.emit<FilterChangedEvent>("filter:changed", {
				predicate: null,
				config: null,
			});
		} else {
			currentConfig = config;
			// Request loading relevant partitions before applying the filter
			requestPartitionsForConfig(config);
			const predicate = compileFilter(config);
			ctx.events.emit<FilterChangedEvent>("filter:changed", {
				predicate,
				config,
			});
		}
		notify();
	}

	function togglePalette() {
		paletteOpen = !paletteOpen;
		notify();
	}

	function closePalette() {
		paletteOpen = false;
		notify();
	}

	// ── Time Travel ──

	function enterTimeTravel(shapes: Map<string, ShapeData>) {
		if (!ctx) return;
		timeTravelShapes = shapes;
		// Emit a "always true" predicate but with time-travel shapes override
		ctx.events.emit("time-travel:enter", { shapes });
		notify();
	}

	function exitTimeTravel() {
		if (!ctx) return;
		timeTravelTs = null;
		timeTravelShapes = null;
		ctx.events.emit("time-travel:exit", {});
		notify();
	}

	// ── React gate components ──

	function FilterPaletteGate() {
		const open = useSyncExternalStore(subscribe, () => paletteOpen);
		if (!open) return null;
		return <FilterPalette onApply={applyConfig} onClose={closePalette} />;
	}

	function FilterIndicatorGate() {
		const config = useSyncExternalStore(subscribe, () => currentConfig);
		const ruleCount = config?.rules.length ?? 0;
		return <FilterIndicator ruleCount={ruleCount} onClick={togglePalette} />;
	}

	function TimeTravelBannerGate() {
		const ts = useSyncExternalStore(subscribe, () => timeTravelTs);
		if (ts == null) return null;
		return <TimeTravelBanner timestamp={ts} onExit={exitTimeTravel} />;
	}

	const cleanups: (() => void)[] = [];

	return {
		id: "canvas-filter",
		name: "Canvas Filter",

		setup(pluginCtx) {
			ctx = pluginCtx;

			// Register palette layer (fixed, high z-order)
			ctx.layers.register({
				id: "filter-palette",
				order: 998,
				fixed: true,
				render: () => <FilterPaletteGate />,
			});

			// Register indicator layer (fixed)
			ctx.layers.register({
				id: "filter-indicator",
				order: 200,
				fixed: true,
				render: () => <FilterIndicatorGate />,
			});

			// Register time travel banner layer (fixed)
			ctx.layers.register({
				id: "time-travel-banner",
				order: 999,
				fixed: true,
				render: () => <TimeTravelBannerGate />,
			});

			// Shortcut: Shift+F to toggle filter palette
			const unregShortcut = ctx.shortcuts.register("Shift+F", () => {
				togglePalette();
			});
			cleanups.push(unregShortcut);

			// Listen for time-travel requests from filter palette or external
			const unsubTtEnter = ctx.events.on<{ shapes: Map<string, ShapeData>; timestamp: number }>(
				"time-travel:request",
				(data) => {
					timeTravelTs = data.timestamp;
					enterTimeTravel(data.shapes);
				},
			);
			cleanups.push(unsubTtEnter);

			// Register Time Travel tab in side panel (if boardRoomApiUrl is available)
			const apiUrl = _options?.boardRoomApiUrl;
			if (apiUrl) {
				ctx.events.emit("side-panel:register-tab", {
					tab: {
						id: "time-travel",
						label: "Time Travel",
						icon: "⏰",
						order: 10,
						render: () => (
							<TimeTravelPanel
								apiBaseUrl={apiUrl}
								onEnter={(shapes, timestamp) => {
									timeTravelTs = timestamp;
									enterTimeTravel(shapes);
								}}
								onExit={exitTimeTravel}
							/>
						),
					},
				});
			}
		},

		teardown() {
			for (const cleanup of cleanups) cleanup();
			cleanups.length = 0;

			if (ctx) {
				ctx.layers.unregister("filter-palette");
				ctx.layers.unregister("filter-indicator");
				ctx.layers.unregister("time-travel-banner");
				ctx.events.emit("side-panel:unregister-tab", { tabId: "time-travel" });

				if (currentConfig) {
					ctx.events.emit<FilterChangedEvent>("filter:changed", {
						predicate: null,
						config: null,
					});
				}

				if (timeTravelShapes) {
					ctx.events.emit("time-travel:exit", {});
				}
			}

			currentConfig = null;
			paletteOpen = false;
			timeTravelTs = null;
			timeTravelShapes = null;
			listeners.clear();
			ctx = null;
		},
	};
}
