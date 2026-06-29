import type { Point } from "@edv4h/usketch-shared";
import type { VimMode } from "../machine/types.js";

/** UI レイヤーが描画に必要とする machine 状態のフラットなスナップショット。 */
export interface VimSnapshot {
	/** vim ツールがアクティブか（非アクティブなら全 UI を隠す）。 */
	active: boolean;
	mode: VimMode;
	visualMulti: boolean;
	cursor: Point;
	count: number | null;
	inputBuffer: string;
	candidates: { alias: string; label: string }[];
	candidateIndex: number;
	/** 選択中候補のゴースト寸法（insert のプレビュー用）。 */
	ghost: { width: number; height: number; label: string } | null;
	commandBuffer: string;
	whichKeyVisible: boolean;
	helpVisible: boolean;
	/** hop ラベル（world 座標 + 現在の入力にマッチするか）。 */
	hopTargets: { label: string; cx: number; cy: number; matched: boolean }[];
	/** hop で入力済みのラベル文字。 */
	hopBuffer: string;
	lastMessage: string | null;
	registerCount: number;
}

export const INITIAL_SNAPSHOT: VimSnapshot = {
	active: false,
	mode: "normal",
	visualMulti: false,
	cursor: { x: 0, y: 0 },
	count: null,
	inputBuffer: "",
	candidates: [],
	candidateIndex: 0,
	ghost: null,
	commandBuffer: "",
	whichKeyVisible: false,
	helpVisible: false,
	hopTargets: [],
	hopBuffer: "",
	lastMessage: null,
	registerCount: 0,
};

export interface VimUiStore {
	getSnapshot(): VimSnapshot;
	subscribe(listener: () => void): () => void;
	set(snapshot: VimSnapshot): void;
}

/** useSyncExternalStore 互換の最小外部ストア。 */
export function createVimUiStore(): VimUiStore {
	let snapshot = INITIAL_SNAPSHOT;
	const listeners = new Set<() => void>();
	return {
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		set(next) {
			snapshot = next;
			for (const l of listeners) l();
		},
	};
}
