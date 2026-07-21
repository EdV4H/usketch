import type { PluginContext, ShapeData } from "@edv4h/usketch-shared";
import type { ServerClock } from "@edv4h/usketch-sync";
import { useEffect, useRef, useState } from "react";
import type { EmbedDefinition, ResolvedEmbed } from "./embed-defs.js";
import { resolveEmbed } from "./embed-defs.js";
import { emitEmbedAction } from "./embed-events.js";
import { DRIFT_THRESHOLD_S, needsCorrection, playbackFrom, projectTime } from "./playback.js";
import { createYouTubePlayer, type EmbedPlayer } from "./players/youtube.js";
import type { EmbedShapeData } from "./types.js";

/** Per-plugin-instance runtime, passed into the shape view as a prop (no globals,
 * so multiple boards / StrictMode remounts don't clobber each other). */
export interface EmbedRuntime {
	store: PluginContext["store"];
	serverClock: ServerClock;
	userId: string;
	defs: EmbedDefinition[];
	Chrome: EmbedChrome;
}

const canControl = (data: EmbedShapeData, userId: string): boolean =>
	data.syncMode !== "presenter" || data.presenterId === userId;

const btn: React.CSSProperties = {
	border: "none",
	background: "rgba(255,255,255,0.15)",
	color: "#fff",
	cursor: "pointer",
	fontSize: 12,
	lineHeight: 1,
	padding: "3px 7px",
	borderRadius: 5,
	pointerEvents: "auto",
};
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function EmbedView({ data, rt }: { data: EmbedShapeData; rt: EmbedRuntime }) {
	// `rt` is always supplied in normal use; the optional-chaining guards keep a
	// stale-HMR render from throwing (renders a harmless empty state instead).
	const resolved = data.url && rt ? resolveEmbed(data.url, rt.defs) : null;
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const playerRef = useRef<EmbedPlayer | null>(null);
	const playbackRef = useRef(data.playback);
	playbackRef.current = data.playback;
	const [urlDraft, setUrlDraft] = useState("");

	const syncable = resolved?.def.syncable === true;

	// Create the synced player when a syncable iframe mounts.
	// biome-ignore lint/correctness/useExhaustiveDependencies: recreate only on shape/embed change
	useEffect(() => {
		if (!syncable || !iframeRef.current || !rt) return;
		const player = createYouTubePlayer(iframeRef.current);
		playerRef.current = player;
		player.onUserAction(() => {
			const cur = rt.store.getShape(data.id) as EmbedShapeData | undefined;
			if (!cur || !canControl(cur, rt.userId)) return;
			const st = player.getState();
			if (!st) return;
			// Ignore state changes that merely converge to the already-synced state —
			// that's our own applied correction echoing back, not a genuine user
			// action — otherwise followers would re-broadcast and oscillate.
			const pb = playbackRef.current;
			if (pb && !needsCorrection(pb, rt.serverClock.now(), st)) return;
			rt.store.updateShape(data.id, {
				playback: playbackFrom(st, rt.serverClock.now(), rt.userId),
			} as Partial<ShapeData>);
		});
		return () => {
			player.destroy();
			playerRef.current = null;
		};
	}, [syncable, data.id, resolved?.embedUrl]);

	// Drift-correct the local player toward the synced playback state.
	useEffect(() => {
		if (!syncable || !rt) return;
		const iv = setInterval(() => {
			const player = playerRef.current;
			const pb = playbackRef.current;
			if (!player || !pb) return;
			const st = player.getState();
			if (!st || !needsCorrection(pb, rt.serverClock.now(), st)) return;
			const target = projectTime(pb, rt.serverClock.now());
			if (Math.abs(target - st.time) > DRIFT_THRESHOLD_S) player.seek(target);
			if (pb.playing && !st.playing) player.play();
			else if (!pb.playing && st.playing) player.pause();
		}, 1000);
		return () => clearInterval(iv);
	}, [syncable, rt]);

	const active = data.isActive === true;
	const isPresenter = data.syncMode === "presenter";
	const iAmPresenter = data.presenterId === rt?.userId;
	const Chrome = rt?.Chrome ?? DefaultEmbedChrome;

	// Plugin-owned body (iframe keeps the sync player ref; a custom Chrome must
	// render {children} for playback sync to work).
	const body = resolved ? (
		<div style={{ width: "100%", height: "100%", position: "relative", background: "#000" }}>
			<iframe
				ref={iframeRef}
				id={`usketch-embed-${data.id}`}
				src={resolved.embedUrl}
				title={resolved.def.title}
				sandbox={resolved.def.sandbox}
				allow={resolved.def.allow}
				referrerPolicy="strict-origin-when-cross-origin"
				style={{
					width: "100%",
					height: "100%",
					border: "none",
					display: "block",
					pointerEvents: active ? "auto" : "none",
				}}
			/>
			{!active && (
				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						alignItems: "flex-end",
						justifyContent: "center",
						paddingBottom: 8,
						pointerEvents: "none",
					}}
				>
					<span
						style={{
							fontSize: 11,
							color: "#fff",
							background: "rgba(0,0,0,0.5)",
							padding: "2px 8px",
							borderRadius: 10,
						}}
					>
						▶ で操作
					</span>
				</div>
			)}
		</div>
	) : (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 8,
				padding: 16,
				background: "#f8fafc",
			}}
		>
			<div style={{ fontSize: 13, color: "#64748b" }}>🔗 URL を貼り付けて埋め込み</div>
			<input
				type="url"
				placeholder="https://www.youtube.com/watch?v=…"
				value={urlDraft}
				onChange={(e) => setUrlDraft(e.target.value)}
				onPointerDown={stop}
				onKeyDown={(e) => {
					e.stopPropagation();
					if (e.key === "Enter" && urlDraft.trim())
						emitEmbedAction({ id: data.id, action: "set-url", url: urlDraft.trim() });
				}}
				onBlur={() =>
					urlDraft.trim() &&
					emitEmbedAction({ id: data.id, action: "set-url", url: urlDraft.trim() })
				}
				style={{
					width: "90%",
					padding: "6px 8px",
					fontSize: 13,
					borderRadius: 6,
					border: "1px solid #cbd5e1",
					pointerEvents: "auto",
				}}
			/>
		</div>
	);

	return (
		<Chrome
			data={data}
			resolved={resolved}
			active={active}
			syncable={syncable}
			isPresenter={isPresenter}
			iAmPresenter={iAmPresenter}
			onSetUrl={(url) => emitEmbedAction({ id: data.id, action: "set-url", url })}
			onActivate={() => emitEmbedAction({ id: data.id, action: "activate" })}
			onDeactivate={() => emitEmbedAction({ id: data.id, action: "deactivate" })}
			onTogglePresenter={() => emitEmbedAction({ id: data.id, action: "toggle-presenter" })}
		>
			{body}
		</Chrome>
	);
}

