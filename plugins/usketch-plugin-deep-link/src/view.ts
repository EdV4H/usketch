import type { BoardStore, Viewport } from "@edv4h/usketch-shared";
import {
	getScreenSize,
	screenToWorld,
	viewportAnchoredAt,
	viewportRotation,
} from "@edv4h/usketch-shared";
import type { DeepLinkView } from "./url-state.js";

/** Canvas size in screen px, for hosts whose canvas isn't the whole window. */
export type ViewportSizeGetter = () => { width: number; height: number };

export interface ViewOptions {
	/** Canvas size in screen px. Defaults to the window size. */
	getViewportSize?: ViewportSizeGetter;
}

/**
 * Snapshot the current view as a centre-anchored {@link DeepLinkView}: the
 * world point at the centre of the canvas, plus the zoom. Rotation-aware, so a
 * rotated view still points at the spot that is on screen.
 */
export function captureView(store: BoardStore, opts: ViewOptions = {}): DeepLinkView {
	const { width, height } = (opts.getViewportSize ?? getScreenSize)();
	const vp = store.getViewport();
	const c = screenToWorld(width / 2, height / 2, vp);
	return { x: c.x, y: c.y, zoom: vp.zoom };
}

/**
 * The viewport that puts `view`'s world point at the centre of the canvas at
 * `view.zoom`. Keeps the current rotation, so a rotated board stays rotated.
 */
export function viewportForView(
	store: BoardStore,
	view: DeepLinkView,
	opts: ViewOptions = {},
): Viewport {
	const { width, height } = (opts.getViewportSize ?? getScreenSize)();
	return viewportAnchoredAt(
		{ x: view.x, y: view.y },
		{ x: width / 2, y: height / 2 },
		view.zoom,
		viewportRotation(store.getViewport()),
	);
}
