// Levelling a strip of ground along a path (a road, a track, a river bed): flat across
// the strip, and along it either following the ground (smoothed, so bumps go but hills
// stay) or at one height. Past the strip a shoulder blends the edit into the terrain.
// Works on a Stroke like the brush, so it is written as one undo step. Pure.
import { type Stroke, strokeEditor } from "./elevation-brush.js";
import { MAX_HEIGHT } from "./elevation-field.js";
import { elevationSampler } from "./elevation-model.js";

export interface GradeOptions {
	/** Half the strip's width, levelled exactly (world units, > 0). */
	halfWidth: number;
	/** Width past `halfWidth` over which the strip blends into the ground. Default `halfWidth`. */
	shoulder?: number;
	/**
	 * One height for the whole strip (world units). Omitted: follow the ground under the
	 * path, averaged over {@link GradeOptions.smoothing}.
	 */
	height?: number;
	/**
	 * World units along the path the followed height is averaged over. Larger ⇒ gentler
	 * slopes (more cut and fill). Default 4 × (`halfWidth` + `shoulder`).
	 */
	smoothing?: number;
	/** The path is a loop (its end joins its start): the averaging wraps around. */
	closed?: boolean;
}

/** A point of the levelled path and the height the strip has there. */
export interface GradePoint {
	x: number;
	y: number;
	h: number;
}

type Pt = { x: number; y: number };

/** `path` with points every `step` world units along it (its ends kept). Pure. */
export function resamplePath(path: readonly Pt[], step: number): Pt[] {
	const out: Pt[] = [];
	const pts = path.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
	if (pts.length === 0) return out;
	out.push({ x: pts[0].x, y: pts[0].y });
	let carry = 0;
	for (let k = 1; k < pts.length; k++) {
		const a = pts[k - 1];
		const b = pts[k];
		const len = Math.hypot(b.x - a.x, b.y - a.y);
		let at = step - carry;
		while (at < len) {
			const t = at / len;
			out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
			at += step;
		}
		carry = len - (at - step);
	}
	const last = pts[pts.length - 1];
	const tail = out[out.length - 1];
	if (tail.x !== last.x || tail.y !== last.y) out.push({ x: last.x, y: last.y });
	return out;
}

/**
 * The strip's height along `path`: resampled every `step`, then `height` everywhere, or
 * the ground (`heightAt`) averaged over `smoothing` world units. Pure.
 */
export function gradeProfile(
	path: readonly Pt[],
	heightAt: (x: number, y: number) => number,
	opts: { step: number; smoothing: number; height?: number; closed?: boolean },
): GradePoint[] {
	const pts = resamplePath(path, opts.step);
	if (opts.height !== undefined) return pts.map((p) => ({ ...p, h: opts.height as number }));
	const raw = pts.map((p) => heightAt(p.x, p.y));
	const k = Math.max(0, Math.round(opts.smoothing / 2 / opts.step));
	// A loop's last point repeats its first: average over the unique ones, wrapping.
	const loop =
		opts.closed === true &&
		pts.length > 2 &&
		Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) <= opts.step;
	const n = loop ? pts.length - 1 : pts.length;
	const prefix = new Float64Array(n + 1);
	for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + raw[i];
	const sum = (from: number, to: number): number => prefix[to + 1] - prefix[from];
	const avg = (i: number): number => {
		if (!loop) {
			const from = Math.max(0, i - k);
			const to = Math.min(n - 1, i + k);
			return sum(from, to) / (to - from + 1);
		}
		const w = Math.min(k, Math.floor((n - 1) / 2));
		let total = 0;
		let from = i - w;
		const to = i + w;
		// Split the window where it wraps past either end.
		if (from < 0) {
			total += sum(n + from, n - 1);
			from = 0;
		}
		if (to >= n) {
			total += sum(0, to - n);
			total += sum(from, n - 1);
		} else total += sum(from, to);
		return total / (2 * w + 1);
	};
	return pts.map((p, i) => ({ ...p, h: avg(loop && i === n ? 0 : i) }));
}

const smoothstep = (s: number): number => s * s * (3 - 2 * s);

/**
 * Level the strip along `path` on the stroke's working copy (see {@link GradeOptions}).
 * Where the strip passes near itself the nearer part of the path wins. Returns whether
 * any height changed. Throws `RangeError` on a non-positive `halfWidth` or a negative
 * `shoulder` / `smoothing`.
 */
export function applyGrade(stroke: Stroke, path: readonly Pt[], opts: GradeOptions): boolean {
	const hw = opts.halfWidth;
	const sh = opts.shoulder ?? hw;
	if (!(hw > 0) || !Number.isFinite(hw)) {
		throw new RangeError(`grade: halfWidth must be a finite positive number, got ${String(hw)}`);
	}
	if (!(sh >= 0) || !Number.isFinite(sh)) {
		throw new RangeError(`grade: shoulder must be a finite number ≥ 0, got ${String(sh)}`);
	}
	const smoothing = opts.smoothing ?? 4 * (hw + sh);
	if (!(smoothing >= 0)) {
		throw new RangeError(`grade: smoothing must be ≥ 0, got ${String(smoothing)}`);
	}
	if (opts.height !== undefined && !Number.isFinite(opts.height)) {
		throw new RangeError(`grade: height must be a finite number, got ${String(opts.height)}`);
	}
	const sp = stroke.field.spacing;
	const sampler = elevationSampler(stroke.model);
	const profile = gradeProfile(path, (x, y) => sampler.heightAt(x, y), {
		step: sp,
		smoothing,
		height: opts.height,
		closed: opts.closed,
	});
	if (profile.length === 0) return false;
	const reach = hw + sh;
	// Nearest point of the path for every grid node within reach.
	const best = new Map<string, { i: number; j: number; d: number; h: number }>();
	const segs = profile.length === 1 ? [[profile[0], profile[0]]] : [];
	for (let k = 1; k < profile.length; k++) segs.push([profile[k - 1], profile[k]]);
	for (const [a, b] of segs) {
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len2 = dx * dx + dy * dy;
		const i0 = Math.ceil((Math.min(a.x, b.x) - reach) / sp);
		const i1 = Math.floor((Math.max(a.x, b.x) + reach) / sp);
		const j0 = Math.ceil((Math.min(a.y, b.y) - reach) / sp);
		const j1 = Math.floor((Math.max(a.y, b.y) + reach) / sp);
		for (let j = j0; j <= j1; j++) {
			for (let i = i0; i <= i1; i++) {
				const px = i * sp;
				const py = j * sp;
				const t =
					len2 > 0 ? Math.min(1, Math.max(0, ((px - a.x) * dx + (py - a.y) * dy) / len2)) : 0;
				const d = Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
				if (d >= reach && !(d <= hw)) continue;
				const key = `${i},${j}`;
				const cur = best.get(key);
				if (!cur || d < cur.d) best.set(key, { i, j, d, h: a.h + (b.h - a.h) * t });
			}
		}
	}
	const { heightAt, write, commit } = strokeEditor(stroke);
	let changed = false;
	for (const { i, j, d, h: target } of best.values()) {
		const w = d <= hw ? 1 : sh > 0 ? smoothstep(1 - (d - hw) / sh) : 0;
		if (w <= 0) continue;
		const h = heightAt(i, j);
		const next = Math.min(MAX_HEIGHT, Math.max(0, h + (target - h) * w));
		if (next === h) continue;
		write(i, j, next);
		changed = true;
	}
	if (changed) commit();
	return changed;
}
