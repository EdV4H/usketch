/**
 * ページのプリセット: ページに入れるプラグインの組（カタログの id）。ベース（カタログの
 * `base: true`）はどのプリセットにも入るので、ここには書かない。
 *
 * 今はホストが開く画面ごとにプリセットを選ぶ（ボード = whiteboard、地域 = map）。
 * ページごとにプリセットとプラグインを持つのは次の段（#1558 R5）。
 */
export type PresetId = "whiteboard" | "map";

export interface PagePreset {
	id: PresetId;
	label: string;
	plugins: readonly string[];
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
	map: {
		id: "map",
		label: "マップ",
		plugins: [
			"shape-group",
			"shape-board-portal",
			"map",
			"elevation",
			"mode7",
			"shape-3d",
			"spotlight",
			"follow-me",
			"presence-cursor",
			"avatar",
			"side-panel",
			"activity-feed",
			"board-info-panel",
			"comments",
			"community-chat",
			"keyboard-shortcuts",
			"whistle",
			"canvas-filter",
			"history",
			"voting",
			"effect-ripple",
			"reactions",
			"spatial-chat",
			"character",
		],
	},
};

/** プリセットのプラグイン（ベースを除く）。 */
export function presetPlugins(id: PresetId): ReadonlySet<string> {
	return new Set(PAGE_PRESETS[id].plugins);
}
