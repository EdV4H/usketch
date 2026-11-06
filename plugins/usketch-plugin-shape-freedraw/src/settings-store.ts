import { type FreedrawConfig, STORAGE_KEY } from "./config.js";
import { clampPenSize, getPenDefinition } from "./custom-pens.js";
import { DEFAULT_PEN, isKnownPen, penMeta } from "./pen-meta.js";
import type { PenId } from "./types.js";

export type FreedrawMode = "pen" | "eraser";

export interface FreedrawSettings {
	mode: FreedrawMode;
	pen: PenId;
	color: string;
	/** ペンごとの太さ。外から足したペンは選ぶまで無いことがある（既定の太さを使う）。 */
	sizes: Partial<Record<PenId, number>>;
	eraserSize: number;
	brushDynamics: number;
	customColors: string[];
	cursorPreview: boolean;
}

export interface FreedrawSettingsStore {
	getSnapshot(): FreedrawSettings;
	subscribe(listener: () => void): () => void;
	update(patch: Partial<FreedrawSettings>): void;
	/** 現在の実効太さ（pen モード=現ペンの太さ / eraser モード=消しゴム）。 */
	currentSize(): number;
}

/** localStorage に永続化するサブセット（mode は永続化しない）。 */
interface PersistedSettings {
	pen: PenId;
	color: string;
	sizes: Partial<Record<PenId, number>>;
	eraserSize: number;
	brushDynamics: number;
	customColors: string[];
}

function loadPersisted(): Partial<PersistedSettings> | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const d = JSON.parse(raw);
		return typeof d === "object" && d !== null ? (d as Partial<PersistedSettings>) : null;
	} catch {
		return null;
	}
}

function savePersisted(s: FreedrawSettings): void {
	if (typeof localStorage === "undefined") return;
	try {
		const payload: PersistedSettings = {
			pen: s.pen,
			color: s.color,
			sizes: s.sizes,
			eraserSize: s.eraserSize,
			brushDynamics: s.brushDynamics,
			customColors: s.customColors,
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
	} catch {
		// クォータ超過等は握りつぶす（描画は継続）。設計書 §10。
	}
}

/** 既定のペン。設定の `defaultPen` が知らないペンなら ballpoint。 */
function defaultPen(config: FreedrawConfig): PenId {
	return isKnownPen(config.defaultPen) ? config.defaultPen : DEFAULT_PEN;
}

/** ペンの太さ（未設定なら既定の太さ）。外から足したペンは範囲に丸める。 */
export function penSize(s: Pick<FreedrawSettings, "sizes">, pen: PenId): number {
	return clampPenSize(getPenDefinition(pen), s.sizes[pen] ?? penMeta(pen).defaultSize);
}

export function createFreedrawSettingsStore(config: FreedrawConfig): FreedrawSettingsStore {
	const persisted = config.persistSettings ? loadPersisted() : null;
	let state: FreedrawSettings = {
		mode: "pen",
		// 保存したペンが今は無い（外から足したペンを登録しなくなった）ときは既定に戻す。
		pen: persisted?.pen && isKnownPen(persisted.pen) ? persisted.pen : defaultPen(config),
		color: persisted?.color ?? config.defaultColor,
		sizes: { ...config.defaultSizes, ...(persisted?.sizes ?? {}) },
		eraserSize: persisted?.eraserSize ?? config.defaultEraserSize,
		brushDynamics: persisted?.brushDynamics ?? config.brushDynamics,
		customColors: persisted?.customColors ?? [],
		cursorPreview: config.cursorPreview,
	};
	const listeners = new Set<() => void>();

	return {
		getSnapshot: () => state,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		update(patch) {
			state = { ...state, ...patch };
			if (config.persistSettings) savePersisted(state);
			for (const l of listeners) l();
		},
		currentSize() {
			if (state.mode === "eraser") return state.eraserSize;
			return penSize(state, state.pen);
		},
	};
}
