// ホイッスルの画面オーバーレイ (波紋・方向バッジ・プロンプト・カウントダウン・
// 追従バナー・吹いたフィードバック)。controller の state を描くだけ。
// 見た目は renderers で丸ごと差し替えられる (host のデザインシステムに合わせるため)。
// 既定の見た目はインライン style の素朴なもの。
import type { BoardStore } from "@edv4h/usketch-shared";
import { worldToScreen } from "@edv4h/usketch-shared";
import {
	type ComponentType,
	type CSSProperties,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type {
	WhistleController,
	WhistleCountdown,
	WhistleFollow,
	WhistleIndicator,
	WhistlePrompt,
	WhistlePulse,
	WhistleSent,
} from "./controller.js";
import { edgePosition } from "./edge-position.js";
import type { WhistleKind } from "./kinds.js";
import { displayName, type WhistleLabels } from "./labels.js";
import type { ScreenSize } from "./viewport-moves.js";

// ── Renderer の差し替え口 ──

export interface WhistlePulseProps {
	pulse: WhistlePulse;
	/** 省略済みの表示名。 */
	name: string;
	kindName: string;
	reducedMotion: boolean;
}

export interface WhistleIndicatorProps {
	indicator: WhistleIndicator;
	name: string;
	kindName: string;
	/** 画面中央から見た吹いた場所の向き (deg、右 = 0、時計回り)。 */
	angle: number;
	onJump: () => void;
}

export interface WhistlePromptProps {
	prompt: WhistlePrompt;
	title: string;
	acceptLabel: string;
	laterLabel: string;
	onAccept: () => void;
	onDismiss: () => void;
}

export interface WhistleCountdownProps {
	countdown: WhistleCountdown;
	title: string;
	stayLabel: string;
	remainingMs: number;
	onStay: () => void;
}

export interface WhistleFollowBannerProps {
	follow: WhistleFollow;
	text: string;
	actionLabel: string;
	onEnd: () => void;
}

export interface WhistleFollowFrameProps {
	follow: WhistleFollow;
}

export interface WhistleSentProps {
	sent: WhistleSent;
	text: string;
}

export interface WhistleRenderers {
	Pulse: ComponentType<WhistlePulseProps>;
	Indicator: ComponentType<WhistleIndicatorProps>;
	Prompt: ComponentType<WhistlePromptProps>;
	Countdown: ComponentType<WhistleCountdownProps>;
	FollowBanner: ComponentType<WhistleFollowBannerProps>;
	/** 追従中 (follower) だけに出す画面の縁取り。 */
	FollowFrame: ComponentType<WhistleFollowFrameProps>;
	SentFeedback: ComponentType<WhistleSentProps>;
}

/** 種類ごとの既定色。色だけで区別しないよう、波紋の本数と線種も変える。 */
export const WHISTLE_KIND_COLORS: Record<WhistleKind, string> = {
	call: "#3b82f6",
	gather: "#10b981",
	assemble: "#f97316",
	follow: "#8b5cf6",
};

const RING_COUNT: Record<WhistleKind, number> = { call: 1, gather: 2, assemble: 3, follow: 2 };

const font: CSSProperties = { fontFamily: "system-ui, sans-serif" };

const pillButton = (color: string, filled: boolean): CSSProperties => ({
	...font,
	border: filled ? "none" : `1px solid ${color}`,
	background: filled ? color : "#fff",
	color: filled ? "#fff" : color,
	borderRadius: 999,
	padding: "6px 14px",
	fontSize: 13,
	fontWeight: 600,
	cursor: "pointer",
	whiteSpace: "nowrap",
});

const card: CSSProperties = {
	...font,
	background: "#fff",
	color: "#1f2937",
	borderRadius: 16,
	padding: "12px 16px",
	boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
	display: "flex",
	alignItems: "center",
	gap: 12,
	pointerEvents: "auto",
	maxWidth: "100%",
};

function DefaultPulse({ pulse, name, kindName, reducedMotion }: WhistlePulseProps) {
	const color = WHISTLE_KIND_COLORS[pulse.kind];
	const rings = RING_COUNT[pulse.kind];
	// 波紋は state に残る時間 (pulse.durationMs) の中で終わるように割り振る。
	const stagger = 200;
	const ringMs = Math.max(pulse.durationMs - (rings - 1) * stagger, 300);
	return (
		<div style={{ position: "absolute", left: -60, top: -60, width: 120, height: 120 }}>
			{Array.from({ length: rings }, (_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: 本数固定の装飾
					key={i}
					style={{
						position: "absolute",
						inset: 0,
						borderRadius: "50%",
						border: `${pulse.kind === "assemble" ? 3 : 2}px ${pulse.kind === "follow" ? "dashed" : "solid"} ${color}`,
						opacity: reducedMotion ? 0.6 : 0,
						animation: reducedMotion
							? undefined
							: `usketch-whistle-pulse ${ringMs}ms ease-out ${i * stagger}ms 1 forwards`,
					}}
				/>
			))}
			<div
				style={{
					...font,
					position: "absolute",
					top: "100%",
					left: "50%",
					transform: "translateX(-50%)",
					marginTop: 4,
					whiteSpace: "nowrap",
					fontSize: 12,
					fontWeight: 600,
					color,
					animation: reducedMotion
						? undefined
						: `usketch-whistle-fade ${pulse.durationMs}ms ease-out forwards`,
				}}
			>
				{name} · {kindName}
			</div>
		</div>
	);
}

function DefaultIndicator({ indicator, name, kindName, onJump }: WhistleIndicatorProps) {
	const color = WHISTLE_KIND_COLORS[indicator.kind];
	return (
		<button
			type="button"
			onClick={onJump}
			aria-label={`${name} · ${kindName}`}
			style={{
				...pillButton(color, true),
				transform: "translate(-50%, -50%)",
				boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
				animation: "usketch-whistle-indicator-in 200ms ease-out forwards",
			}}
		>
			📢 {name}
		</button>
	);
}

function DefaultPrompt({
	prompt,
	title,
	acceptLabel,
	laterLabel,
	onAccept,
	onDismiss,
}: WhistlePromptProps) {
	const color = WHISTLE_KIND_COLORS[prompt.kind];
	return (
		<div role="dialog" aria-live="polite" aria-label={title} style={card}>
			<span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
			<button type="button" onClick={onDismiss} style={pillButton(color, false)}>
				{laterLabel}
			</button>
			<button type="button" onClick={onAccept} style={pillButton(color, true)}>
				{acceptLabel}
			</button>
		</div>
	);
}

function DefaultCountdown({ title, stayLabel, remainingMs, onStay }: WhistleCountdownProps) {
	const color = WHISTLE_KIND_COLORS.assemble;
	return (
		<div role="alert" style={card}>
			<span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
			<span style={{ fontSize: 20, fontWeight: 700, color, minWidth: 16, textAlign: "center" }}>
				{Math.max(Math.ceil(remainingMs / 1000), 0)}
			</span>
			<button type="button" onClick={onStay} style={pillButton(color, false)}>
				{stayLabel}
			</button>
		</div>
	);
}

function DefaultFollowBanner({ text, actionLabel, onEnd }: WhistleFollowBannerProps) {
	const color = WHISTLE_KIND_COLORS.follow;
	return (
		<div aria-live="polite" style={card}>
			<span style={{ fontSize: 14, fontWeight: 600 }}>{text}</span>
			<button type="button" onClick={onEnd} style={pillButton(color, false)}>
				{actionLabel}
			</button>
		</div>
	);
}

/** 追従中 (follower) に画面の縁へ出す枠。 */
function DefaultFollowFrame(_: WhistleFollowFrameProps) {
	return (
		<div
			aria-hidden
			style={{
				position: "absolute",
				inset: 0,
				border: `3px solid ${WHISTLE_KIND_COLORS.follow}`,
				pointerEvents: "none",
			}}
		/>
	);
}

function DefaultSentFeedback({ sent, text }: WhistleSentProps) {
	return (
		<div
			aria-live="polite"
			style={{
				...font,
				position: "absolute",
				bottom: 24,
				left: "50%",
				transform: "translateX(-50%)",
				background:
					sent.cooldownRemainingMs !== undefined ? "#6b7280" : WHISTLE_KIND_COLORS[sent.kind],
				color: "#fff",
				borderRadius: 999,
				padding: "6px 14px",
				fontSize: 13,
				fontWeight: 600,
				pointerEvents: "none",
			}}
		>
			{text}
		</div>
	);
}

export const DEFAULT_WHISTLE_RENDERERS: WhistleRenderers = {
	Pulse: DefaultPulse,
	Indicator: DefaultIndicator,
	Prompt: DefaultPrompt,
	Countdown: DefaultCountdown,
	FollowBanner: DefaultFollowBanner,
	FollowFrame: DefaultFollowFrame,
	SentFeedback: DefaultSentFeedback,
};

// ── CSS (既定の見た目用) ──

let styleInjected = false;
export function injectWhistleStyle() {
	if (styleInjected || typeof document === "undefined") return;
	styleInjected = true;
	const style = document.createElement("style");
	style.textContent = `
		@keyframes usketch-whistle-pulse {
			0% { transform: scale(0.2); opacity: 0.9; }
			100% { transform: scale(2.5); opacity: 0; }
		}
		@keyframes usketch-whistle-fade {
			0% { opacity: 1; }
			70% { opacity: 1; }
			100% { opacity: 0; }
		}
		@keyframes usketch-whistle-indicator-in {
			0% { opacity: 0; }
			100% { opacity: 1; }
		}
	`;
	document.head.appendChild(style);
}

// ── オーバーレイ本体 ──

/** プロンプト・カウントダウン・バナーの UI に付ける印 (追従解除の判定から外す)。 */
export const WHISTLE_UI_ATTR = "data-usketch-whistle-ui";

export function prefersReducedMotion(): boolean {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useNow(active: boolean, intervalMs = 100): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(timer);
	}, [active, intervalMs]);
	return now;
}

