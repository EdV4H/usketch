// createStartPositionPlugin — lets a board define where it should START (a
// coordinate, an exact framing, or a shape to frame) and moves each viewer's
// camera there on load. The *definition* lives on a synced data-only shape; the
// *camera move* is a per-user, ephemeral act that cooperates with other camera
// plugins (e.g. deep-link) through the `viewport:claimed` protocol.
import type {
	ActionParam,
	PluginContext,
	ShapeData,
	StoreEvent,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { fitContent } from "@edv4h/usketch-shared";
import { applyStartPosition, captureViewport } from "./resolve.js";
import {
	createStartPositionShapeDefinition,
	findStartPosition,
	makeStartPosition,
	START_POSITION_TYPE,
	type StartPosition,
	type StartPositionShapeData,
} from "./start-position-shape.js";
import { claimViewport, START_POSITION_PRIORITY, watchViewportClaims } from "./viewport-claim.js";

/** How long to wait for the start-position shape to arrive via CRDT sync on load. */
const SYNC_TIMEOUT_MS = 5000;

const SOURCE = "start-position";

interface Form {
	x: number;
	y: number;
	pinZoom: boolean;
	zoom: number;
}

/** The x/y/pinZoom/zoom the HUD shows for a shape's current start (defaults when none). */
function formOf(shape: StartPositionShapeData | null): Form {
	const st = shape?.start;
	if (st?.kind === "viewport") return { x: st.x, y: st.y, pinZoom: true, zoom: st.zoom };
	if (st?.kind === "coordinate") return { x: st.x, y: st.y, pinZoom: false, zoom: 1 };
	return { x: 0, y: 0, pinZoom: false, zoom: 1 };
}

/** Build a coordinate/viewport start from an (edited) form. */
function startOfForm(f: Form): StartPosition {
	return f.pinZoom
		? { kind: "viewport", x: f.x, y: f.y, zoom: f.zoom }
		: { kind: "coordinate", x: f.x, y: f.y };
}

export function createStartPositionPlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-start-position",
		name: "スタート位置",

		setup(ctx: PluginContext) {
			ctx.shapes.register(START_POSITION_TYPE, createStartPositionShapeDefinition());

			const currentShape = (): StartPositionShapeData | null =>
				findStartPosition(ctx.store.getShapes().values());

			// The singleton shape, creating it (synced) the first time a start is set.
			const ensureShape = (): string => {
				const s = currentShape();
				if (s) return s.id;
				const shape = makeStartPosition();
				ctx.store.addShape(shape);
				return shape.id;
			};

			const setStart = (start: StartPosition): void => {
				ctx.store.updateShape(ensureShape(), { start } as Partial<ShapeData>);
			};

			const setFormField = <K extends keyof Form>(field: K, value: Form[K]): void => {
				const next = { ...formOf(currentShape()), [field]: value };
				setStart(startOfForm(next));
			};

			// ── HUD settings: coordinate inputs + zoom pin + auto-apply ──
			const fields: ActionParam[] = [
				{ name: "x", label: "X 座標", type: "number", step: 1 },
				{ name: "y", label: "Y 座標", type: "number", step: 1 },
				{ name: "pinZoom", label: "ズームを固定", type: "boolean" },
				{ name: "zoom", label: "ズーム", type: "number", min: 0.1, max: 10, step: 0.1 },
				{ name: "autoApply", label: "起動時に移動", type: "boolean" },
			];

			const unregisterSettings = ctx.hud.registerSettings({
				id: "usketch-start-position:settings",
				label: "スタート位置",
				fields,
				get: (name) => {
					const shape = currentShape();
					if (name === "autoApply") return shape?.autoApply !== false;
					return formOf(shape)[name as keyof Form];
				},
				set: (name, value) => {
					if (name === "autoApply") {
						ctx.store.updateShape(ensureShape(), {
							autoApply: value === true || value === "true",
						} as Partial<ShapeData>);
					} else if (name === "pinZoom") {
						setFormField("pinZoom", value === true || value === "true");
					} else if (name === "x" || name === "y" || name === "zoom") {
						const n = Number(value);
						if (Number.isFinite(n)) setFormField(name, n);
					}
				},
				// Re-read when the shape changes (incl. edits from another client), not on
				// every pan/zoom — filter to shape mutations only.
				subscribe: (listener) =>
					ctx.store.onMutation((e: StoreEvent) => {
						if (
							e.type === "shape:added" ||
							e.type === "shape:removed" ||
							e.type === "shape:updated"
						)
							listener();
					}),
			});

			// ── Actions ──
			const goToStart = (animate: boolean): void => {
				const s = currentShape();
				if (!s?.start) return;
				const ok = applyStartPosition(ctx.store, s.start, { animate });
				// A "shape" start whose shape was deleted → frame all content instead.
				if (!ok) fitContent(ctx.store, { animate });
			};

			const offs: Array<() => void> = [
				ctx.actions.register({
					id: "start-position:go",
					group: "スタート位置",
					label: "スタート位置へ移動",
					isEnabled: () => currentShape()?.start != null,
					run: () => goToStart(true),
				}),
				ctx.actions.register({
					id: "start-position:capture-view",
					group: "スタート位置",
					label: "現在の画角をスタートに設定",
					run: () => setStart({ kind: "viewport", ...captureViewport(ctx.store) }),
				}),
				ctx.actions.register({
					id: "start-position:from-selection",
					group: "スタート位置",
					label: "選択Shapeをスタートに設定",
					// Exactly one shape selected, and not the (locked) start shape itself.
					isEnabled: () => {
						const sel = [...ctx.store.getSelection()];
						return sel.length === 1 && ctx.store.getShape(sel[0])?.type !== START_POSITION_TYPE;
					},
					run: () => {
						const sel = [...ctx.store.getSelection()];
						if (sel.length === 1) setStart({ kind: "shape", shapeId: sel[0] });
					},
				}),
				ctx.actions.register({
					id: "start-position:clear",
					group: "スタート位置",
					label: "スタート位置をクリア",
					isEnabled: () => currentShape() != null,
					run: () => {
						const s = currentShape();
						if (s) ctx.store.deleteShape(s.id);
					},
				}),
			];

			// ── Auto-apply on load (per-user, once, cooperating with deep-link) ──
			const guard = watchViewportClaims(ctx.events, SOURCE, START_POSITION_PRIORITY);
			let disposed = false;
			let settled = false;
			let waitTimer: ReturnType<typeof setTimeout> | null = null;
			let applyTimer: ReturnType<typeof setTimeout> | null = null;
			let offWait: (() => void) | null = null;

			const finishWait = (): void => {
				settled = true;
				if (waitTimer) {
					clearTimeout(waitTimer);
					waitTimer = null;
				}
				if (offWait) {
					offWait();
					offWait = null;
				}
			};

			// Move the camera to `start`, deferred a task so competing claims (deep-link
			// emits on a microtask, which runs before this timeout) are recorded before
			// we decide to yield. Tracked so teardown (StrictMode remount, board switch)
			// can cancel it — otherwise it could move the camera after disposal.
			// `fallbackFitAll` frames all content when a shape target can't be resolved.
			const applyOnLoad = (start: StartPosition, fallbackFitAll: boolean): void => {
				applyTimer = setTimeout(() => {
					applyTimer = null;
					if (disposed || guard.shouldYield()) return;
					if (applyStartPosition(ctx.store, start, { animate: false })) {
						claimViewport(ctx.events, SOURCE, START_POSITION_PRIORITY);
					} else if (fallbackFitAll) {
						// Shape target never resolved (deleted / never synced) → frame all.
						fitContent(ctx.store, { animate: false });
					}
				}, 0);
			};

			const attemptAutoApply = (): void => {
				if (settled) return;
				const s = currentShape();
				if (!s) return; // start-position shape not synced in yet — keep waiting
				if (s.autoApply === false || !s.start) {
					finishWait();
					return;
				}
				const start = s.start;
				// A shape target may still be streaming in via CRDT; keep waiting for it
				// (up to the timeout) rather than settling and framing all content early.
				if (start.kind === "shape" && !ctx.store.getShape(start.shapeId)) return;
				finishWait();
				applyOnLoad(start, false);
			};

			attemptAutoApply();
			if (!settled) {
				offWait = ctx.store.onMutation((e: StoreEvent) => {
					if (e.type === "shape:added") attemptAutoApply();
				});
				// Timed out waiting for the (start-position or referenced) shape to sync.
				// Apply whatever is defined now, falling back to fit-all if a shape target
				// is still missing — matching the documented "frame all if gone" behavior.
				waitTimer = setTimeout(() => {
					if (settled) return;
					const s = currentShape();
					finishWait();
					if (s && s.autoApply !== false && s.start) applyOnLoad(s.start, true);
				}, SYNC_TIMEOUT_MS);
			}

			return () => {
				disposed = true;
				if (applyTimer) {
					clearTimeout(applyTimer);
					applyTimer = null;
				}
				finishWait();
				guard.dispose();
				unregisterSettings();
				for (const off of offs) off();
			};
		},
	};
}
