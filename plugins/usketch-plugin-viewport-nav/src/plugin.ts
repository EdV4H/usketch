import type {
	CanvasPointerEvent,
	CanvasWheelEvent,
	PluginContext,
	Point,
	UsketchPlugin,
} from "@edv4h/usketch-shared";

/** ホイール/トラックパッドのズーム係数の基準ステップ。
 * 既定感度(=1)で deltaY≈100 → factor≈exp(-0.1)≈0.905、deltaY≈-100 → ≈1.105 となり、
 * 従来の固定 0.9 / 1.1 とほぼ同じ体感になる。 */
const ZOOM_STEP = 0.001;

/** zoomSensitivity のクランプ範囲（極端な値で操作不能になるのを防ぐ）。 */
const MIN_ZOOM_SENSITIVITY = 0.25;
const MAX_ZOOM_SENSITIVITY = 3;

export interface ViewportNavOptions {
	/**
	 * ホイール/トラックパッドのズーム感度。`1` が既定で従来相当。
	 * 大きいほど 1 操作あたりの倍率変化が大きくなる（{@link MIN_ZOOM_SENSITIVITY}〜{@link MAX_ZOOM_SENSITIVITY} にクランプ）。
	 *
	 * 設定 UI からの即時反映のため、値だけでなく「ライブに読む getter」も渡せる。
	 * getter は wheel イベントごとに評価される。
	 */
	zoomSensitivity?: number | (() => number);
}

/** number | (() => number) を解決し、有効な感度値へクランプする。 */
function resolveZoomSensitivity(source: ViewportNavOptions["zoomSensitivity"]): number {
	const raw = typeof source === "function" ? source() : source;
	if (typeof raw !== "number" || !Number.isFinite(raw)) return 1;
	return Math.min(MAX_ZOOM_SENSITIVITY, Math.max(MIN_ZOOM_SENSITIVITY, raw));
}

export function createViewportNavPlugin(options?: ViewportNavOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-viewport-nav",
		name: "ビューポートナビゲーション",

		setup(ctx: PluginContext) {
			// ── Local pan state (scoped to this setup closure) ──
			let middlePanState: { lastPoint: Point } | null = null;

			// ── Wheel: zoom & pan ──
			const offWheel = ctx.events.on<CanvasWheelEvent>("canvas:wheel", (event) => {
				if (event.ctrlKey || event.metaKey) {
					// Zoom toward cursor — factor は deltaY の大きさに比例（トラックパッドのピンチも滑らか）
					const viewport = ctx.store.getViewport();
					const sensitivity = resolveZoomSensitivity(options?.zoomSensitivity);
					const factor = Math.exp(-event.deltaY * ZOOM_STEP * sensitivity);
					ctx.store.zoomTo(viewport.zoom * factor, event.screenPoint);
				} else {
					// Pan
					ctx.store.panBy(-event.deltaX, -event.deltaY);
				}
			});

			// ── Middle-click pan ──
			const offMiddleDown = ctx.events.on<CanvasPointerEvent>("canvas:middle-down", (event) => {
				middlePanState = {
					lastPoint: { x: event.screenPoint.x, y: event.screenPoint.y },
				};
			});

			const offPointerMove = ctx.events.on<CanvasPointerEvent>("canvas:pointermove", (event) => {
				if (!middlePanState) return;

				const dx = event.screenPoint.x - middlePanState.lastPoint.x;
				const dy = event.screenPoint.y - middlePanState.lastPoint.y;

				ctx.store.panBy(dx, dy);

				middlePanState.lastPoint = {
					x: event.screenPoint.x,
					y: event.screenPoint.y,
				};
			});

			const offPointerUp = ctx.events.on<CanvasPointerEvent>("canvas:pointerup", (_event) => {
				middlePanState = null;
			});

			return () => {
				offWheel();
				offMiddleDown();
				offPointerMove();
				offPointerUp();
				middlePanState = null;
			};
		},
	};
}
