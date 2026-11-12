// freedraw のホスト向け API（`ctx.services`）。ペンの一覧と、今のペン・色・太さを読む
// （ペンを足すのは `createFreedrawPlugin(config, { pens })`、変えるのは `freedraw:set-*` イベント）。
import { defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import { listPenDefinitions, onPensChange, type PenSizeRange } from "./custom-pens.js";
import { PEN_KINDS, PEN_META } from "./pen-meta.js";
import { type FreedrawMode, type FreedrawSettingsStore, penSize } from "./settings-store.js";
import type { PenId } from "./types.js";

/** ペン選択 UI 向けの、ペン 1 種の情報。 */
export interface FreedrawPenInfo {
	id: PenId;
	label: string;
	defaultSize: number;
	sizeRange?: PenSizeRange;
	/** 色を使うか。 */
	usesColor: boolean;
	/** 組み込みのペンか。 */
	builtIn: boolean;
}

/** 今の描き方。設定を保存している（`persistSettings`）なら、前回の値から始まる。 */
export interface FreedrawCurrentSettings {
	mode: FreedrawMode;
	pen: PenId;
	color: string;
	/** 今のペンの太さ（消しゴム中でもペンの太さ）。 */
	size: number;
	eraserSize: number;
}

export interface FreedrawApi {
	/** 選べるペン（組み込み → 外から足したペンの登録順）。 */
	listPens(): FreedrawPenInfo[];
	/** ペンの登録が変わったら呼ぶ。戻り値で解除。 */
	onPensChange(listener: () => void): () => void;
	/** 今のペン・色・太さ。ホストのペン選択 UI を freedraw に合わせるのに使う。 */
	getSettings(): FreedrawCurrentSettings;
	/** ペン・色・太さ・モードが変わったら呼ぶ。戻り値で解除。 */
	onSettingsChange(listener: () => void): () => void;
}

/** 組み込み + 登録済みのペンの一覧。 */
export function listPens(): FreedrawPenInfo[] {
	const builtIn: FreedrawPenInfo[] = PEN_KINDS.map((id) => ({
		id,
		label: PEN_META[id].label,
		defaultSize: PEN_META[id].defaultSize,
		usesColor: true,
		builtIn: true,
	}));
	const custom: FreedrawPenInfo[] = listPenDefinitions().map((d) => ({
		id: d.id,
		label: d.label,
		defaultSize: d.defaultSize,
		...(d.sizeRange ? { sizeRange: d.sizeRange } : {}),
		usesColor: d.usesColor !== false,
		builtIn: false,
	}));
	return [...builtIn, ...custom];
}

/** プラグインの設定ストアにつないだ API。`setup` ごとに作る。 */
export function createFreedrawApi(settings: FreedrawSettingsStore): FreedrawApi {
	const current = (): FreedrawCurrentSettings => {
		const s = settings.getSnapshot();
		return {
			mode: s.mode,
			pen: s.pen,
			color: s.color,
			size: penSize(s, s.pen),
			eraserSize: s.eraserSize,
		};
	};
	const same = (a: FreedrawCurrentSettings, b: FreedrawCurrentSettings) =>
		a.mode === b.mode &&
		a.pen === b.pen &&
		a.color === b.color &&
		a.size === b.size &&
		a.eraserSize === b.eraserSize;
	return {
		listPens,
		onPensChange,
		getSettings: current,
		onSettingsChange(listener) {
			// getSettings() の値が変わったときだけ呼ぶ（カスタム色の追加などでは呼ばない）。
			let last = current();
			return settings.subscribe(() => {
				const next = current();
				if (same(last, next)) return;
				last = next;
				listener();
			});
		},
	};
}

/** freedraw の API のサービス。`setup` で provide する。 */
export const freedrawService = defineService<FreedrawApi>("usketch-plugin-shape-freedraw");

/** ホスト用: `getFreedrawApi(app.services)?.listPens()`。freedraw が無ければ `undefined`。 */
export function getFreedrawApi(services: ServiceRegistry): FreedrawApi | undefined {
	return freedrawService.get(services);
}
