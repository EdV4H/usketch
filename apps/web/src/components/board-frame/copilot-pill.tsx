import { useApp } from "@edv4h/usketch-canvas-engine";
import { useEffect, useState } from "react";
import { I } from "../ui/index.js";

/**
 * 画面下中央の Toolbar 上に浮かぶ AI Copilot 通知 pill。
 * Copilot が ON で、最新の提案テキストがあるときだけ表示。
 */
export function CopilotPill() {
	const app = useApp();
	const [enabled, setEnabled] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [sidePanelOpen, setSidePanelOpen] = useState(false);

	useEffect(() => {
		const unsubs: (() => void)[] = [];
		unsubs.push(
			app.events.on<{ enabled: boolean }>("copilot:toggle", (ev) => {
				setEnabled(ev.enabled);
				if (!ev.enabled) setMessage(null);
			}),
		);
		unsubs.push(
			app.events.on<{ text: string }>("copilot:notice", (ev) => {
				setMessage(ev.text);
			}),
		);
		unsubs.push(app.events.on("side-panel:open", () => setSidePanelOpen(true)));
		unsubs.push(app.events.on("side-panel:close", () => setSidePanelOpen(false)));
		return () => {
			for (const u of unsubs) u();
		};
	}, [app]);

	if (!enabled || !message) return null;

	return (
		<div
			style={{
				position: "fixed",
				bottom: 70,
				left: `calc(50% - ${sidePanelOpen ? 150 : 0}px)`,
				transform: "translateX(-50%)",
				zIndex: 90,
				maxWidth: "calc(100vw - 40px)",
				pointerEvents: "none",
			}}
		>
			<div
				className="u-surface u-anim-in"
				style={{
					padding: "6px 8px 6px 7px",
					display: "flex",
					alignItems: "center",
					gap: 10,
					borderRadius: 999,
					background: "var(--bg-surface-raised)",
					border: "1px solid var(--brand-ring, rgba(139,92,246,.4))",
					boxShadow: "0 0 30px rgba(139, 92, 246, 0.25)",
					whiteSpace: "nowrap",
					pointerEvents: "auto",
					fontFamily: "var(--font-sans, system-ui)",
				}}
			>
				<div
					style={{
						width: 22,
						height: 22,
						borderRadius: 99,
						background: "var(--brand-gradient)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "white",
						animation: "u-pulse 2s infinite",
					}}
				>
					<I.sparkles size={11} />
				</div>
				<div style={{ fontSize: 11.5, color: "var(--fg-primary)" }}>
					<span style={{ fontWeight: 500 }}>Copilot</span>
					<span style={{ color: "var(--fg-tertiary)" }}>: {message}</span>
				</div>
				<div style={{ display: "flex", gap: 4 }}>
					<button type="button" style={copilotBtn(true)}>
						受け入れる
					</button>
					<button type="button" style={copilotBtn(false)} onClick={() => setMessage(null)}>
						却下
					</button>
				</div>
			</div>
		</div>
	);
}

function copilotBtn(primary: boolean): React.CSSProperties {
	return {
		padding: "4px 10px",
		background: primary ? "var(--brand-gradient)" : "transparent",
		color: primary ? "white" : "var(--fg-secondary)",
		border: primary ? "none" : "1px solid var(--border-subtle)",
		borderRadius: 6,
		cursor: "pointer",
		fontSize: 11,
		fontWeight: 500,
		fontFamily: "inherit",
		whiteSpace: "nowrap",
		flexShrink: 0,
	};
}
