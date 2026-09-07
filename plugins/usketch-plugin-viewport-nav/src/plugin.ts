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

/** zoomSensitivity のクランプ既定範囲（極端な値で操作不能になるのを防ぐ）。
 * ホストは {@link ViewportNavOptions.zoomSensitivityRange} で上書きできる。 */
const DEFAULT_MIN_ZOOM_SENSITIVITY = 0.25;
const DEFAULT_MAX_ZOOM_SENSITIVITY = 6;

interface ZoomSensitivityRange {
	min: number;
	max: number;
}

export interface ViewportNavOptions {
	/**
	 * ホイール/トラックパッドのズーム感度。`1` が既定で従来相当。
	 * 大きいほど 1 操作あたりの倍率変化が大きくなる（{@link ViewportNavOptions.zoomSensitivityRange} にクランプ）。
	 *
	 * 設定 UI からの即時反映のため、値だけでなく「ライブに読む getter」も渡せる。
	 * getter は wheel イベントごとに評価される。
	 */
	zoomSensitivity?: number | (() => number);
	/**
	 * zoomSensitivity のクランプ範囲。既定 `{ min: 0.25, max: 6 }`。
	 * タッチ/トラックパッド主体のホストが可動域を広げる/狭める用途に使う。
	 * `min <= max` を満たさない/非有限な指定は無視して既定にフォールバックする。
	 */
	zoomSensitivityRange?: { min?: number; max?: number };
}

/** オプションの範囲指定を検証済みの {min,max} に解決する（不正値は既定へフォールバック）。 */
function resolveRange(range: ViewportNavOptions["zoomSensitivityRange"]): ZoomSensitivityRange {
	const min =
		typeof range?.min === "number" && Number.isFinite(range.min)
			? range.min
			: DEFAULT_MIN_ZOOM_SENSITIVITY;
	const max =
		typeof range?.max === "number" && Number.isFinite(range.max)
			? range.max
			: DEFAULT_MAX_ZOOM_SENSITIVITY;
	// 破綻した範囲（min > max）は既定に戻す。
	if (min > max) return { min: DEFAULT_MIN_ZOOM_SENSITIVITY, max: DEFAULT_MAX_ZOOM_SENSITIVITY };
	return { min, max };
}

/** number | (() => number) を解決し、range へクランプする。不正値は 1（既定感度）。 */
function resolveZoomSensitivity(
	source: ViewportNavOptions["zoomSensitivity"],
	range: ZoomSensitivityRange,
): number {
	const raw = typeof source === "function" ? source() : source;
	if (typeof raw !== "number" || !Number.isFinite(raw)) return 1;
	return Math.min(range.max, Math.max(range.min, raw));
}

export function createViewportNavPlugin(options?: ViewportNavOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-viewport-nav",
		name: "ビューポートナビゲーション",

		setup(ctx: PluginContext) {
			// ── Local pan state (scoped to this setup closure) ──
			let middlePanState: { lastPoint: Point } | null = null;

			// クランプ範囲は setup 時に一度だけ解決（zoomSensitivity 自体は getter で毎回読む）。
			const range = resolveRange(options?.zoomSensitivityRange);

			// ── Wheel: zoom & pan ──
			const offWheel = ctx.events.on<CanvasWheelEvent>("canvas:wheel", (event) => {
				if (event.ctrlKey || event.metaKey) {
					// Zoom toward cursor — factor は deltaY の大きさに比例（トラックパッドのピンチも滑らか）
					const viewport = ctx.store.getViewport();
					const sensitivity = resolveZoomSensitivity(options?.zoomSensitivity, range);
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