function useWhistleState(controller: WhistleController) {
	return useSyncExternalStore(controller.state.subscribe, controller.state.get);
}

/** 波紋と方向バッジ (ボードに付くもの)。キャンバスの大きさもここで測る。 */
export function WhistleBoardOverlay({
	controller,
	store,
	labels,
	renderers,
	onResize,
}: {
	controller: WhistleController;
	store: BoardStore;
	labels: WhistleLabels;
	renderers: WhistleRenderers;
	/** キャンバスの大きさを controller に伝える。 */
	onResize: (size: ScreenSize) => void;
}) {
	const state = useWhistleState(controller);
	const viewport = useSyncExternalStore(
		(cb) => store.subscribe(cb),
		() => store.getViewport(),
	);
	const rootRef = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState<ScreenSize>({ width: 0, height: 0 });

	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		const update = () => {
			const next = { width: el.clientWidth, height: el.clientHeight };
			if (next.width === 0 || next.height === 0) return;
			setSize(next);
			onResize(next);
		};
		update();
		if (typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => ro.disconnect();
	}, [onResize]);

	const reducedMotion = prefersReducedMotion();
	const { Pulse, Indicator } = renderers;
	const name = (n: string) => displayName(n, labels);

	return (
		<div
			ref={rootRef}
			style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}
		>
			{size.width > 0 &&
				state.pulses.map((pulse) => {
					const p = worldToScreen(pulse.position.x, pulse.position.y, viewport);
					return (
						<div key={pulse.id} style={{ position: "absolute", left: p.x, top: p.y }}>
							<Pulse
								pulse={pulse}
								name={name(pulse.name)}
								kindName={labels.kindNames[pulse.kind]}
								reducedMotion={reducedMotion}
							/>
						</div>
					);
				})}
			{size.width > 0 &&
				state.indicators.map((ind) => {
					const screen = worldToScreen(ind.position.x, ind.position.y, viewport);
					const edge = edgePosition(screen, size);
					if (edge.onScreen) return null;
					return (
						<div
							key={ind.id}
							{...{ [WHISTLE_UI_ATTR]: "" }}
							style={{ position: "absolute", left: edge.x, top: edge.y, pointerEvents: "auto" }}
						>
							<Indicator
								indicator={ind}
								name={name(ind.name)}
								kindName={labels.kindNames[ind.kind]}
								angle={edge.angle}
								onJump={() => controller.jumpToIndicator(ind.id)}
							/>
						</div>
					);
				})}
		</div>
	);
}

