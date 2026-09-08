import type { CanvasPointerEvent, PluginContext } from "@edv4h/usketch-shared";
import { screenToWorld } from "@edv4h/usketch-shared";
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
	let lastPointer: CanvasPointerEvent | null = null;
	let pointerDown = false;
	let dragActive = false;
	let loop: number | null = null;
	// 自分が emit した合成 pointermove 由来のイベントを無視するためのガード。
	let emittingSynthetic = false;

	const emitFollow = () => {
		if (!lastPointer) return;
		const vp = ctx.store.getViewport();
		const world = screenToWorld(lastPointer.screenPoint.x, lastPointer.screenPoint.y, vp);
		emittingSynthetic = true;
		try {
			// screenPoint は据え置き、worldPoint だけ新 viewport で再計算 → ドラッグ中のツールが
			// 掴んでいる shape をカーソル下へ追従させる（本プラグインは shape を直接動かさない）。
			ctx.events.emit("canvas:pointermove", { ...lastPointer, worldPoint: world });
		} finally {
			emittingSynthetic = false;
		}
	};

	const frame = () => {
		loop = null;
		if (!dragActive || !lastPointer) return;
		const settings = resolve();
		if (settings.enabled) {
			const { dx, dy } = edgePanDelta(lastPointer.screenPoint, canvasSize(), settings);
			if (dx !== 0 || dy !== 0) {
				ctx.store.panBy(dx, dy);
				emitFollow();
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
		if (loop !== null) {
			cancelFrame(loop);
			loop = null;
		}
	};

	const offDown = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", (event) => {
		if (emittingSynthetic) return;
		pointerDown = true;
		lastPointer = event;
	});

	const offMove = ctx.events.on<CanvasPointerEvent>("canvas:pointermove", (event) => {
		if (emittingSynthetic) return;
		lastPointer = event;
	});

	const offUp = ctx.events.on<CanvasPointerEvent>("canvas:pointerup", () => {
		stop();
	});

	// shape が動いた＝ドラッグ中とみなす（select ツールのライブ移動を検知）。dashboard と同型。
	const offUpdated = ctx.events.on<ShapeUpdatedPayload>("shape:updated", (payload) => {
		if (emittingSynthetic || !pointerDown || dragActive) return;
		const id = payload?.after?.id ?? payload?.id;
		if (!id) return;
		const selection = ctx.store.getSelection();
		if (!selection.has(id)) return;
		dragActive = true;
		startLoop();
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
