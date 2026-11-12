// The plugin's live, per-viewer settings: per-type 3D config and the draw limits.
import { DEFAULT_SHAPE_3D_LIMITS, type Shape3dLimits } from "./shape-3d-layout.js";
import {
	DEFAULT_SHAPE_3D_TYPES,
	mergeShape3dTypes,
	type Shape3dTypeConfig,
	type Shape3dTypes,
} from "./shape-3d-params.js";

export interface Shape3dSettingsState {
	types: Shape3dTypes;
	limits: Shape3dLimits;
}

export interface Shape3dSettings {
	get(): Shape3dSettingsState;
	subscribe(listener: () => void): () => void;
	registerType(type: string, config: Shape3dTypeConfig): () => void;
	setLimits(limits: Partial<Shape3dLimits>): void;
}

export function createShape3dSettings(init: {
	types?: Shape3dTypes;
	limits?: Partial<Shape3dLimits>;
}): Shape3dSettings {
	const base = mergeShape3dTypes(DEFAULT_SHAPE_3D_TYPES, init.types);
	// Runtime registrations, in order (a later one for the same type wins).
	const runtime: { type: string; config: Shape3dTypeConfig }[] = [];
	const listeners = new Set<() => void>();
	let state: Shape3dSettingsState = {
		types: base,
		limits: sanitizeLimits({ ...DEFAULT_SHAPE_3D_LIMITS, ...init.limits }),
	};
	const notify = () => {
		for (const l of [...listeners]) l();
	};
	const rebuildTypes = () => {
		let types = base;
		for (const r of runtime) types = mergeShape3dTypes(types, { [r.type]: r.config });
		state = { ...state, types };
		notify();
	};
	return {
		get: () => state,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		registerType(type, config) {
			const entry = { type, config };
			runtime.push(entry);
			rebuildTypes();
			return () => {
				const i = runtime.indexOf(entry);
				if (i < 0) return;
				runtime.splice(i, 1);
				rebuildTypes();
			};
		},
		setLimits(limits) {
			const next = sanitizeLimits({ ...state.limits, ...limits });
			const prev = state.limits;
			if (
				next.minPx === prev.minPx &&
				next.maxCount === prev.maxCount &&
				next.collisionIn3dOnly === prev.collisionIn3dOnly &&
				next.groundFlat === prev.groundFlat
			) {
				return;
			}
			state = { ...state, limits: next };
			notify();
		},
	};
}

function sanitizeLimits(l: Shape3dLimits): Shape3dLimits {
	return {
		minPx: Number.isFinite(l.minPx) && l.minPx >= 0 ? l.minPx : DEFAULT_SHAPE_3D_LIMITS.minPx,
		maxCount:
			Number.isFinite(l.maxCount) && l.maxCount >= 0
				? Math.floor(l.maxCount)
				: DEFAULT_SHAPE_3D_LIMITS.maxCount,
		collisionIn3dOnly:
			typeof l.collisionIn3dOnly === "boolean"
				? l.collisionIn3dOnly
				: DEFAULT_SHAPE_3D_LIMITS.collisionIn3dOnly,
		groundFlat:
			typeof l.groundFlat === "boolean" ? l.groundFlat : DEFAULT_SHAPE_3D_LIMITS.groundFlat,
	};
}
