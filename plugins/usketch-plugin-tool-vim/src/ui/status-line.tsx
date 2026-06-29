import { useSyncExternalStore } from "react";
import type { VimMode } from "../machine/types.js";
import type { VimUiStore } from "./vim-ui-store.js";

const MODE_COLOR: Record<VimMode, string> = {
	normal: "#3b82f6",
	insert: "#10b981",
	visual: "#f59e0b",
	command: "#6366f1",
	hop: "#f9e2af",
};

function modeLabel(mode: VimMode, visualMulti: boolean): string {
	if (mode === "visual") return visualMulti ? "V-BLOCK" : "VISUAL";
	return mode.toUpperCase();
}

/** 画面下部の Vim ステータスライン（fixed レイヤー）。 */
export function VimStatusLine({ store }: { store: VimUiStore }) {
	const s = useSyncExternalStore(store.subscribe, store.getSnapshot);
	if (!s.active) return null;

	return (
		<div
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom: 0,
				height: 26,
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "0 10px",
				background: "#11111b",
				color: "#cdd6f4",
				font: "12px ui-monospace, SFMono-Regular, Menlo, monospace",
				borderTop: "1px solid #313244",
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			<span
				style={{
					background: MODE_COLOR[s.mode],
					color: "#0b0b12",
					fontWeight: 700,
					padding: "2px 8px",
					borderRadius: 3,
				}}
			>
				{modeLabel(s.mode, s.visualMulti)}
			</span>

			{s.mode === "command" ? (
				<span style={{ flex: 1 }}>
					:{s.commandBuffer}
					<span style={{ opacity: 0.6 }}>▏</span>
				</span>
			) : s.mode === "hop" ? (
				<span style={{ flex: 1, opacity: 0.85 }}>
					hop → {s.hopBuffer || "ラベルを入力"}（{s.hopTargets.length} 個）
				</span>
			) : (
				<span style={{ flex: 1, opacity: 0.85 }}>
					{s.mode === "insert" && s.inputBuffer ? `⟶ ${s.inputBuffer}` : (s.lastMessage ?? "")}
				</span>
			)}

			<span style={{ opacity: 0.6 }}>
				{`@ ${Math.round(s.cursor.x)},${Math.round(s.cursor.y)}`}
			</span>
			{s.registerCount > 0 && <span style={{ opacity: 0.6 }}>{`"${s.registerCount}`}</span>}
			{s.count != null && <span style={{ opacity: 0.9 }}>{s.count}</span>}
		</div>
	);
}
