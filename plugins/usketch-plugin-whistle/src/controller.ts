// ホイッスルの振る舞い (吹く・受ける・移動する) をまとめたコントローラ。
// UI と PluginContext から切り離し、依存は注入する。plugin.tsx はこれを ctx に
// つなぐだけで、オーバーレイは state を描くだけ。
import { type BoardStore, type Point, type Viewport, worldToScreen } from "@edv4h/usketch-shared";
import { DEFAULT_WHISTLE_KIND, resolveMovement, type WhistleKind } from "./kinds.js";
import {
	parseWhistleMessage,
	type WhistleBlowMessage,
	type WhistleFollowMessage,
} from "./messages.js";
import { createReactiveStore, type ReactiveStore } from "./reactive-store.js";
import {
	moveToWorld,
	type ScreenSize,
	screenCenterWorldIn,
	swoopToWorld,
	viewportCenteredOn,
} from "./viewport-moves.js";

/** 吹いた場所の波紋 (画面内なら見える)。 */
export interface WhistlePulse {
	id: string;
	kind: WhistleKind;
	name: string;
	position: Point;
	/** 自分が吹いたものか。 */
	local: boolean;
	/** state に残る時間 (ms)。演出はこの中で終える。 */
	durationMs: number;
}

/** 画面外で吹かれた「おーい」の方向バッジ。 */
export interface WhistleIndicator {
	id: string;
	kind: WhistleKind;
	name: string;
	position: Point;
	zoom?: number;
}

/** 承諾待ちのプロンプト (集合、または強制移動を受けられないときの全員集合・ついてきて)。 */
export interface WhistlePrompt {
	id: string;
	kind: WhistleKind;
	name: string;
	position: Point;
	zoom?: number;
	expiresAt: number;
	ttlMs: number;
}

/** 全員集合のカウントダウン。 */
export interface WhistleCountdown {
	id: string;
	name: string;
	position: Point;
	zoom?: number;
	endsAt: number;
	totalMs: number;
}

/** ついてきて の状態。leader = 自分が案内中、follower = 誰かについていっている。 */
export interface WhistleFollow {
	id: string;
	role: "leader" | "follower";
	name: string;
}

/** 自分が吹いた直後のフィードバック。 */
export interface WhistleSent {
	id: string;
	kind: WhistleKind;
}

export interface WhistleOverlayState {
	pulses: WhistlePulse[];
	indicators: WhistleIndicator[];
	prompt: WhistlePrompt | null;
	countdown: WhistleCountdown | null;
	follow: WhistleFollow | null;
	sent: WhistleSent | null;
	/** 次に吹けるようになる時刻 (ms)。 */
	cooldownUntil: number;
	/** Shift+W などで吹く種類 (最後に選んだもの)。 */
	selectedKind: WhistleKind;
}

export const WHISTLE_TIMINGS = {
	pulseMs: 3000,
	indicatorMs: 5000,
	promptMs: 10000,
	countdownMs: 3000,
	sentMs: 2000,
	cooldownMs: 5000,
	followBroadcastMs: 80,
	/** 画角が動いていなくても案内中であることを知らせる間隔。 */
	followHeartbeatMs: 2000,
	/** これだけ案内役から何も届かなければ、切断とみなして追従をやめる。 */
	followStaleMs: 7000,
	/** follower が案内役の画角へ寄せるときの短いアニメーション。 */
	followTweenMs: 120,
} as const;

export type WhistleTimings = { -readonly [K in keyof typeof WHISTLE_TIMINGS]: number };

export interface WhistleControllerDeps {
	store: BoardStore;
	broadcast?: (msg: Record<string, unknown>) => void;
	getLocalName: () => string;
	/** キャンバスの大きさ (px)。 */
	getScreenSize: () => ScreenSize;
	/** false なら強制移動 (全員集合・ついてきて) を承諾制に落とす。 */
	canAutoMove?: () => boolean;
	/** true なら移動をアニメーションさせない。 */
	prefersReducedMotion?: () => boolean;
	generateId: () => string;
	now?: () => number;
	timings?: Partial<WhistleTimings>;
}

