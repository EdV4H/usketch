import { useSyncExternalStore } from "react";
import type { VimUiStore } from "./vim-ui-store.js";

type Row = [string, string];
interface Section {
	title: string;
	rows: Row[];
}

const SECTIONS: Section[] = [
	{
		title: "NORMAL",
		rows: [
			["h j k l", "カーソル移動"],
			["{count}j", "回数指定 (例 5j)"],
			["H J K L", "画角を移動 (pan)"],
			["i", "insert モードへ"],
			["v / V", "visual / 複数選択へ"],
			[":", "command モードへ"],
			["x / d", "削除 (選択 or カーソル最近傍)"],
			["y / p", "ヤンク / 貼り付け"],
			["u / Ctrl+r", "undo / redo"],
			["+ / -", "ズーム イン / アウト"],
			["zz", "ビューポートをカーソルへ寄せる"],
			["M", "カーソルを画面中央へ"],
			["f", "hop: ラベルを表示しジャンプ"],
			["gg / G", "最初 / 最後の shape へ"],
			["m{a-z}", "マークを設定"],
			["`{a-z}", "マークへジャンプ"],
			["?", "which-key ヒントの表示切替"],
		],
	},
	{
		title: "INSERT",
		rows: [
			["a-z…", "shape 名を入力 (候補表示)"],
			["Tab / S-Tab", "候補を次 / 前へ"],
			["Enter", "カーソル位置に shape 追加"],
			["Esc", "normal へ戻る"],
		],
	},
	{
		title: "VISUAL",
		rows: [
			["(入った時)", "カーソル最近傍を選択"],
			["h j k l", "方向最近傍へ選択を移動"],
			["V", "複数選択モードへ"],
			["d / x", "選択を削除"],
			["y", "選択をヤンク"],
			["Esc", "選択解除して normal へ"],
		],
	},
	{
		title: "COMMAND ( : )",
		rows: [
			[":q / :wq", "Vim を抜ける"],
			[":tool <id>", "ツールを切替"],
			[":set bg=dots|grid|none", "背景を変更"],
			[":zoom <n>", "ズーム率を指定"],
			[":center", "カーソルを画面中央へ"],
			[":export <fmt>", "png / svg / json で書き出し"],
			[":help", "このヘルプの表示切替"],
		],
	},
];

/** `:help` で開く全画面ヘルプ（fixed レイヤー）。Esc または再度 :help で閉じる。 */
export function VimHelpOverlay({ store }: { store: VimUiStore }) {
	const s = useSyncExternalStore(store.subscribe, store.getSnapshot);
	if (!s.active || !s.helpVisible) return null;

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "rgba(10,10,18,0.55)",
				backdropFilter: "blur(2px)",
				pointerEvents: "none",
				zIndex: 1,
			}}
		>
			<div
				style={{
					width: "min(880px, 92vw)",
					maxHeight: "82vh",
					overflow: "auto",
					background: "#181825",
					color: "#cdd6f4",
					border: "1px solid #313244",
					borderRadius: 12,
					boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
					font: "13px ui-monospace, SFMono-Regular, Menlo, monospace",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "baseline",
						justifyContent: "space-between",
						padding: "14px 20px",
						borderBottom: "1px solid #313244",
					}}
				>
					<strong style={{ fontSize: 15, letterSpacing: 1 }}>uSketch Vim — Help</strong>
					<span style={{ opacity: 0.6 }}>Esc または :help で閉じる</span>
				</div>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
						gap: 4,
						padding: "12px 8px 18px",
					}}
				>
					{SECTIONS.map((section) => (
						<div key={section.title} style={{ padding: "8px 12px" }}>
							<div
								style={{
									color: "#f9e2af",
									opacity: 0.9,
									letterSpacing: 1,
									margin: "4px 0 8px",
								}}
							>
								{section.title}
							</div>
							{section.rows.map(([keys, desc]) => (
								<div key={keys} style={{ display: "flex", gap: 12, padding: "2px 0" }}>
									<span style={{ color: "#a6e3a1", minWidth: 150, whiteSpace: "nowrap" }}>
										{keys}
									</span>
									<span style={{ opacity: 0.85 }}>{desc}</span>
								</div>
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
