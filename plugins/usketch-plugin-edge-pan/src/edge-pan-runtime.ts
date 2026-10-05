import type { CanvasPointerEvent, PluginContext } from "@edv4h/usketch-shared";
import { edgePanDelta, type ResolvedEdgePan } from "./edge-pan-config.js";

/** rAF ラッパ（SSR/テストでは setTimeout フォールバック）。 */
function scheduleFrame(fn: () => void): number {
	if (typeof requestAnimationFrame === "function") return requestAnimationFrame(fn);
	return setTimeout(fn, 16) as unknown as number;
}
function cancelFrame(handle: number): void {
	if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle);
	else clearTimeout(handle);
}

/**
 * canvas コンテナの画面上サイズ。minimap も同じ data-testid を持つので、面積最大の要素を採る。
 * 見つからなければ window にフォールバック。
 */
function canvasSize(): { width: number; height: number } {
	if (typeof document !== "undefined") {
		const nodes = Array.from(document.querySelectorAll('[data-testid="canvas-container"]'));
		let best: { width: number; height: number } | null = null;
		for (const node of nodes) {
			const rect = (node as HTMLElement).getBoundingClientRect();
			if (!best || rect.width * rect.height > best.width * best.height) {
				best = { width: rect.width, height: rect.height };
			}
		}
		if (best && best.width > 0 && best.height > 0) return best;
	}
	if (typeof window !== "undefined")
		return { width: window.innerWidth, height: window.innerHeight };
	return { width: 0, height: 0 };
}

interface ShapeUpdatedPayload {
	after?: { id?: string };
	before?: { id?: string };
	id?: string;
}

/**
 * edge-pan ランタイムを起動する。`resolve()` は毎フレーム最新設定を返すこと（getter/HUD 反映用）。
 * 返り値は teardown。
 */
export function setupEdgePan(ctx: PluginContext, resolve: () => ResolvedEdgePan): () => void {
	// setup 時点の updateShape を掴む。snap プラグインは updateShape をモンキーパッチして
	// pointerDown 中の位置更新をガイドへスナップするが、自動パンの追従移動は「画角補正」であって
	// ユーザー操作ではないためスナップさせたくない。edge-pan を snap より先に登録しておけば、
	// ここで掴めるのはパッチ前の生 updateShape なので、追従だけこれを使ってスナップを回避する。
	const rawUpdateShape = ctx.store.updateShape.bind(ctx.store);

	let lastPointer: CanvasPointerEvent | null = null;
	let pointerDown = false;
	let dragActive = false;
	let loop: number | null = null;
	// ドラッグ中に動いている shape の id（select ツールが動かした root＋子孫を蓄積）。
	// 自動パン中はカーソルが止まっていてもツールが再計算しないので、これらを直接動かして追従させる。
	const movingIds = new Set<string>();
	// 自分の直接移動由来の shape:updated を弾くガード。
	let applyingFollow = false;

	const frame = () => {
		loop = null;
		if (!dragActive || !lastPointer) return;
		const settings = resolve();
		if (settings.enabled) {
			const { dx, dy } = edgePanDelta(lastPointer.screenPoint, canvasSize(), settings);
			if (dx !== 0 || dy !== 0) {
				const before = ctx.store.getViewport();
				ctx.store.panBy(dx, dy);
				const after = ctx.store.getViewport();
				// viewport constraint でクランプされ得るので、実際に動いた分だけ追従させる。
				const appliedDx = after.x - before.x;
				const appliedDy = after.y - before.y;
				if ((appliedDx !== 0 || appliedDy !== 0) && after.zoom > 0 && movingIds.size > 0) {
					// 画面上で掴んだ位置に留めるためのワールド移動量（画面 = worldX*zoom + vp.x が不変）。
					const wdx = -appliedDx / after.zoom;
					const wdy = -appliedDy / after.zoom;
					applyingFollow = true;
					try {
						for (const id of movingIds) {
							const shape = ctx.store.getShape(id);
							// snap をバイパスして生 updateShape で動かす（ガイドに貼り付いて止まるのを防ぐ）。
							if (shape) rawUpdateShape(id, { x: shape.x + wdx, y: shape.y + wdy });
						}
					} finally {
						applyingFollow = false;
					}
				}
			}
		}
		loop = scheduleFrame(frame);
	};

	const startLoop = () => {
		if (loop === null) loop = scheduleFrame(frame);
	};

	const stop = () => {
		dragActive = false;
		pointerDown = false;
		movingIds.clear();
		if (loop !== null) {
			cancelFrame(loop);
			loop = null;
		}
	};

	const offDown = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", (event) => {
		pointerDown = true;
		lastPointer = event;
	});

	const offMove = ctx.events.on<CanvasPointerEvent>("canvas:pointermove", (event) => {
		lastPointer = event;
	});

	const offUp = ctx.events.on<CanvasPointerEvent>("canvas:pointerup", () => {
		stop();
	});

	// shape が動いた＝ドラッグ中とみなす（select ツールのライブ移動を検知）。
	// 最初の 1 つは「選択中の shape」で開始判定し、以降は動いた id をすべて追従対象に蓄積（子孫も拾う）。
	const offUpdated = ctx.events.on<ShapeUpdatedPayload>("shape:updated", (payload) => {
		if (applyingFollow || !pointerDown) return;
		const id = payload?.after?.id ?? payload?.id;
		if (!id) return;
		if (!dragActive) {
			if (!ctx.store.getSelection().has(id)) return;
			dragActive = true;
			startLoop();
		}
		movingIds.add(id);
	});

	const offMoveEnd = ctx.events.on("shapes:move-end", () => stop());

	return () => {
		offDown();
		offMove();
		offUp();
		offUpdated();
		offMoveEnd();
		stop();
	};
}
