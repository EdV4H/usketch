import type { BoundingBox } from "@edv4h/usketch-shared";

/**
 * A world-anchored height field of viscous liquid. `h[i]` is the liquid thickness of
 * one cell (`1` = rest level, `0` = dry). Cell `(c, r)` covers world
 * `[c·cell, (c+1)·cell) × [r·cell, (r+1)·cell)`, so the field stays glued to the board
 * while panning; only the window `[col0, col0+cols) × [row0, row0+rows)` around the
 * viewport is simulated. Everything outside the window is treated as liquid at rest.
 *
 * Dynamics, per frame:
 * 1. {@link LiquidField.applyObstacles} — cells covered by a displacer become solid;
 *    liquid still inside them is pushed outward (away from the obstacle's centre) to
 *    the first free cell, piling up a rim around the object.
 * 2. {@link LiquidField.step} — viscous spreading (diffusion between free cells,
 *    no flux into solids) plus a slow pull back to the rest level, so rims flatten
 *    and the trench an object leaves behind slowly oozes closed.
 */

/** A displacing object in world coordinates (a rotated rect or ellipse). */
export interface LiquidObstacle {
	/** Centre (world). */
	cx: number;
	cy: number;
	/** Half extents (world), padding already included. */
	hw: number;
	hh: number;
	/** Rotation in radians (clockwise-positive, about the centre). */
	rotation: number;
	kind: "rect" | "ellipse";
}

export interface LiquidStepParams {
	/** Spreading speed in world units² per second. */
	diffusion: number;
	/** Pull back to the rest level, per second. */
	relaxation: number;
}

/** Largest stable explicit diffusion coefficient per sub-step (4-neighbour stencil). */
const MAX_ALPHA = 0.2;
/** Cap on diffusion sub-steps per frame; past it spreading just slows down. */
const MAX_SUBSTEPS = 8;
/** Liquid below this thickness is not worth pushing. */
const PUSH_EPSILON = 1e-4;

export class LiquidField {
	cell = 0;
	col0 = 0;
	row0 = 0;
	cols = 0;
	rows = 0;
	h: Float32Array = new Float32Array(0);
	/** 1 where a displacer covers the cell this frame. */
	solid: Uint8Array = new Uint8Array(0);
	/**
	 * Signed distance (world units) from each cell centre to the nearest obstacle
	 * edge — negative inside, `+Infinity` when farther than the edge band. Lets the
	 * renderer draw smooth, geometry-true edges instead of the cell staircase.
	 */
	edge: Float32Array = new Float32Array(0);
	/** Index (into the last `applyObstacles` list) of the obstacle owning a solid cell. */
	private owner: Int32Array = new Int32Array(0);
	private tmp: Float32Array = new Float32Array(0);

	/**
	 * Move the simulated window to cover `bounds` (world) plus `margin` cells, with
	 * cells of `cell` world units. Values carry over from the previous window
	 * (bilinear, so a cell-size change resamples); new area starts at rest.
	 */
	setWindow(bounds: BoundingBox, cell: number, margin: number): void {
		const col0 = Math.floor(bounds.x / cell) - margin;
		const row0 = Math.floor(bounds.y / cell) - margin;
		const cols = Math.max(1, Math.ceil((bounds.x + bounds.width) / cell) + margin - col0);
		const rows = Math.max(1, Math.ceil((bounds.y + bounds.height) / cell) + margin - row0);
		if (
			cell === this.cell &&
			col0 === this.col0 &&
			row0 === this.row0 &&
			cols === this.cols &&
			rows === this.rows
		) {
			return;
		}

		const next = new Float32Array(cols * rows);
		if (this.cols === 0) {
			next.fill(1);
		} else if (cell === this.cell) {
			// Same lattice — exact integer copy of the overlap.
			for (let r = 0; r < rows; r++) {
				const or = r + row0 - this.row0;
				for (let c = 0; c < cols; c++) {
					const oc = c + col0 - this.col0;
					next[r * cols + c] =
						or >= 0 && or < this.rows && oc >= 0 && oc < this.cols
							? this.h[or * this.cols + oc]
							: 1;
				}
			}
		} else {
			for (let r = 0; r < rows; r++) {
				const wy = (row0 + r + 0.5) * cell;
				for (let c = 0; c < cols; c++) {
					next[r * cols + c] = this.sample((col0 + c + 0.5) * cell, wy);
				}
			}
		}

		this.cell = cell;
		this.col0 = col0;
		this.row0 = row0;
		this.cols = cols;
		this.rows = rows;
		this.h = next;
		this.tmp = new Float32Array(cols * rows);
		this.solid = new Uint8Array(cols * rows);
		this.edge = new Float32Array(cols * rows).fill(Number.POSITIVE_INFINITY);
		this.owner = new Int32Array(cols * rows);
	}

