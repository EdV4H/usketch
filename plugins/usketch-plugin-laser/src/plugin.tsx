import type {
	CanvasPointerEvent,
	LayerRenderContext,
	PluginContext,
	ToolContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { useEffect, useRef } from "react";

/** 各ポイントが生存する時間（ms） */
const POINT_LIFETIME = 2500;
/** ポイント取得の最小間隔（ms） */
const EMIT_INTERVAL = 16;

const LASER_COLORS = ["#ff0000", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#e84393"];

function getUserLaserColor(userId: string): string {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = (hash * 31 + userId.charCodeAt(i)) | 0;
	}
	return LASER_COLORS[Math.abs(hash) % LASER_COLORS.length];
}

type Pt = { x: number; y: number; t: number };

/** ストローク1本分 */
interface Stroke {
	points: Pt[];
	color: string;
	finished: boolean;
}

/**
 * 全ストロークを管理するシングルトン。
 * レイヤーのrAFループからreadだけ、ロジック側からwriteする。
 */
const strokeStore = {
	strokes: new Map<string, Stroke>(),
	/** rAFを起動するためのコールバック（LaserCanvasが設定） */
	onStrokeAdded: null as (() => void) | null,

	getOrCreate(key: string, color: string): Stroke {
		let s = this.strokes.get(key);
		if (!s) {
			s = { points: [], color, finished: false };
			this.strokes.set(key, s);
		}
		return s;
	},

	reset(key: string, color: string): Stroke {
		const s: Stroke = { points: [], color, finished: false };
		this.strokes.set(key, s);
		this.onStrokeAdded?.();
		return s;
	},

	addPoint(key: string, point: { x: number; y: number }, color: string) {
		const stroke = this.getOrCreate(key, color);
		stroke.points.push({ x: point.x, y: point.y, t: Date.now() });
		this.onStrokeAdded?.();
	},

	remove(key: string) {
		this.strokes.delete(key);
	},
};

/**
 * Canvas2Dで全レーザーストロークを描画するコンポーネント。
 * rAFループで毎フレーム描画するので、Reactの再レンダリングに依存しない。
 */
function LaserCanvas({ ctx: renderCtx }: { ctx: LayerRenderContext }) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const rafRef = useRef<number>(0);
	const viewportRef = useRef(renderCtx.viewport);
	viewportRef.current = renderCtx.viewport;

	useEffect(() => {
		if (!canvasRef.current) return;
		const canvas: HTMLCanvasElement = canvasRef.current;
		const c2d: CanvasRenderingContext2D = canvas.getContext("2d") as CanvasRenderingContext2D;
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

			const { x: vx, y: vy, zoom } = viewportRef.current;
			const now = Date.now();
			let hasContent = false;

			for (const [key, stroke] of strokeStore.strokes) {
				// 期限切れポイントを除去
				stroke.points = stroke.points.filter((p) => now - p.t < POINT_LIFETIME);

				if (stroke.points.length === 0) {
					strokeStore.strokes.delete(key);
					continue;
				}

				hasContent = true;
				const pts = stroke.points;
				const color = stroke.color;

				// ワールド座標→スクリーン座標
				const screenPts = pts.map((p) => ({
					x: p.x * zoom + vx,
					y: p.y * zoom + vy,
					t: p.t,
				}));

				if (screenPts.length < 2) continue;

				// 全ポイントの平均lifeでストローク全体のopacityを決定
				// （尻尾の消滅は古いポイントのfilterで実現済み）
				let totalLife = 0;
				for (const p of screenPts) {
					totalLife += Math.max(0, 1 - (now - p.t) / POINT_LIFETIME);
				}
				const avgLife = totalLife / screenPts.length;

				// Catmull-Romスプラインを1つのPathとして構築
				c2d.lineCap = "round";
				c2d.lineJoin = "round";

				c2d.beginPath();
				c2d.moveTo(screenPts[0].x, screenPts[0].y);
				for (let i = 0; i < screenPts.length - 1; i++) {
					const p0 = screenPts[Math.max(0, i - 1)];
					const p1 = screenPts[i];
					const p2 = screenPts[Math.min(screenPts.length - 1, i + 1)];
					const p3 = screenPts[Math.min(screenPts.length - 1, i + 2)];

					const cp1x = p1.x + (p2.x - p0.x) / 6;
					const cp1y = p1.y + (p2.y - p0.y) / 6;
					const cp2x = p2.x - (p3.x - p1.x) / 6;
					const cp2y = p2.y - (p3.y - p1.y) / 6;

					c2d.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
				}

				// グロー（1回のstroke）
				c2d.globalAlpha = avgLife * 0.12;
				c2d.strokeStyle = color;
				c2d.lineWidth = 8;
				c2d.stroke();

				// メインストローク（同じpath、1回のstroke）
				c2d.globalAlpha = avgLife * 0.85;
				c2d.lineWidth = 3;
				c2d.stroke();

				// 芯線（同じpath、1回のstroke）
				c2d.globalAlpha = avgLife * 0.35;
				c2d.strokeStyle = "#fff";
				c2d.lineWidth = 1.2;
				c2d.stroke();
			}

			c2d.globalAlpha = 1;

			if (hasContent || strokeStore.strokes.size > 0) {
				rafRef.current = requestAnimationFrame(draw);
			} else {
				rafRef.current = 0;
			}
		}

		// ストローク追加時にrAFループを起動するコールバック
		strokeStore.onStrokeAdded = () => {
			if (rafRef.current === 0 && running) {
				rafRef.current = requestAnimationFrame(draw);
			}
		};

		// 初回起動
		if (strokeStore.strokes.size > 0) {
			rafRef.current = requestAnimationFrame(draw);
		}

		return () => {
			running = false;
			strokeStore.onStrokeAdded = null;
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
			}
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

function LaserIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<title>Laser</title>
			<line
				x1="3"
				y1="17"
				x2="14"
				y2="6"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
			<circle cx="15" cy="5" r="2" fill="currentColor" opacity="0.8" />
			<line x1="15" y1="1" x2="15" y2="3" stroke="currentColor" strokeWidth="1" opacity="0.5" />
			<line x1="18" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
			<line
				x1="17.5"
				y1="2.5"
				x2="16.5"
				y2="3.5"
				stroke="currentColor"
				strokeWidth="1"
				opacity="0.5"
			/>
		</svg>
	);
}

function createPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-laser",
		name: "レーザーポインタ",

		setup(ctx: PluginContext) {
			// fixedレイヤーとしてCanvas2Dを登録（ビューポート変換は自前で行う）
			ctx.layers.register({
				id: "laser",
				order: 90,
				fixed: true,
				render: (renderCtx) => <LaserCanvas ctx={renderCtx} />,
			});

			// rAFを起動するためのヘルパー — strokeStoreに書き込むだけで描画される
			function startStroke(key: string, color: string) {
				strokeStore.reset(key, color);
			}

			function addPointToStroke(key: string, point: { x: number; y: number }, color: string) {
				strokeStore.addPoint(key, point, color);
			}

			function finishStroke(key: string) {
				const stroke = strokeStore.strokes.get(key);
				if (stroke) stroke.finished = true;
			}

			// ── リモート ──
			let unsubBroadcast: (() => void) | undefined;
			if (wsProvider) {
				unsubBroadcast = wsProvider.onBroadcast((msg) => {
					if (msg.kind !== "laser-point") return;

					const position = msg.position as Record<string, unknown> | undefined;
					const source = typeof msg.sourceUserId === "string" ? msg.sourceUserId : "remote";
					const color = typeof msg.color === "string" ? msg.color : "#ff0000";

					if (!position || typeof position.x !== "number" || typeof position.y !== "number") {
						return;
					}

					if (msg.isStart === true) {
						startStroke(source, color);
					}

					addPointToStroke(source, { x: position.x, y: position.y }, color);

					if (msg.isEnd === true) {
						finishStroke(source);
					}
				});
			}

			// ── ローカル ──
			let lastEmitTime = 0;
			let isDrawing = false;
			const LOCAL_KEY = wsProvider ? String(wsProvider.awareness.doc.clientID) : "local";
			const laserColor = getUserLaserColor(LOCAL_KEY);

			function addPoint(point: { x: number; y: number }, isStart: boolean, isEnd = false) {
				const now = Date.now();
				if (!isStart && !isEnd && now - lastEmitTime < EMIT_INTERVAL) return;
				lastEmitTime = now;

				if (isStart) {
					startStroke(LOCAL_KEY, laserColor);
				}

				addPointToStroke(LOCAL_KEY, point, laserColor);

				if (isEnd) {
					finishStroke(LOCAL_KEY);
				}

				wsProvider?.broadcast({
					kind: "laser-point",
					sourceUserId: LOCAL_KEY,
					position: point,
					color: laserColor,
					isStart,
					isEnd,
				});
			}

			ctx.tools.register("laser", {
				icon: LaserIcon,
				cursor: "crosshair",
				shortcut: "l",
				order: 60,
				onPointerDown: (_tc: ToolContext, e: CanvasPointerEvent) => {
					isDrawing = true;
					addPoint(e.worldPoint, true);
				},
				onPointerMove: (_tc: ToolContext, e: CanvasPointerEvent) => {
					if (!isDrawing) return;
					addPoint(e.worldPoint, false);
				},
				onPointerUp: (_tc: ToolContext, e: CanvasPointerEvent) => {
					if (!isDrawing) return;
					addPoint(e.worldPoint, false, true);
					isDrawing = false;
				},
			});

			cleanup = () => {
				unsubBroadcast?.();
				ctx.layers.unregister("laser");
				strokeStore.strokes.clear();
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}

/** WsProvider付きファクトリ（リアルタイム同期対応） */
export function createLaserPlugin(wsProvider: WsProviderHandle): UsketchPlugin {
	return createPlugin(wsProvider);
}

/** ローカル専用 */
export const laserPlugin: UsketchPlugin = createPlugin();
