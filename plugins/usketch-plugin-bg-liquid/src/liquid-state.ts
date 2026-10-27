import type { DisplacerMode } from "./displacer.js";

export interface LiquidSettings {
	/** Which shapes push the liquid aside. */
	mode: DisplacerMode;
	/** 0 (runny, settles fast) – 1 (thick, oozes back slowly). */
	viscosity: number;
	/** Ambient surface flow, 0 (still) – 1. */
	flow: number;
	/** Liquid colour (CSS hex). */
	color: string;
}

export const DEFAULT_LIQUID_SETTINGS: LiquidSettings = {
	mode: "marked",
	viscosity: 0.7,
	flow: 0.5,
	color: "#7f9dc4",
};

/** Per-plugin-instance view state (per viewer, not synced): visibility + settings. */
export interface LiquidState {
	isVisible(): boolean;
	setVisible(visible: boolean): void;
	getSettings(): LiquidSettings;
	setSettings(patch: Partial<LiquidSettings>): void;
	subscribe(listener: () => void): () => void;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function createLiquidState(initial: Partial<LiquidSettings> = {}): LiquidState {
	let visible = false;
	let settings: LiquidSettings = sanitize({ ...DEFAULT_LIQUID_SETTINGS, ...initial });
	const listeners = new Set<() => void>();
	const notify = () => {
		for (const fn of listeners) fn();
	};
	return {
		isVisible: () => visible,
		setVisible(v) {
			if (v === visible) return;
			visible = v;
			notify();
		},
		getSettings: () => settings,
		setSettings(patch) {
			settings = sanitize({ ...settings, ...patch });
			notify();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

function sanitize(s: LiquidSettings): LiquidSettings {
	return {
		mode: s.mode === "all" ? "all" : "marked",
		viscosity: Number.isFinite(s.viscosity)
			? clamp01(s.viscosity)
			: DEFAULT_LIQUID_SETTINGS.viscosity,
		flow: Number.isFinite(s.flow) ? clamp01(s.flow) : DEFAULT_LIQUID_SETTINGS.flow,
		color: typeof s.color === "string" && s.color ? s.color : DEFAULT_LIQUID_SETTINGS.color,
	};
}

/**
 * Map `viscosity` (0–1) to simulation rates. A disturbance of ~40 world units
 * settles in about 1 s when runny and ~8 s when thick.
 */
export function viscosityToRates(viscosity: number): { diffusion: number; relaxation: number } {
	const v = clamp01(viscosity);
	return {
		diffusion: 1600 * (1 - v) + 160 * v,
		relaxation: 0.9 * (1 - v) + 0.1 * v,
	};
}