// ── Default chrome (overridable via plugin `components.Chrome`) ──

export interface EmbedChromeProps {
	data: EmbedShapeData;
	resolved: ResolvedEmbed | null;
	active: boolean;
	syncable: boolean;
	isPresenter: boolean;
	iAmPresenter: boolean;
	/** Pass "" to clear/re-edit the URL. */
	onSetUrl: (url: string) => void;
	onActivate: () => void;
	onDeactivate: () => void;
	onTogglePresenter: () => void;
	/** Plugin-owned body (iframe / URL input). Must be rendered for sync to work. */
	children: React.ReactNode;
}
export type EmbedChrome = (props: EmbedChromeProps) => React.ReactElement;

export function DefaultEmbedChrome(p: EmbedChromeProps) {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				background: "#000",
				border: `${p.data.style.strokeWidth}px solid ${p.data.style.stroke}`,
				borderRadius: 8,
				overflow: "hidden",
				fontFamily: "system-ui, sans-serif",
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			<div
				style={{
					height: 28,
					flex: "0 0 auto",
					display: "flex",
					alignItems: "center",
					gap: 6,
					padding: "0 6px",
					background: "#111827",
					color: "#e5e7eb",
				}}
			>
				<span
					style={{
						flex: 1,
						fontSize: 11,
						fontWeight: 600,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{p.resolved?.def.title ?? "埋め込み"}
				</span>
				{p.resolved && p.syncable && (
					<button
						type="button"
						title={p.isPresenter ? "プレゼンター解除（全員操作可）" : "プレゼンターにする"}
						style={{ ...btn, background: p.iAmPresenter ? "#7c3aed" : btn.background }}
						onPointerDown={stop}
						onClick={(e) => (stop(e), p.onTogglePresenter())}
					>
						{p.isPresenter ? "🔒" : "🆓"}
					</button>
				)}
				{p.resolved && (
					<button
						type="button"
						title="URL を変更"
						style={btn}
						onPointerDown={stop}
						onClick={(e) => (stop(e), p.onSetUrl(""))}
					>
						🔗
					</button>
				)}
				{p.resolved && (
					<button
						type="button"
						title={p.active ? "操作を終了" : "操作する"}
						style={btn}
						onPointerDown={stop}
						onClick={(e) => (stop(e), p.active ? p.onDeactivate() : p.onActivate())}
					>
						{p.active ? "✕" : "▶"}
					</button>
				)}
			</div>
			<div style={{ flex: 1, minHeight: 0 }}>{p.children}</div>
		</div>
	);
}
