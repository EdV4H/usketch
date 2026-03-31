import {
	generateId,
	type PluginContext,
	type TransientObject,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { useCallback, useMemo, useSyncExternalStore } from "react";

const WHISTLE_TTL = 3000;
const INDICATOR_TTL = 5000;
const COOLDOWN_MS = 5000;
const EDGE_PADDING = 40;

// ── Transient renderer: pulse ring effect ──

function WhistleEffect({ obj }: { obj: TransientObject }) {
	const name = (obj.data.name as string) || "";
	return (
		<div
			style={{
				position: "absolute",
				left: -60,
				top: -60,
				width: 120,
				height: 120,
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			{[0, 1, 2].map((i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						inset: 0,
						borderRadius: "50%",
						border: "2px solid #3b82f6",
						animation: `usketch-whistle-pulse ${WHISTLE_TTL}ms ease-out forwards`,
						animationDelay: `${i * 200}ms`,
						opacity: 0,
					}}
				/>
			))}
			{name && (
				<div
					style={{
						position: "absolute",
						top: "100%",
						left: "50%",
						transform: "translateX(-50%)",
						marginTop: 4,
						whiteSpace: "nowrap",
						fontSize: 12,
						fontFamily: "system-ui, sans-serif",
						color: "#3b82f6",
						fontWeight: 600,
						animation: `usketch-whistle-fade ${WHISTLE_TTL}ms ease-out forwards`,
					}}
				>
					{name}
				</div>
			)}
		</div>
	);
}

// ── CSS injection ──

let styleInjected = false;
function injectStyle() {
	if (styleInjected) return;
	styleInjected = true;
	const style = document.createElement("style");
	style.textContent = `
		@keyframes usketch-whistle-pulse {
			0% { transform: scale(0); opacity: 0.8; }
			100% { transform: scale(3); opacity: 0; }
		}
		@keyframes usketch-whistle-fade {
			0% { opacity: 1; }
			70% { opacity: 1; }
			100% { opacity: 0; }
		}
		@keyframes usketch-whistle-indicator-in {
			0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
			100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
		}
	`;
	document.head.appendChild(style);
}

// ── Off-screen indicator ──

interface WhistleIndicatorData {
	id: string;
	name: string;
	worldX: number;
	worldY: number;
	createdAt: number;
}

function computeIndicatorPosition(
	worldX: number,
	worldY: number,
	vp: { x: number; y: number; zoom: number },
): {
	screenX: number;
	screenY: number;
	isOnScreen: boolean;
	indicatorX: number;
	indicatorY: number;
} {
	const screenX = worldX * vp.zoom + vp.x;
	const screenY = worldY * vp.zoom + vp.y;

	const isOnScreen =
		screenX >= 0 && screenX <= window.innerWidth && screenY >= 0 && screenY <= window.innerHeight;

	if (isOnScreen) {
		return { screenX, screenY, isOnScreen, indicatorX: screenX, indicatorY: screenY };
	}

	const centerX = window.innerWidth / 2;
	const centerY = window.innerHeight / 2;
	const dx = screenX - centerX;
	const dy = screenY - centerY;

	if (dx === 0 && dy === 0) {
		return { screenX, screenY, isOnScreen: true, indicatorX: centerX, indicatorY: centerY };
	}

	const scaleX =
		dx !== 0
			? (dx > 0 ? window.innerWidth - EDGE_PADDING - centerX : EDGE_PADDING - centerX) / dx
			: Number.POSITIVE_INFINITY;
	const scaleY =
		dy !== 0
			? (dy > 0 ? window.innerHeight - EDGE_PADDING - centerY : EDGE_PADDING - centerY) / dy
			: Number.POSITIVE_INFINITY;
	const scale = Math.min(Math.abs(scaleX), Math.abs(scaleY));

	return {
		screenX,
		screenY,
		isOnScreen,
		indicatorX: centerX + dx * scale,
		indicatorY: centerY + dy * scale,
	};
}

function IndicatorItem({
	data,
	onJump,
}: {
	data: WhistleIndicatorData;
	onJump: (worldX: number, worldY: number) => void;
}) {
	const handleClick = useCallback(() => {
		onJump(data.worldX, data.worldY);
	}, [data.worldX, data.worldY, onJump]);

	return (
		<button
			type="button"
			onClick={handleClick}
			style={{
				position: "absolute",
				background: "#3b82f6",
				color: "#fff",
				border: "none",
				borderRadius: 20,
				padding: "6px 12px",
				fontSize: 13,
				fontFamily: "system-ui, sans-serif",
				fontWeight: 600,
				cursor: "pointer",
				whiteSpace: "nowrap",
				display: "flex",
				alignItems: "center",
				gap: 4,
				animation: "usketch-whistle-indicator-in 200ms ease-out forwards",
				boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
				zIndex: 1,
			}}
		>
			<span style={{ fontSize: 16 }}>📢</span>
			{data.name || "Someone"}
		</button>
	);
}

function WhistleIndicatorLayer({
	subscribe,
	getSnapshot,
	store,
}: {
	subscribe: (cb: () => void) => () => void;
	getSnapshot: () => WhistleIndicatorData[];
	store: PluginContext["store"];
}) {
	const indicators = useSyncExternalStore(subscribe, getSnapshot);
	const viewport = useSyncExternalStore(
		(cb) => store.subscribe(cb),
		() => store.getViewport(),
	);

	const handleJump = useCallback(
		(worldX: number, worldY: number) => {
			const vp = store.getViewport();
			store.setViewport({
				...vp,
				x: window.innerWidth / 2 - worldX * vp.zoom,
				y: window.innerHeight / 2 - worldY * vp.zoom,
			});
		},
		[store],
	);

	const positioned = useMemo(() => {
		return indicators
			.map((ind) => {
				const pos = computeIndicatorPosition(ind.worldX, ind.worldY, viewport);
				return { ...ind, ...pos };
			})
			.filter((p) => !p.isOnScreen);
	}, [indicators, viewport]);

	if (positioned.length === 0) return null;

	return (
		<>
			{positioned.map((item) => (
				<div
					key={item.id}
					style={{
						position: "fixed",
						left: item.indicatorX,
						top: item.indicatorY,
						transform: "translate(-50%, -50%)",
						pointerEvents: "auto",
					}}
				>
					<IndicatorItem data={item} onJump={handleJump} />
				</div>
			))}
		</>
	);
}

// ── Plugin factory ──

function createPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	const cleanups: (() => void)[] = [];
	let indicators: WhistleIndicatorData[] = [];
	const indicatorListeners = new Set<() => void>();

	function indicatorSubscribe(cb: () => void): () => void {
		indicatorListeners.add(cb);
		return () => indicatorListeners.delete(cb);
	}

	function indicatorGetSnapshot(): WhistleIndicatorData[] {
		return indicators;
	}

	function addIndicator(data: WhistleIndicatorData) {
		indicators = [...indicators, data];
		for (const cb of indicatorListeners) cb();

		const timer = setTimeout(() => {
			removeIndicator(data.id);
		}, INDICATOR_TTL);

		cleanups.push(() => clearTimeout(timer));
	}

	function removeIndicator(id: string) {
		const prev = indicators;
		indicators = indicators.filter((i) => i.id !== id);
		if (prev !== indicators) {
			for (const cb of indicatorListeners) cb();
		}
	}

	return {
		id: "usketch-plugin-whistle",
		name: "ホイッスル",

		setup(ctx: PluginContext) {
			injectStyle();

			ctx.transient.registerType("whistle", {
				render: (obj) => <WhistleEffect obj={obj} />,
			});

			// ── Shortcut: W key ──
			let lastWhistleTime = 0;

			function getLocalUserName(): string {
				if (!wsProvider) return "";
				const states = wsProvider.awareness.getStates();
				const localId = wsProvider.awareness.doc.clientID;
				const localState = states.get(localId);
				const avatar = localState?.avatar as { name?: string } | undefined;
				return avatar?.name ?? "";
			}

			function handleWhistle() {
				const now = Date.now();
				if (now - lastWhistleTime < COOLDOWN_MS) return;
				lastWhistleTime = now;

				const vp = ctx.store.getViewport();
				const worldX = (window.innerWidth / 2 - vp.x) / vp.zoom;
				const worldY = (window.innerHeight / 2 - vp.y) / vp.zoom;
				const id = generateId();
				const name = getLocalUserName();

				ctx.transient.emit({
					id,
					type: "whistle",
					sourceUserId: "local",
					position: { x: worldX, y: worldY },
					data: { name },
					ttl: WHISTLE_TTL,
					createdAt: Date.now(),
				});

				wsProvider?.broadcast({
					kind: "whistle",
					id,
					sourceName: name,
					position: { x: worldX, y: worldY },
				});
			}

			cleanups.push(ctx.shortcuts.register("w", handleWhistle));

			// ── Broadcast receiver ──
			if (wsProvider) {
				const unsubBroadcast = wsProvider.onBroadcast((msg) => {
					if (msg.kind !== "whistle") return;

					const id = msg.id;
					const position = msg.position as { x?: number; y?: number } | undefined;
					const sourceName = msg.sourceName;

					if (
						typeof id !== "string" ||
						!position ||
						typeof position.x !== "number" ||
						typeof position.y !== "number"
					) {
						return;
					}

					const name = typeof sourceName === "string" ? sourceName : "";
					const vp = ctx.store.getViewport();
					const pos = computeIndicatorPosition(position.x, position.y, vp);

					if (pos.isOnScreen) {
						ctx.transient.emit({
							id,
							type: "whistle",
							sourceUserId: "remote",
							position: { x: position.x, y: position.y },
							data: { name },
							ttl: WHISTLE_TTL,
							createdAt: Date.now(),
						});
					} else {
						// Also emit transient at the world position (visible when user scrolls there)
						ctx.transient.emit({
							id,
							type: "whistle",
							sourceUserId: "remote",
							position: { x: position.x, y: position.y },
							data: { name },
							ttl: WHISTLE_TTL,
							createdAt: Date.now(),
						});

						addIndicator({
							id: `${id}-indicator`,
							name,
							worldX: position.x,
							worldY: position.y,
							createdAt: Date.now(),
						});
					}
				});
				cleanups.push(unsubBroadcast);
			}

			// ── Indicator layer ──
			ctx.layers.register({
				id: "whistle-indicator",
				order: 98,
				fixed: true,
				render: () => (
					<WhistleIndicatorLayer
						subscribe={indicatorSubscribe}
						getSnapshot={indicatorGetSnapshot}
						store={ctx.store}
					/>
				),
			});
			cleanups.push(() => ctx.layers.unregister("whistle-indicator"));
		},

		teardown() {
			for (const fn of cleanups) fn();
			cleanups.length = 0;
			indicators = [];
			indicatorListeners.clear();
		},
	};
}

export function createWhistlePlugin(wsProvider: WsProviderHandle): UsketchPlugin {
	return createPlugin(wsProvider);
}

export const whistlePlugin: UsketchPlugin = createPlugin();
