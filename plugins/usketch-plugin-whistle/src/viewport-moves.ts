// ホイッスルの移動 (カメラ操作)。BoardStore を受け取る純関数として公開し、
// plugin 本体とサービスはこれを呼ぶだけにする。
//
// shared の centerOnWorld は window サイズを画面サイズとみなすが、host によっては
// キャンバスが window より小さい (サイドナビ等)。そのため画面サイズは呼び出し側
// (オーバーレイが ResizeObserver で測ったキャンバスの大きさ) から受け取る。
import {
	type BoardStore,
	type Point,
	screenToWorld,
	type Viewport,
	viewportAnchoredAt,
	viewportRotation,
} from "@edv4h/usketch-shared";

export interface ScreenSize {
	width: number;
	height: number;
}

/** 現在の画面中央にある world 座標。 */
export function screenCenterWorldIn(store: BoardStore, size: ScreenSize): Point {
	return screenToWorld(size.width / 2, size.height / 2, store.getViewport());
}

/** world `point` が画面中央に来る viewport (回転は今のまま)。 */
export function viewportCenteredOn(
	current: Viewport,
	point: Point,
	size: ScreenSize,
	zoom = current.zoom,
): Viewport {
	return viewportAnchoredAt(
		point,
		{ x: size.width / 2, y: size.height / 2 },
		zoom,
		viewportRotation(current),
	);
}

export interface MoveOptions {
	/** false で即時 (reduced motion 等)。既定 true。 */
	animate?: boolean;
	durationMs?: number;
}

/** スムーズに world `point` を画面中央へ (集合・おーいのバッジ・追従で使う)。 */
export function moveToWorld(
	store: BoardStore,
	point: Point,
	size: ScreenSize,
	opts: MoveOptions & { zoom?: number } = {},
): void {
	const target = viewportCenteredOn(store.getViewport(), point, size, opts.zoom);
	store.animateViewportTo(target, {
		animate: opts.animate ?? true,
		durationMs: opts.durationMs ?? 500,
	});
}

/** スウープ移動の 2 段階。テスト用に計算だけを切り出す。 */
export interface SwoopPlan {
	/** 1 段目 (引き)。近いときは null で、2 段目だけを長めに動かす。 */
	outward: Viewport | null;
	target: Viewport;
}

/**
 * 一度引いてから寄る「スウープ」移動の計画。今の画面中央と行き先が
 * 両方収まるズームまで引き、中点を経由して行き先のズームで寄る。
 * 行き先がすでに近い (引く必要がない) ときは 1 段だけにする。
 */
export function planSwoop(
	current: Viewport,
	point: Point,
	size: ScreenSize,
	zoom = current.zoom,
): SwoopPlan {
	const target = viewportCenteredOn(current, point, size, zoom);
	const from = screenToWorld(size.width / 2, size.height / 2, current);
	const dist = Math.hypot(point.x - from.x, point.y - from.y);
	const fitZoom = (Math.min(size.width, size.height) * 0.8) / Math.max(dist, 1);
	const baseZoom = Math.min(current.zoom, zoom);
	const outZoom = Math.max(fitZoom, 0.1);
	// 両方がすでに画面に収まる距離か、すでに最小ズーム付近でこれ以上引けないなら
	// 引かずに 1 段で動かす。
	if (outZoom >= baseZoom * 0.9) return { outward: null, target };
	const mid = { x: (from.x + point.x) / 2, y: (from.y + point.y) / 2 };
	return { outward: viewportCenteredOn(current, mid, size, outZoom), target };
}

const SWOOP_OUT_MS = 450;
const SWOOP_IN_MS = 550;
const SWOOP_SINGLE_MS = 700;

/**
 * スウープ移動を実行する (全員集合で使う)。返り値はキャンセル関数
 * (2 段目のタイマーを止める)。`animate: false` なら行き先へ即時移動。
 */
export function swoopToWorld(
	store: BoardStore,
	point: Point,
	size: ScreenSize,
	opts: { zoom?: number; animate?: boolean } = {},
): () => void {
	const plan = planSwoop(store.getViewport(), point, size, opts.zoom);
	if (opts.animate === false) {
		store.animateViewportTo(plan.target, { animate: false });
		return () => {};
	}
	if (!plan.outward) {
		store.animateViewportTo(plan.target, { animate: true, durationMs: SWOOP_SINGLE_MS });
		return () => {};
	}
	store.animateViewportTo(plan.outward, { animate: true, durationMs: SWOOP_OUT_MS });
	const timer = setTimeout(() => {
		store.animateViewportTo(plan.target, { animate: true, durationMs: SWOOP_IN_MS });
	}, SWOOP_OUT_MS);
	return () => clearTimeout(timer);
}
