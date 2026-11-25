import {
	DEFAULT_GEN,
	DEFAULT_WATER_RATIO,
	ELEVATION_FIELD_ID,
	getElevationField,
	makeFieldShape,
} from "@edv4h/usketch-plugin-elevation";
import type { BoardStore } from "@edv4h/usketch-shared";
import type { PageMeta } from "@edv4h/usketch-sync";

/**
 * ページのプリセット: ページに入れるプラグインの組（カタログの id）。ベース（カタログの
 * `base: true`）はどのプリセットにも入るので、ここには書かない。ページは作るときにプリセットを
 * 選び（`PageMeta.preset`）、あとから 1 つずつ足し引きできる（`PageMeta.plugins`）。
 *
 * 名前は 2026-11-22 に決めたもの（#1558）。1 エントリ足せばプリセットが増える。
 */
export type PresetId = "whiteboard" | "map" | "map-terrain" | "boardgame";

export interface PagePreset {
	id: PresetId;
	label: string;
	plugins: readonly string[];
	/**
	 * 空のページを初めて開いたときに 1 回だけ置くもの（標高の地形など）。何人が同時に開いても
	 * 同じものになるよう、ページの id から決める。
	 */
	setupEmptyPage?: (store: BoardStore, pageId: string) => void;
}

/** 地図のページで、みんなが使う人どうしのやりとり（接続の無いボードでは一部が外れる）。 */
const SOCIAL = [
	"spotlight",
	"follow-me",
	"presence-cursor",
	"avatar",
	"side-panel",
	"activity-feed",
	"comments",
	"community-chat",
	"whistle",
	"history",
	"voting",
	"effect-ripple",
	"reactions",
	"spatial-chat",
] as const;

/** ページの id から地形のシードを作る（同じページなら誰が開いても同じ地形）。 */
export function seedFromPageId(pageId: string): number {
	let hash = 2166136261;
	for (let i = 0; i < pageId.length; i++) {
		hash ^= pageId.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) % 100000;
}

/** 標高の場（無限地形）を置く。もうあれば何もしない。置いたら true。 */
export function placeTerrain(store: BoardStore, seed: number): boolean {
	if (getElevationField(store)) return false;
	store.addShape(
		makeFieldShape(ELEVATION_FIELD_ID, {
			seed,
			gen: DEFAULT_GEN,
			waterLevel: Math.round(DEFAULT_GEN.relief * DEFAULT_WATER_RATIO),
		}),
	);
	return true;
}

export const PAGE_PRESETS: Readonly<Record<PresetId, PagePreset>> = {
	whiteboard: {
		id: "whiteboard",
		label: "ホワイトボード",
		plugins: [
			"tool-vim",
			"edge-pan",
			"shape-basic",
			"shape-group",
			"shape-frame",
			"shape-connector",
			"shape-freedraw",
			"shape-text",
			"shape-markdown",
			"shape-sticky",
			"shape-card",
			"shape-image",
			"pdf-import",
			"shape-counter",
			"shape-wireframe",
			"domain-design",
			"snap",
			"free-position",
			"container",
			"tabletop",
			"dashboard",
			"window-system",
			"elevation",
			"mode7",
			"shape-3d",
			"scatter",
			"export",
			"gpu-renderer",
			"laser",
			"spotlight",
			"follow-me",
			"presence-cursor",
			"presence-activity",
			"presence-enhanced",
			"side-panel",
			"comments",
			"history",
			"ai",
			"whistle",
			"activity-feed",
			"session",
			"character",
			"timter",
			"croupier",
			"portal",
			"shape-embed",
			"presentation",
		],
	},
	// タイルの地形（海に陸を塗る）を歩くマップ。ボードへのゲートを置ける。
	map: {
		id: "map",
		label: "マップ",
		plugins: [
			"shape-group",
			"shape-board-portal",
			// ゲートを選ぶと行き先を出し、開ける（ページを指すゲートはページを移る）
			"board-info-panel",
			"map",
			"mode7",
			"shape-3d",
			...SOCIAL,
			"keyboard-shortcuts",
			"canvas-filter",
			"character",
		],
	},
	// 標高（連続した高さ）の無限地形を歩くマップ。タイルのマップとは一緒に使えない。
	"map-terrain": {
		id: "map-terrain",
		label: "地形マップ",
		plugins: [
			"shape-group",
			"elevation",
			"mode7",
			"shape-3d",
			...SOCIAL,
			"keyboard-shortcuts",
			"character",
		],
		setupEmptyPage: (store, pageId) => {
			placeTerrain(store, seedFromPageId(pageId));
		},
	},
	// ココフォリアのように、ルールを持たずに卓上で自由に遊ぶ: 置き場（tabletop + 入れ物）・
	// 山札と手札（カード）・画像（駒や背景）・カウンター・タイマー・チャット。ルールのある
	// ゲーム（croupier）は入れず、使うときに 1 つ足す。
	boardgame: {
		id: "boardgame",
		label: "ボードゲーム",
		plugins: [
			"shape-basic",
			"shape-group",
			"shape-text",
			"shape-sticky",
			"shape-card",
			"shape-image",
			"shape-counter",
			"snap",
			"free-position",
			"container",
			"tabletop",
			"laser",
			"spotlight",
			"follow-me",
			"presence-cursor",
			"presence-activity",
			"side-panel",
			"community-chat",
			"reactions",
			"timter",
		],
	},
};

export const PRESET_IDS = Object.keys(PAGE_PRESETS) as PresetId[];

export function isPresetId(value: unknown): value is PresetId {
	return typeof value === "string" && Object.hasOwn(PAGE_PRESETS, value);
}

/** プリセットのプラグイン（ベースを除く）。 */
export function presetPlugins(id: PresetId): ReadonlySet<string> {
	return new Set(PAGE_PRESETS[id].plugins);
}

/** ページのプリセット（無い・知らない名前なら `fallback`）。 */
export function pagePreset(page: PageMeta | null, fallback: PresetId): PresetId {
	return isPresetId(page?.preset) ? page.preset : fallback;
}

/**
 * ページが使うプラグイン（ベースを除く）。ページに `plugins` があればそれ、無ければ
 * プリセットのもの。ページを使わないボード（page が null）は `fallback` のプリセット。
 */
export function pagePlugins(page: PageMeta | null, fallback: PresetId): string[] {
	if (page?.plugins) return [...page.plugins];
	return [...PAGE_PRESETS[pagePreset(page, fallback)].plugins];
}
