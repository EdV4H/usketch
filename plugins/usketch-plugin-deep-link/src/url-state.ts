import type { Viewport } from "@edv4h/usketch-shared";

/**
 * A view anchored at its centre: the world point at the centre of the screen,
 * plus the zoom. Unlike a raw {@link Viewport} (whose `x`/`y` is the screen
 * translation, so it depends on the sender's screen size and rotation), it
 * lands on the same spot on any screen size.
 */
export interface DeepLinkView {
	/** World x at the centre of the screen. */
	x: number;
	/** World y at the centre of the screen. */
	y: number;
	zoom: number;
}

/**
 * Deep-link state carried in the URL query string.
 *
 * - `shapeIds`: selected shapes (Figma's `node-id` equivalent, but plural).
 * - `camera`: exact pan/zoom to restore. `null` when the link only anchors a
 *   selection and framing should be derived from the shapes instead.
 * - `view`: a centre-anchored view (`?cx&cy&zoom`). Lands on the same world
 *   point at the centre of any screen size. `camera` wins when both are present.
 */
export interface DeepLinkState {
	shapeIds: string[];
	camera: Viewport | null;
	view: DeepLinkView | null;
}

const SHAPE_PARAM = "shape";
const X_PARAM = "x";
const Y_PARAM = "y";
const ZOOM_PARAM = "zoom";
const CX_PARAM = "cx";
const CY_PARAM = "cy";

/** Round to `dp` decimal places (keeps the zoom param short). */
function roundTo(n: number, dp: number): number {
	const f = 10 ** dp;
	return Math.round(n * f) / f;
}

/** Decimal places for a world coordinate at `zoom` (0 at zoom ≤ 1). */
function worldDecimals(zoom: number): number {
	return Number.isFinite(zoom) && zoom > 1 ? Math.min(6, Math.ceil(Math.log10(zoom))) : 0;
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

	const zs = params.get(ZOOM_PARAM);
	const camera = parsePoint(params.get(X_PARAM), params.get(Y_PARAM), zs);
	const view = parsePoint(params.get(CX_PARAM), params.get(CY_PARAM), zs);

	return { shapeIds, camera, view };
}

/** `{ x, y, zoom }` when all three are present and valid (zoom > 0), else `null`. */
function parsePoint(
	xs: string | null,
	ys: string | null,
	zs: string | null,
): { x: number; y: number; zoom: number } | null {
	if (xs === null || ys === null || zs === null) return null;
	const x = Number(xs);
	const y = Number(ys);
	const zoom = Number(zs);
	if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || zoom <= 0) {
		return null;
	}
	return { x, y, zoom };
}

/**
 * Merge deep-link fields into an existing query string, returning the new
 * `search` (including the leading `?`, or `""` when empty). Only the fields
 * present in `state` are touched, so unrelated params (e.g. tracking tokens)
 * are preserved. Passing `shapeIds: []` / `camera: null` / `view: null` removes
 * those params. `camera` and `view` share the `zoom` param: it is written from
 * `camera` when both are given, and removed only once neither remains. Setting
 * only one of them drops the other's stale x/y (or cx/cy), since it would no
 * longer match the shared zoom.
 */
export function encodeDeepLink(search: string, state: Partial<DeepLinkState>): string {
	const params = new URLSearchParams(search);

	if (state.shapeIds !== undefined) {
		if (state.shapeIds.length > 0) params.set(SHAPE_PARAM, state.shapeIds.join(","));
		else params.delete(SHAPE_PARAM);
	}

	if (state.view !== undefined) {
		if (state.view) {
			// World units: keep enough decimals that rounding stays under ~0.5 screen px.
			const dp = worldDecimals(state.view.zoom);
			params.set(CX_PARAM, String(roundTo(state.view.x, dp)));
			params.set(CY_PARAM, String(roundTo(state.view.y, dp)));
			params.set(ZOOM_PARAM, String(roundTo(state.view.zoom, 3)));
			// A stale exact camera would win on decode and pick up this zoom.
			if (state.camera === undefined) {
				params.delete(X_PARAM);
				params.delete(Y_PARAM);
			}
		} else {
			params.delete(CX_PARAM);
			params.delete(CY_PARAM);
		}
	}

	if (state.camera !== undefined) {
		if (state.camera) {
			params.set(X_PARAM, String(Math.round(state.camera.x)));
			params.set(Y_PARAM, String(Math.round(state.camera.y)));
			params.set(ZOOM_PARAM, String(roundTo(state.camera.zoom, 3)));
			// A stale view would be left with this camera's zoom; drop it.
			if (state.view === undefined) {
				params.delete(CX_PARAM);
				params.delete(CY_PARAM);
			}
		} else {
			params.delete(X_PARAM);
			params.delete(Y_PARAM);
		}
	}

	// `zoom` only means something next to x/y or cx/cy.
	if (
		!(params.has(X_PARAM) && params.has(Y_PARAM)) &&
		!(params.has(CX_PARAM) && params.has(CY_PARAM))
	) {
		params.delete(ZOOM_PARAM);
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
