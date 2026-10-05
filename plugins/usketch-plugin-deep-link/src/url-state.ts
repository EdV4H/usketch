import type { Viewport } from "@edv4h/usketch-shared";

/**
 * Deep-link state carried in the URL query string.
 *
 * - `shapeIds`: selected shapes (Figma's `node-id` equivalent, but plural).
 * - `camera`: exact pan/zoom to restore. `null` when the link only anchors a
 *   selection and framing should be derived from the shapes instead.
 */
export interface DeepLinkState {
	shapeIds: string[];
	camera: Viewport | null;
}

const SHAPE_PARAM = "shape";
const X_PARAM = "x";
const Y_PARAM = "y";
const ZOOM_PARAM = "zoom";

/** Round to `dp` decimal places (keeps the zoom param short). */
function roundTo(n: number, dp: number): number {
	const f = 10 ** dp;
	return Math.round(n * f) / f;
}

/** Parse a query string (`location.search`) into a {@link DeepLinkState}. */
export function decodeDeepLink(search: string): DeepLinkState {
	const params = new URLSearchParams(search);

	const shapeRaw = params.get(SHAPE_PARAM);
	const shapeIds = shapeRaw
		? shapeRaw
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
		: [];

	const xs = params.get(X_PARAM);
	const ys = params.get(Y_PARAM);
	const zs = params.get(ZOOM_PARAM);
	let camera: Viewport | null = null;
	if (xs !== null && ys !== null && zs !== null) {
		const x = Number(xs);
		const y = Number(ys);
		const zoom = Number(zs);
		if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(zoom) && zoom > 0) {
			camera = { x, y, zoom };
		}
	}

	return { shapeIds, camera };
}

/**
 * Merge deep-link fields into an existing query string, returning the new
 * `search` (including the leading `?`, or `""` when empty). Only the fields
 * present in `state` are touched, so unrelated params (e.g. tracking tokens)
 * are preserved. Passing `shapeIds: []` / `camera: null` removes those params.
 */
export function encodeDeepLink(search: string, state: Partial<DeepLinkState>): string {
	const params = new URLSearchParams(search);

	if (state.shapeIds !== undefined) {
		if (state.shapeIds.length > 0) params.set(SHAPE_PARAM, state.shapeIds.join(","));
		else params.delete(SHAPE_PARAM);
	}

	if (state.camera !== undefined) {
		if (state.camera) {
			params.set(X_PARAM, String(Math.round(state.camera.x)));
			params.set(Y_PARAM, String(Math.round(state.camera.y)));
			params.set(ZOOM_PARAM, String(roundTo(state.camera.zoom, 3)));
		} else {
			params.delete(X_PARAM);
			params.delete(Y_PARAM);
			params.delete(ZOOM_PARAM);
		}
	}

	// URLSearchParams percent-encodes the comma separator; restore it *only*
	// within the `shape` param so the id list stays human-readable (comma is a
	// valid query sub-delim). Unrelated params keep their key/value (though
	// URLSearchParams may normalize their escaping/ordering when re-serializing).
	const qs = params
		.toString()
		.replace(/(^|&)(shape=)([^&]*)/, (_m, pre, key, val) => pre + key + val.replace(/%2C/g, ","));
	return qs ? `?${qs}` : "";
}
