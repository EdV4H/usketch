import type {
	CanvasPointerEvent,
	LayerRenderContext,
	PluginContext,
	ToolContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { useEffect, useRef } from "react";

const SPOTLIGHT_RADIUS = 150;

/** スポットライトの状態（モジュールレベルシングルトン） */
const spotlightState: {
	active: boolean;
	worldX: number;
	worldY: number;
	onUpdate: (() => void) | null;
} = {
	active: false,
	worldX: 0,
	worldY: 0,
	onUpdate: null,
};

function SpotlightCanvas({ ctx: renderCtx }: { ctx: LayerRenderContext }) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const rafRef = useRef<number>(0);
	const viewportRef = useRef(renderCtx.viewport);
	viewportRef.current = renderCtx.viewport;

	useEffect(() => {
		if (!canvasRef.current) return;
		const canvas: HTMLCanvasElement = canvasRef.current;
		const c2d = canvas.getContext("2d") as CanvasRenderingContext2D;
		if (!c2d) return;
		let running = true;

		function draw() {
			if (!running) return;

			const dpr = window.devicePixelRatio || 1;
			const w = window.innerWidth;
			const h = window.innerHeight;

			if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
				canvas.width = w * dpr;
				canvas.height = h * dpr;
				canvas.style.width = `${w}px`;
				canvas.style.height = `${h}px`;
			}

			c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
			c2d.clearRect(0, 0, w, h);

			if (spotlightState.active) {
				const { x: vx, y: vy, zoom } = viewportRef.current;
				// ワールド座標→スクリーン座標
				const screenX = spotlightState.worldX * zoom + vx;
				const screenY = spotlightState.worldY * zoom + vy;
				const screenRadius = SPOTLIGHT_RADIUS * zoom;

				// 全画面を暗くする
				c2d.fillStyle = "rgba(0, 0, 0, 0.6)";
				c2d.fillRect(0, 0, w, h);

				// 穴を開ける（destination-outで円形を切り抜き）
				c2d.globalCompositeOperation = "destination-out";
				c2d.beginPath();
				c2d.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
				c2d.fill();

				// ソフトエッジ（グラデーション）
				const gradient = c2d.createRadialGradient(
					screenX,
					screenY,
					screenRadius * 0.8,
					screenX,
					screenY,
					screenRadius,
				);
				gradient.addColorStop(0, "rgba(0,0,0,1)");
				gradient.addColorStop(1, "rgba(0,0,0,0)");
				c2d.fillStyle = gradient;
				c2d.beginPath();
				c2d.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
				c2d.fill();

				c2d.globalCompositeOperation = "source-over";

				rafRef.current = requestAnimationFrame(draw);
			} else {
				rafRef.current = 0;
			}
		}

		// 状態変更通知用コールバック
		spotlightState.onUpdate = () => {
			if (rafRef.current === 0 && running) {
				rafRef.current = requestAnimationFrame(draw);
			}
		};

		if (spotlightState.active) {
			rafRef.current = requestAnimationFrame(draw);
		}

		return () => {
			running = false;
			spotlightState.onUpdate = null;
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
			}}
		/>
	);
}

function notifyUpdate() {
	spotlightState.onUpdate?.();
}

function SpotlightIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<title>Spotlight</title>
			<circle cx="10" cy="10" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
			<circle
				cx="10"
				cy="10"
				r="8"
				fill="none"
				stroke="currentColor"
				strokeWidth="0.5"
				opacity="0.4"
			/>
			<circle cx="10" cy="10" r="2" fill="currentColor" opacity="0.6" />
		</svg>
	);
}

function createPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	return {
		id: "usketch-plugin-spotlight",
		name: "スポットライト",

		setup(ctx: PluginContext) {
			// fixedレイヤーとしてCanvas2Dを登録
			ctx.layers.register({
				id: "spotlight",
				order: 95,
				fixed: true,
				render: (renderCtx) => <SpotlightCanvas ctx={renderCtx} />,
			});

			let isActive = false;

			let unsubBroadcast: (() => void) | undefined;
			if (wsProvider) {
				unsubBroadcast = wsProvider.onBroadcast((msg) => {
					if (msg.kind === "spotlight-update") {
						const position = msg.position as Record<string, unknown> | undefined;
						if (!position || typeof position.x !== "number" || typeof position.y !== "number") {
							return;
						}
						spotlightState.active = true;
						spotlightState.worldX = position.x;
						spotlightState.worldY = position.y;
						notifyUpdate();
					} else if (msg.kind === "spotlight-dismiss") {
						spotlightState.active = false;
						notifyUpdate();
					}
				});
			}

			function updateSpotlight(point: { x: number; y: number }) {
				spotlightState.active = true;
				spotlightState.worldX = point.x;
				spotlightState.worldY = point.y;
				notifyUpdate();

				wsProvider?.broadcast({
					kind: "spotlight-update",
					sourceUserId: "local",
					position: point,
				});
			}

			function dismissSpotlight() {
				spotlightState.active = false;
				notifyUpdate();
				wsProvider?.broadcast({ kind: "spotlight-dismiss" });
			}

			const TOOL_ID = "spotlight";

			ctx.tools.register(TOOL_ID, {
				icon: SpotlightIcon,
				cursor: "crosshair",
				shortcut: "o",
				order: 70,
				onPointerDown: (_toolCtx: ToolContext, event: CanvasPointerEvent) => {
					if (isActive) {
						dismissSpotlight();
						isActive = false;
						ctx.store.setActiveToolId("select");
					} else {
						updateSpotlight(event.worldPoint);
						isActive = true;
					}
				},
				onPointerMove: (_toolCtx: ToolContext, event: CanvasPointerEvent) => {
					if (!isActive) return;
					updateSpotlight(event.worldPoint);
				},
			});

			let wasToolActive = ctx.store.getActiveToolId() === TOOL_ID;
			const unsubToolChange = ctx.store.subscribe(() => {
				const isToolActive = ctx.store.getActiveToolId() === TOOL_ID;
				if (!isToolActive && wasToolActive && isActive) {
					dismissSpotlight();
					isActive = false;
				}
				wasToolActive = isToolActive;
			});

			return () => {
				unsubBroadcast?.();
				unsubToolChange();
				ctx.layers.unregister("spotlight");
				spotlightState.active = false;
			};
		},
	};
}

export function createSpotlightPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	return createPlugin(wsProvider);
}