	/** Bilinear thickness at a world point (rest level outside the window). */
	sample(wx: number, wy: number): number {
		const { cols, rows, cell, h } = this;
		if (cols === 0) return 1;
		const u = wx / cell - 0.5 - this.col0;
		const v = wy / cell - 0.5 - this.row0;
		const c0 = Math.floor(u);
		const r0 = Math.floor(v);
		const fu = u - c0;
		const fv = v - r0;
		const at = (c: number, r: number) =>
			c >= 0 && c < cols && r >= 0 && r < rows ? h[r * cols + c] : 1;
		const top = at(c0, r0) * (1 - fu) + at(c0 + 1, r0) * fu;
		const bottom = at(c0, r0 + 1) * (1 - fu) + at(c0 + 1, r0 + 1) * fu;
		return top * (1 - fv) + bottom * fv;
	}

	/**
	 * Rasterize `obstacles` into {@link solid} / {@link edge} and push the liquid they
	 * now cover outward. Liquid that would be pushed out of the window is dropped
	 * (the area outside the window is an infinite reservoir anyway). `edgeBand`
	 * (world units) is how far outside an obstacle {@link edge} is tracked.
	 */
	applyObstacles(obstacles: readonly LiquidObstacle[], edgeBand = 2 * this.cell): void {
		const { cols, rows, cell, solid, owner, h, edge } = this;
		solid.fill(0);
		edge.fill(Number.POSITIVE_INFINITY);
		if (obstacles.length === 0) return;

		// Pass 1: signed distance near each obstacle; a cell whose centre is inside is solid.
		for (let k = 0; k < obstacles.length; k++) {
			const o = obstacles[k];
			if (!(o.hw > 0 && o.hh > 0)) continue;
			const cos = Math.cos(o.rotation);
			const sin = Math.sin(o.rotation);
			const ex = Math.abs(o.hw * cos) + Math.abs(o.hh * sin) + edgeBand;
			const ey = Math.abs(o.hw * sin) + Math.abs(o.hh * cos) + edgeBand;
			const cMin = Math.max(0, Math.floor((o.cx - ex) / cell - 0.5) - this.col0);
			const cMax = Math.min(cols - 1, Math.ceil((o.cx + ex) / cell - 0.5) - this.col0);
			const rMin = Math.max(0, Math.floor((o.cy - ey) / cell - 0.5) - this.row0);
			const rMax = Math.min(rows - 1, Math.ceil((o.cy + ey) / cell - 0.5) - this.row0);
			for (let r = rMin; r <= rMax; r++) {
				const dy = (this.row0 + r + 0.5) * cell - o.cy;
				for (let c = cMin; c <= cMax; c++) {
					const dx = (this.col0 + c + 0.5) * cell - o.cx;
					// Into the obstacle's local (unrotated) frame.
					const sd = obstacleDistance(o, dx * cos + dy * sin, -dx * sin + dy * cos);
					const i = r * cols + c;
					if (sd < edge[i]) edge[i] = sd;
					if (sd <= 0 && !solid[i]) {
						solid[i] = 1;
						owner[i] = k;
					}
				}
			}
		}

		// Pass 2: push liquid out of solid cells, away from the owner's centre.
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const i = r * cols + c;
				if (!solid[i]) continue;
				const amount = h[i];
				h[i] = 0;
				if (amount <= PUSH_EPSILON) continue;
				const o = obstacles[owner[i]];
				let dx = (this.col0 + c + 0.5) * cell - o.cx;
				let dy = (this.row0 + r + 0.5) * cell - o.cy;
				const len = Math.hypot(dx, dy);
				if (len < 1e-9) {
					dx = 1;
					dy = 0;
				} else {
					dx /= len;
					dy /= len;
				}
				// March in half-cell steps so diagonal paths don't skip a free cell.
				let x = c + 0.5;
				let y = r + 0.5;
				for (;;) {
					x += dx * 0.5;
					y += dy * 0.5;
					const tc = Math.floor(x);
					const tr = Math.floor(y);
					if (tc < 0 || tc >= cols || tr < 0 || tr >= rows) break;
					const j = tr * cols + tc;
					if (!solid[j]) {
						h[j] += amount;
						break;
					}
				}
			}
		}
	}

	/** Advance the viscous flow by `dt` seconds. */
	step(dt: number, params: LiquidStepParams): void {
		const { cols, rows, solid } = this;
		if (cols === 0 || dt <= 0) return;
		const alphaTotal = (params.diffusion * dt) / (this.cell * this.cell);
		const substeps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(alphaTotal / MAX_ALPHA)));
		const alpha = Math.min(MAX_ALPHA, alphaTotal / substeps);
		const beta = 1 - Math.exp((-params.relaxation * dt) / substeps);

		let src = this.h;
		let dst = this.tmp;
		for (let s = 0; s < substeps; s++) {
			for (let r = 0; r < rows; r++) {
				for (let c = 0; c < cols; c++) {
					const i = r * cols + c;
					if (solid[i]) {
						dst[i] = 0;
						continue;
					}
					const hi = src[i];
					let flux = 0;
					// Out-of-window neighbours are the rest-level reservoir; solid
					// neighbours are walls (no flux).
					flux += c > 0 ? (solid[i - 1] ? 0 : src[i - 1] - hi) : 1 - hi;
					flux += c < cols - 1 ? (solid[i + 1] ? 0 : src[i + 1] - hi) : 1 - hi;
					flux += r > 0 ? (solid[i - cols] ? 0 : src[i - cols] - hi) : 1 - hi;
					flux += r < rows - 1 ? (solid[i + cols] ? 0 : src[i + cols] - hi) : 1 - hi;
					const next = hi + alpha * flux;
					dst[i] = next + (1 - next) * beta;
				}
			}
			const t = src;
			src = dst;
			dst = t;
		}
		this.h = src;
		this.tmp = dst;
	}
}

/**
 * Signed distance from local point `(lx, ly)` (obstacle frame) to the obstacle's
 * outline: exact for rects, a first-order estimate for ellipses.
 */
function obstacleDistance(o: LiquidObstacle, lx: number, ly: number): number {
	if (o.kind === "ellipse") {
		const ux = lx / o.hw;
		const uy = ly / o.hh;
		const k = Math.hypot(ux, uy);
		if (k < 1e-9) return -Math.min(o.hw, o.hh);
		// (k − 1) / |∇k|, with ∇k = (lx / hw², ly / hh²) / k.
		const gx = ux / o.hw;
		const gy = uy / o.hh;
		return ((k - 1) * k) / Math.hypot(gx, gy);
	}
	const qx = Math.abs(lx) - o.hw;
	const qy = Math.abs(ly) - o.hh;
	return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
}

/**
 * World size of a simulation cell for `zoom`: a power of two (so neighbouring zoom
 * levels share a lattice and resampling stays rare) keeping a cell about
 * `targetScreenPx` CSS px on screen.
 */
export function chooseCellSize(zoom: number, targetScreenPx: number): number {
	const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
	return 2 ** Math.round(Math.log2(targetScreenPx / z));
}
