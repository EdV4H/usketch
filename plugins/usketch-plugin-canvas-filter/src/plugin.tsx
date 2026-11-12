import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { compileFilter } from "./filter-engine.js";
import { FilterPalette } from "./filter-palette.js";
import type { FilterChangedEvent, ShapeFilterConfig } from "./types.js";

export interface FilterPluginOptions {
	/**
	 * @deprecated Ignored. The Time Travel tab it enabled was removed; board history
	 * (list / diff / preview / restore) lives in `@edv4h/usketch-plugin-history`.
	 */
	boardRoomApiUrl?: string;
}

export function createFilterPlugin(_options?: FilterPluginOptions): UsketchPlugin {
	let ctx: PluginContext | null = null;
	let currentConfig: ShapeFilterConfig | null = null;
	let paletteOpen = false;
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

	/** Clear the active filter (mirrors applyConfig's empty-rules branch). */
	function clearFilter() {
		if (!ctx) return;
		currentConfig = null;
		ctx.events.emit<FilterChangedEvent>("filter:changed", { predicate: null, config: null });
		notify();
	}

	// ── React gate components ──

	function FilterPaletteGate() {
		const open = useSyncExternalStore(subscribe, () => paletteOpen);
		if (!open) return null;
		return <FilterPalette onApply={applyConfig} onClose={closePalette} />;
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

			// Shortcut: Shift+F to toggle filter palette
			const unregShortcut = ctx.shortcuts.register("Shift+F", () => {
				togglePalette();
			});
			cleanups.push(unregShortcut);

			// Control HUD actions (replaces the always-on indicator button).
			cleanups.push(
				ctx.actions.register({
					id: "filter:open",
					group: "フィルタ",
					label: "フィルタ設定を開く",
					isActive: () => paletteOpen,
					run: togglePalette,
				}),
				ctx.actions.register({
					id: "filter:clear",
					group: "フィルタ",
					label: "フィルタ解除",
					isEnabled: () => currentConfig !== null,
					run: clearFilter,
				}),
			);

			return () => {
				for (const cleanup of cleanups) cleanup();
				cleanups.length = 0;

				if (ctx) {
					ctx.layers.unregister("filter-palette");

					if (currentConfig) {
						ctx.events.emit<FilterChangedEvent>("filter:changed", {
							predicate: null,
							config: null,
						});
					}
				}

				currentConfig = null;
				paletteOpen = false;
				listeners.clear();
				ctx = null;
			};
		},
	};
}
