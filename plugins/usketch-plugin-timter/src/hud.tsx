import type { ServerClock } from "@edv4h/usketch-sync";
import { useEffect, useReducer, useState, useSyncExternalStore } from "react";
import { displayMs, formatDuration, isDone, type TimerEntry } from "./timer-model.js";
import type { TimtersStore } from "./timters-store.js";

export interface TimterController {
	createCountdown(minutes: number): void;
	createStopwatch(): void;
	start(id: string): void;
	pause(id: string): void;
	reset(id: string): void;
	remove(id: string): void;
}

let styleInjected = false;
function injectStyle() {
	if (styleInjected || typeof document === "undefined") return;
	styleInjected = true;
	const style = document.createElement("style");
	style.textContent = `
		@keyframes usketch-timter-flash {
			0%, 100% { background: #fee2e2; }
			50% { background: #fca5a5; }
		}
	`;
	document.head.appendChild(style);
}

const btn: React.CSSProperties = {
	border: "none",
	borderRadius: 6,
	padding: "4px 8px",
	fontSize: 12,
	fontFamily: "system-ui, sans-serif",
	cursor: "pointer",
	background: "#e5e7eb",
	color: "#1f2937",
	lineHeight: 1,
};

function TimerRow({
	entry,
	serverNow,
	controller,
}: {
	entry: TimerEntry;
	serverNow: number;
	controller: TimterController;
}) {
	const ms = displayMs(entry, serverNow);
	const done = entry.type === "countdown" && isDone(entry, serverNow);
	const icon = entry.type === "countdown" ? "⏳" : "⏱";

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "6px 8px",
				borderRadius: 8,
				background: done ? "#fee2e2" : "#f9fafb",
				animation: done ? "usketch-timter-flash 1s ease-in-out infinite" : undefined,
			}}
		>
			<span style={{ fontSize: 14 }}>{icon}</span>
			<span
				style={{
					fontVariantNumeric: "tabular-nums",
					fontSize: 18,
					fontWeight: 600,
					minWidth: 68,
					color: done ? "#b91c1c" : "#111827",
				}}
			>
				{formatDuration(ms)}
			</span>
			{entry.running ? (
				<button
					type="button"
					style={btn}
					onClick={() => controller.pause(entry.id)}
					title="一時停止"
				>
					⏸
				</button>
			) : (
				<button type="button" style={btn} onClick={() => controller.start(entry.id)} title="開始">
					▶
				</button>
			)}
			<button type="button" style={btn} onClick={() => controller.reset(entry.id)} title="リセット">
				↺
			</button>
			<button
				type="button"
				style={{ ...btn, background: "transparent", color: "#9ca3af" }}
				onClick={() => controller.remove(entry.id)}
				title="削除"
			>
				✕
			</button>
		</div>
	);
}

export function TimterHud({
	store,
	serverClock,
	controller,
}: {
	store: TimtersStore;
	serverClock: ServerClock;
	controller: TimterController;
}) {
	injectStyle();
	const entries = useSyncExternalStore(store.subscribe, store.getAll);
	const [, tick] = useReducer((n: number) => n + 1, 0);
	const [adding, setAdding] = useState(false);
	const [minutes, setMinutes] = useState(5);

	// Re-render ~4×/s so running timers count down smoothly (display only).
	useEffect(() => {
		const id = setInterval(tick, 250);
		return () => clearInterval(id);
	}, []);

	const serverNow = serverClock.now();

	if (entries.length === 0 && !adding) {
		return (
			<button
				type="button"
				style={{ ...btn, position: "fixed", left: 16, bottom: 16, padding: "8px 12px" }}
				onClick={() => setAdding(true)}
			>
				⏱ タイマー
			</button>
		);
	}

	return (
		<div
			style={{
				position: "fixed",
				left: 16,
				bottom: 16,
				width: 260,
				display: "flex",
				flexDirection: "column",
				gap: 6,
				padding: 10,
				borderRadius: 12,
				background: "rgba(255,255,255,0.95)",
				boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
				fontFamily: "system-ui, sans-serif",
				pointerEvents: "auto",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Timers</span>
				<button type="button" style={btn} onClick={() => setAdding((v) => !v)}>
					{adding ? "×" : "＋"}
				</button>
			</div>

			{adding && (
				<div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
					<input
						type="number"
						min={1}
						max={180}
						value={minutes}
						onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
						style={{
							width: 52,
							padding: "4px 6px",
							fontSize: 12,
							borderRadius: 6,
							border: "1px solid #d1d5db",
						}}
					/>
					<button
						type="button"
						style={{ ...btn, background: "#dbeafe" }}
						onClick={() => {
							controller.createCountdown(minutes);
							setAdding(false);
						}}
					>
						⏳ カウントダウン
					</button>
					<button
						type="button"
						style={{ ...btn, background: "#dcfce7" }}
						onClick={() => {
							controller.createStopwatch();
							setAdding(false);
						}}
					>
						⏱ ストップウォッチ
					</button>
				</div>
			)}

			{entries.map((entry) => (
				<TimerRow key={entry.id} entry={entry} serverNow={serverNow} controller={controller} />
			))}
		</div>
	);
}
