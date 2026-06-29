import { useSyncExternalStore } from "react";
import type { VimMode } from "../machine/types.js";
import type { VimUiStore } from "./vim-ui-store.js";

const HINTS: Record<VimMode, [string, string][]> = {
	normal: [
		["h j k l", "カーソル移動"],
		["H J K L", "画角を移動 (pan)"],
		["0-9", "回数 (例 5j)"],
		["i", "insert モード"],
		["v / V", "visual / 複数選択"],
		[":", "コマンド"],
		["x / d", "削除  y / p  ヤンク/貼付"],
		["u / C-r", "undo / redo"],
		["+ / -", "ズーム  zz ビューを寄せる"],
		["M", "カーソルを画面中央へ"],
		["f", "hop（ラベルジャンプ）"],
		["gg / G", "最初 / 最後の shape"],
		["m{a-z} / `{a-z}", "マーク設定 / ジャンプ"],
		["?", "このヘルプを閉じる"],
	],
	insert: [
		["a-z…", "shape 名を入力"],
		["Tab", "候補を切替"],
		["Enter", "カーソル位置に追加"],
		["Esc", "normal へ戻る"],
	],
	visual: [
		["h j k l", "最近傍の shape へ選択を移動"],
		["V", "複数選択モード"],
		["d / x", "削除  y ヤンク"],
		["Esc", "選択解除して normal へ"],
	],
	hop: [
		["ラベル文字", "その shape へカーソルをジャンプ"],
		["Esc", "キャンセル"],
	],
	command: [
		[":q", "Vim を抜ける"],
		[":tool <id>", "ツール切替"],
		[":set bg=dots|grid|none", "背景"],
		[":zoom <n>", "ズーム  :export <fmt>  書き出し"],
		[":help", "ヘルプ"],
	],
};

/** 現在モードの利用可能キー一覧（fixed レイヤー、`?` でトグル）。 */
export function VimWhichKey({ store }: { store: VimUiStore }) {
	const s = useSyncExternalStore(store.subscribe, store.getSnapshot);
	if (!s.active || !s.whichKeyVisible) return null;
	const hints = HINTS[s.mode];

	return (
		<div
			style={{
				position: "absolute",
				right: 12,
				bottom: 38,
				width: 320,
				background: "#181825",
				color: "#cdd6f4",
				borderRadius: 8,
				border: "1px solid #313244",
				boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
				font: "12px ui-monospace, monospace",
				padding: "8px 0",
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			<div
				style={{
					padding: "2px 12px 6px",
					opacity: 0.6,
					textTransform: "uppercase",
					letterSpacing: 1,
				}}
			>
				{s.mode} keys
			</div>
			{hints.map(([keys, desc]) => (
				<div key={keys} style={{ display: "flex", gap: 10, padding: "3px 12px" }}>
					<span style={{ color: "#a6e3a1", minWidth: 110, whiteSpace: "nowrap" }}>{keys}</span>
					<span style={{ opacity: 0.85 }}>{desc}</span>
				</div>
			))}
		</div>
	);
}