/** プロンプト・カウントダウン・追従バナー/枠・吹いたフィードバック (画面に付く UI)。 */
export function WhistleScreenOverlay({
	controller,
	labels,
	renderers,
}: {
	controller: WhistleController;
	labels: WhistleLabels;
	renderers: WhistleRenderers;
}) {
	const state = useWhistleState(controller);
	const now = useNow(state.countdown !== null);
	const { Prompt, Countdown, FollowBanner, FollowFrame, SentFeedback } = renderers;
	const name = (n: string) => displayName(n, labels);

	const promptTitle = (p: WhistlePrompt) =>
		p.kind === "assemble"
			? labels.callingAll(name(p.name))
			: p.kind === "follow"
				? labels.invitingToFollow(name(p.name))
				: labels.calling(name(p.name));

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
			{state.follow?.role === "follower" && <FollowFrame follow={state.follow} />}
			<div
				{...{ [WHISTLE_UI_ATTR]: "" }}
				style={{
					position: "absolute",
					top: 16,
					left: 16,
					right: 16,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 8,
					pointerEvents: "none",
				}}
			>
				{state.follow && (
					<FollowBanner
						follow={state.follow}
						text={
							state.follow.role === "leader"
								? labels.leading
								: labels.following(name(state.follow.name))
						}
						actionLabel={state.follow.role === "leader" ? labels.end : labels.leave}
						onEnd={controller.endFollow}
					/>
				)}
				{state.countdown && (
					<Countdown
						countdown={state.countdown}
						title={labels.assembling(name(state.countdown.name))}
						stayLabel={labels.stay}
						remainingMs={state.countdown.endsAt - now}
						onStay={controller.stayCountdown}
					/>
				)}
				{state.prompt && (
					<Prompt
						prompt={state.prompt}
						title={promptTitle(state.prompt)}
						acceptLabel={state.prompt.kind === "follow" ? labels.follow : labels.move}
						laterLabel={labels.later}
						onAccept={controller.acceptPrompt}
						onDismiss={controller.dismissPrompt}
					/>
				)}
			</div>
			{state.sent && (
				<SentFeedback
					sent={state.sent}
					text={
						state.sent.cooldownRemainingMs !== undefined
							? labels.cooldown(Math.ceil(state.sent.cooldownRemainingMs / 1000))
							: labels.sent(labels.kindNames[state.sent.kind])
					}
				/>
			)}
		</div>
	);
}
