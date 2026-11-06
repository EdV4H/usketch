// freedraw のホスト向け API（`ctx.services`）。外からペンを足す・ペンの一覧を読む。
import { defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import {
	type FreedrawPenDefinition,
	listPenDefinitions,
	onPensChange,
	type PenSizeRange,
	registerPen,
} from "./custom-pens.js";
import { PEN_KINDS, PEN_META } from "./pen-meta.js";
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

export interface FreedrawApi {
	/** 選べるペン（組み込み → 外から足したペンの登録順）。 */
	listPens(): FreedrawPenInfo[];
	/** ペンを足す。同じ id は置き換える。戻り値で外す。 */
	registerPen(def: FreedrawPenDefinition): () => void;
	/** ペンの登録が変わったら呼ぶ。戻り値で解除。 */
	onPensChange(listener: () => void): () => void;
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

export const freedrawApi: FreedrawApi = { listPens, registerPen, onPensChange };

/** freedraw の API のサービス。`setup` で provide する。 */
export const freedrawService = defineService<FreedrawApi>("usketch-plugin-shape-freedraw");

/** ホスト用: `getFreedrawApi(app.services)?.listPens()`。freedraw が無ければ `undefined`。 */
export function getFreedrawApi(services: ServiceRegistry): FreedrawApi | undefined {
	return freedrawService.get(services);
}
