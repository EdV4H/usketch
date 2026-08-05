import type { BoardStore, StoreEvent } from "@edv4h/usketch-shared";
import { frameShapes } from "./frame.js";
import { decodeDeepLink } from "./url-state.js";

/** How long to wait for deep-linked shapes to arrive via CRDT sync before giving up. */
const SYNC_TIMEOUT_MS = 5000;

/**
 * Apply the deep link encoded in `search` to the board: select the referenced
 * shapes and move the viewport onto them (or to an explicit camera).
 *
 * Shapes referenced by the URL may not be in the store yet — they stream in via
 * Yjs sync after mount — so when any are missing we subscribe to `shape:added`
 * and retry until they all appear or {@link SYNC_TIMEOUT_MS} elapses.
 *
 * `onDone` fires exactly once, when application settles (immediately if there is
 * no anchor to apply). Returns a disposer that cancels any pending wait.
 */
export function applyDeepLink(store: BoardStore, search: string, onDone?: () => void): () => void {
	const { shapeIds, camera } = decodeDeepLink(search);

	let done = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let offMutation: (() => void) | null = null;

	const finish = () => {
		if (done) return;
		done = true;
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		if (offMutation) {
			offMutation();
			offMutation = null;
		}
		onDone?.();
	};

	// Nothing to anchor — settle synchronously.
	if (shapeIds.length === 0 && !camera) {
		finish();
		return finish;
	}

	const presentIds = () => shapeIds.filter((id) => store.getShape(id));

	const applyNow = (ids: string[]) => {
		if (ids.length > 0) {
			store.setSelection(ids);
			// An explicit camera wins over shape-derived framing.
			if (!camera) frameShapes(store, ids);
		}
		if (camera) store.animateViewportTo(camera);
		finish();
	};

	// Camera-only, or all shapes already present → apply immediately.
	const ready = presentIds();
	if (shapeIds.length === 0 || ready.length === shapeIds.length) {
		applyNow(ready);
		return finish;
	}

	// Some shapes are still syncing — wait for them, then apply.
	offMutation = store.onMutation((e: StoreEvent) => {
		if (e.type !== "shape:added") return;
		const now = presentIds();
		if (now.length === shapeIds.length) applyNow(now);
	});

	timer = setTimeout(() => {
		// Timed out: apply whatever arrived (possibly a partial selection).
		applyNow(presentIds());
	}, SYNC_TIMEOUT_MS);

	return finish;
}
