import type { Viewport } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import type { VimUiStore } from "./vim-ui-store.js";

interface Props {
	store: VimUiStore;
	viewport: Viewport;
}

/**
 * キャンバス上のオーバーレイ（fixed レイヤー）。
 * 論理カーソルの十字、insert モードのゴースト shape、候補ポップアップを描画する。
 * world 座標 → screen 座標は viewport から手計算する（キャンバスエンジン非依存）。
 */
export function VimOverlay({ store, viewport }: Props) {
	const s = useSyncExternalStore(store.subscribe, store.getSnapshot);
	if (!s.active) return null;

	const sx = s.cursor.x * viewport.zoom + viewport.x;
	const sy = s.cursor.y * viewport.zoom + viewport.y;
	const showGhost = s.mode === "insert" && s.ghost !== null;

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
			{/* hop ラベル */}
			{s.mode === "hop" &&
				s.hopTargets.map((t) => {
					const tx = t.cx * viewport.zoom + viewport.x;
					const ty = t.cy * viewport.zoom + viewport.y;
					const rest = t.matched ? t.label.slice(s.hopBuffer.length) : t.label;
					return (
						<div
							key={t.label}
							style={{
								position: "absolute",
								left: tx,
								top: ty,
								transform: "translate(-50%, -50%)",
								font: "700 13px ui-monospace, monospace",
								padding: "1px 5px",
								borderRadius: 4,
								background: t.matched ? "#f9e2af" : "#45475a",
								color: t.matched ? "#11111b" : "#7f849c",
								opacity: t.matched ? 1 : 0.5,
								boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
							}}
						>
							{/* 入力済みプレフィックスを薄く、残りを濃く */}
							{s.hopBuffer && t.matched && <span style={{ opacity: 0.45 }}>{s.hopBuffer}</span>}
							{rest}
						</div>
					);
				})}

			{/* 十字カーソル */}
			<div
				style={{
					position: "absolute",
					left: sx - 8,
					top: sy - 1,
					width: 16,
					height: 2,
					background: "#7c3aed",
					opacity: 0.9,
				}}
			/>
			<div
				style={{
					position: "absolute",
					left: sx - 1,
					top: sy - 8,
					width: 2,
					height: 16,
					background: "#7c3aed",
					opacity: 0.9,
				}}
			/>
			<div
				style={{
					position: "absolute",
					left: sx - 5,
					top: sy - 5,
					width: 10,
					height: 10,
					border: "1.5px solid #7c3aed",
					borderRadius: 2,
					boxShadow: "0 0 0 1px rgba(255,255,255,0.6)",
				}}
			/>

			{/* insert ゴースト */}
			{showGhost && s.ghost && (
				<>
					<div
						style={{
							position: "absolute",
							left: sx,
							top: sy,
							width: s.ghost.width * viewport.zoom,
							height: s.ghost.height * viewport.zoom,
							border: "2px dashed #7c3aed",
							background: "rgba(124,58,237,0.08)",
							borderRadius: 4,
						}}
					/>
					<div
						style={{
							position: "absolute",
							left: sx,
							top: sy - 20,
							font: "12px ui-monospace, monospace",
							color: "#7c3aed",
							background: "rgba(255,255,255,0.85)",
							padding: "1px 6px",
							borderRadius: 4,
							whiteSpace: "nowrap",
						}}
					>
						{s.ghost.label}
					</div>
				</>
			)}

			{/* 候補ポップアップ */}
			{s.mode === "insert" && s.candidates.length > 0 && (
				<div
					style={{
						position: "absolute",
						left: sx,
						top: sy + (showGhost && s.ghost ? s.ghost.height * viewport.zoom + 8 : 20),
						minWidth: 160,
						maxHeight: 200,
						overflow: "hidden",
						background: "#1e1e2e",
						color: "#e5e7eb",
						borderRadius: 6,
						boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
						font: "12px ui-monospace, monospace",
					}}
				>
					{s.candidates.slice(0, 8).map((c, i) => (
						<div
							key={c.alias}
							style={{
								display: "flex",
								justifyContent: "space-between",
								gap: 12,
								padding: "4px 10px",
								background: i === s.candidateIndex ? "#7c3aed" : "transparent",
							}}
						>
							<span>{c.alias}</span>
							<span style={{ opacity: 0.6 }}>{c.label}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