export interface WhistleController {
	state: ReactiveStore<WhistleOverlayState>;
	/** 吹く。クールダウン中は false。ついてきて案内中に follow を吹くと案内を終える。 */
	blow(kind?: WhistleKind): boolean;
	setSelectedKind(kind: WhistleKind): void;
	/** 受信したブロードキャストを処理する。 */
	receive(msg: Record<string, unknown>): void;
	acceptPrompt(): void;
	dismissPrompt(): void;
	/** 全員集合のカウントダウン中に「残る」。 */
	stayCountdown(): void;
	/** 方向バッジを押して吹いた場所へ移動する。 */
	jumpToIndicator(id: string): void;
	/** 案内を終える (leader) / 追従から外れる (follower)。 */
	endFollow(): void;
	/** follower 中に自分でキャンバスを操作したとき (外れる)。 */
	notifyUserInteraction(): void;
	dispose(): void;
}

const MAX_SEEN_IDS = 100;

const initialState = (): WhistleOverlayState => ({
	pulses: [],
	indicators: [],
	prompt: null,
	countdown: null,
	follow: null,
	sent: null,
	cooldownUntil: 0,
	selectedKind: DEFAULT_WHISTLE_KIND,
});

export function createWhistleController(deps: WhistleControllerDeps): WhistleController {
	const { store } = deps;
	const now = deps.now ?? Date.now;
	const t: WhistleTimings = { ...WHISTLE_TIMINGS, ...deps.timings };
	const state = createReactiveStore<WhistleOverlayState>(initialState());
	const timers = new Set<ReturnType<typeof setTimeout>>();
	const seenIds: string[] = [];
	// 自分で外れた / 断った follow の id。以降の follow 更新で再び引き込まない。
	const leftFollowIds = new Set<string>();
	let countdownTimer: ReturnType<typeof setTimeout> | null = null;
	let cancelSwoop: (() => void) | null = null;
	let unsubLeader: (() => void) | null = null;
	let disposed = false;

	const patch = (p: Partial<WhistleOverlayState>) => state.set((s) => ({ ...s, ...p }));
	const animate = () => !(deps.prefersReducedMotion?.() ?? false);

	const later = (ms: number, fn: () => void) => {
		const timer = setTimeout(() => {
			timers.delete(timer);
			fn();
		}, ms);
		timers.add(timer);
		return timer;
	};

	const markSeen = (id: string): boolean => {
		if (seenIds.includes(id)) return false;
		seenIds.push(id);
		if (seenIds.length > MAX_SEEN_IDS) seenIds.shift();
		return true;
	};

	const addPulse = (p: Omit<WhistlePulse, "durationMs">) => {
		const pulse: WhistlePulse = { ...p, durationMs: t.pulseMs };
		state.set((s) => ({ ...s, pulses: [...s.pulses.filter((p) => p.id !== pulse.id), pulse] }));
		later(t.pulseMs, () =>
			state.set((s) => ({ ...s, pulses: s.pulses.filter((p) => p.id !== pulse.id) })),
		);
	};

	const isOnScreen = (point: Point): boolean => {
		const size = deps.getScreenSize();
		const p = worldToScreen(point.x, point.y, store.getViewport());
		return p.x >= 0 && p.x <= size.width && p.y >= 0 && p.y <= size.height;
	};

	const clearCountdown = () => {
		if (countdownTimer !== null) clearTimeout(countdownTimer);
		countdownTimer = null;
		patch({ countdown: null });
	};

	// ── ついてきて (leader) ──

	const stopLeading = () => {
		unsubLeader?.();
		unsubLeader = null;
	};

	const startLeading = (id: string, name: string) => {
		stopLeading();
		patch({ follow: { id, role: "leader", name } });
		let last = store.getViewport();
		let pending: ReturnType<typeof setTimeout> | null = null;
		let seq = 0;
		const send = () => {
			pending = null;
			const vp = store.getViewport();
			const msg: WhistleFollowMessage = {
				kind: "whistle-follow",
				id,
				sourceUserId: "local",
				sourceName: name,
				center: screenCenterWorldIn(store, deps.getScreenSize()),
				zoom: vp.zoom,
				seq: ++seq,
			};
			deps.broadcast?.({ ...msg });
		};
		// 画角が止まっていても生存を知らせる (follower 側の切断検知のため)。
		const heartbeat = setInterval(send, t.followHeartbeatMs);
		const unsub = store.subscribe(() => {
			const vp = store.getViewport();
			if (vp.x === last.x && vp.y === last.y && vp.zoom === last.zoom) return;
			last = vp;
			if (pending === null) pending = setTimeout(send, t.followBroadcastMs);
		});
		unsubLeader = () => {
			unsub();
			clearInterval(heartbeat);
			if (pending !== null) clearTimeout(pending);
		};
	};

	// ── ついてきて (follower) ──

	// 自分 (このコントローラ) が動かしている間の行き先と、その動きが終わる時刻。
	// それ以外で画角が変わったら「自分で操作した」とみなして追従から外れる
	// (ホイール・キーボード・フィット・パンなど、入力の種類を問わない)。
	let ownTarget: Viewport | null = null;
	let ownMoveUntil = 0;
	let lastHeardAt = 0;
	let unsubFollower: (() => void) | null = null;

	const applyOwnMove = (target: Viewport, durationMs: number) => {
		const animated = animate() && durationMs > 0;
		ownTarget = target;
		ownMoveUntil = now() + (animated ? durationMs : 0) + 100;
		store.animateViewportTo(target, animated ? { animate: true, durationMs } : { animate: false });
	};

	const sameViewport = (a: Viewport, b: Viewport) =>
		Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.zoom - b.zoom) < 1e-4;

	const stopFollowerWatch = () => {
		unsubFollower?.();
		unsubFollower = null;
		ownTarget = null;
	};

	const startFollowing = (id: string, name: string, position: Point, zoom?: number) => {
		cancelSwoop?.();
		stopFollowerWatch();
		patch({ follow: { id, role: "follower", name } });
		lastHeardAt = now();
		const size = deps.getScreenSize();
		applyOwnMove(viewportCenteredOn(store.getViewport(), position, size, zoom), 500);
		const unsub = store.subscribe(() => {
			if (now() < ownMoveUntil) return;
			if (ownTarget && sameViewport(store.getViewport(), ownTarget)) return;
			leaveFollowing();
		});
		const stale = setInterval(() => {
			if (now() - lastHeardAt > t.followStaleMs) {
				const f = state.get().follow;
				if (f?.role === "follower" && f.id === id) {
					stopFollowerWatch();
					patch({ follow: null });
				}
			}
		}, 1000);
		unsubFollower = () => {
			unsub();
			clearInterval(stale);
		};
	};

	const leaveFollowing = () => {
		const f = state.get().follow;
		if (f?.role !== "follower") return;
		leftFollowIds.add(f.id);
		stopFollowerWatch();
		patch({ follow: null });
	};

	// ── 受信 ──

	const receiveBlow = (msg: WhistleBlowMessage) => {
		if (!markSeen(msg.id)) return;
		const name = msg.sourceName;
		addPulse({ id: msg.id, kind: msg.whistleKind, name, position: msg.position, local: false });

		const movement = resolveMovement(msg.whistleKind, deps.canAutoMove?.() ?? true);
		switch (movement) {
			case "none": {
				if (isOnScreen(msg.position)) return;
				const indicator: WhistleIndicator = {
					id: msg.id,
					kind: msg.whistleKind,
					name,
					position: msg.position,
					zoom: msg.zoom,
				};
				state.set((s) => ({
					...s,
					indicators: [...s.indicators.filter((i) => i.id !== msg.id), indicator],
				}));
				later(t.indicatorMs, () =>
					state.set((s) => ({ ...s, indicators: s.indicators.filter((i) => i.id !== msg.id) })),
				);
				return;
			}
			case "prompt": {
				patch({
					prompt: {
						id: msg.id,
						kind: msg.whistleKind,
						name,
						position: msg.position,
						zoom: msg.zoom,
						expiresAt: now() + t.promptMs,
						ttlMs: t.promptMs,
					},
				});
				later(t.promptMs, () => {
					if (state.get().prompt?.id === msg.id) patch({ prompt: null });
				});
				return;
			}
			case "auto": {
				clearCountdown();
				// 全員集合が来たら、それより前の「集合」プロンプトは古くなるので消す。
				patch({
					prompt: null,
					countdown: {
						id: msg.id,
						name,
						position: msg.position,
						zoom: msg.zoom,
						endsAt: now() + t.countdownMs,
						totalMs: t.countdownMs,
					},
				});
				countdownTimer = setTimeout(() => {
					countdownTimer = null;
					const c = state.get().countdown;
					if (c?.id !== msg.id) return;
					patch({ countdown: null });
					// 追従中なら外れてから集まる。
					leaveFollowing();
					cancelSwoop?.();
					cancelSwoop = swoopToWorld(store, c.position, deps.getScreenSize(), {
						zoom: c.zoom,
						animate: animate(),
					});
				}, t.countdownMs);
				return;
			}
			case "follow": {
				if (leftFollowIds.has(msg.id)) return;
				if (state.get().follow?.role === "leader") return; // 自分が案内中なら付いていかない。
				startFollowing(msg.id, name, msg.position, msg.zoom);
				return;
			}
		}
	};

	const receiveFollow = (msg: WhistleFollowMessage) => {
		const f = state.get().follow;
		if (f?.role === "follower" && f.id === msg.id) {
			lastHeardAt = now();
			const target = viewportCenteredOn(
				store.getViewport(),
				msg.center,
				deps.getScreenSize(),
				msg.zoom,
			);
			// 画角が変わっていない heartbeat なら動かさない。
			if (ownTarget && sameViewport(target, ownTarget)) return;
			applyOwnMove(target, t.followTweenMs);
			return;
		}
		// 承諾待ち (強制移動を受けられない人) のプロンプトは、行き先を最新に保つ。
		const p = state.get().prompt;
		if (p?.id === msg.id) patch({ prompt: { ...p, position: msg.center, zoom: msg.zoom } });
	};

	const receiveFollowEnd = (id: string) => {
		const s = state.get();
		if (s.follow?.role === "follower" && s.follow.id === id) {
			stopFollowerWatch();
			patch({ follow: null });
		}
		if (s.prompt?.id === id && s.prompt.kind === "follow") patch({ prompt: null });
	};

	// ── 公開 API ──

	const endFollow = () => {
		const f = state.get().follow;
		if (!f) return;
		if (f.role === "leader") {
			stopLeading();
			patch({ follow: null });
			deps.broadcast?.({ kind: "whistle-follow-end", id: f.id });
			return;
		}
		leaveFollowing();
	};

	const blow = (kind: WhistleKind = state.get().selectedKind): boolean => {
		if (disposed) return false;
		// 案内中にもう一度「ついてきて」を吹くと案内を終える (クールダウンなし)。
		if (kind === "follow" && state.get().follow?.role === "leader") {
			endFollow();
			return true;
		}
		const at = now();
		if (at < state.get().cooldownUntil) return false;

		const id = deps.generateId();
		const name = deps.getLocalName();
		const position = screenCenterWorldIn(store, deps.getScreenSize());
		const zoom = store.getViewport().zoom;
		markSeen(id);
		patch({ cooldownUntil: at + t.cooldownMs, sent: { id, kind } });
		later(t.sentMs, () => {
			if (state.get().sent?.id === id) patch({ sent: null });
		});
		addPulse({ id, kind, name, position, local: true });

		if (kind === "follow") {
			// 誰かについていっている最中なら外れてから案内を始める。
			leaveFollowing();
			startLeading(id, name);
		}

		const msg: WhistleBlowMessage = {
			kind: "whistle",
			id,
			whistleKind: kind,
			sourceUserId: "local",
			sourceName: name,
			position,
			zoom,
		};
		deps.broadcast?.({ ...msg });
		return true;
	};

	return {
		state,
		blow,
		setSelectedKind: (kind) => patch({ selectedKind: kind }),
		receive(raw) {
			if (disposed) return;
			const msg = parseWhistleMessage(raw);
			if (!msg) return;
			if (msg.kind === "whistle") receiveBlow(msg);
			else if (msg.kind === "whistle-follow") receiveFollow(msg);
			else receiveFollowEnd(msg.id);
		},
		acceptPrompt() {
			const p = state.get().prompt;
			if (!p) return;
			patch({ prompt: null });
			if (p.kind === "follow") {
				leftFollowIds.delete(p.id);
				startFollowing(p.id, p.name, p.position, p.zoom);
				return;
			}
			leaveFollowing();
			moveToWorld(store, p.position, deps.getScreenSize(), { zoom: p.zoom, animate: animate() });
		},
		dismissPrompt() {
			const p = state.get().prompt;
			if (!p) return;
			if (p.kind === "follow") leftFollowIds.add(p.id);
			patch({ prompt: null });
		},
		stayCountdown: clearCountdown,
		jumpToIndicator(id) {
			const ind = state.get().indicators.find((i) => i.id === id);
			if (!ind) return;
			state.set((s) => ({ ...s, indicators: s.indicators.filter((i) => i.id !== id) }));
			leaveFollowing();
			moveToWorld(store, ind.position, deps.getScreenSize(), { animate: animate() });
		},
		endFollow,
		notifyUserInteraction() {
			if (state.get().follow?.role === "follower") leaveFollowing();
		},
		dispose() {
			if (state.get().follow?.role === "leader") endFollow();
			disposed = true;
			stopLeading();
			stopFollowerWatch();
			cancelSwoop?.();
			if (countdownTimer !== null) clearTimeout(countdownTimer);
			for (const timer of timers) clearTimeout(timer);
			timers.clear();
			state.set(initialState());
		},
	};
}
