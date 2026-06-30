import type { BoundingBox } from "@edv4h/usketch-shared";

export type FreePositionStrategy = "ring" | "push";

export interface FindFreePositionOptions {
	/** 置きたい位置・サイズ（回転 shape は回転後 AABB を渡す）。 */
	desired: BoundingBox;
	/** 避ける矩形（回転後 AABB）。 */
	occupied: BoundingBox[];
	/** 探索戦略（既定 "ring"）。 */
	strategy?: FreePositionStrategy;
	/** ring の半径刻み（world px、既定 20）。 */
	step?: number;
	/** ring の探索上限距離（world px、既定 2000）。超過時は best-effort。 */
	maxDistance?: number;
	/** push の反復上限（既定 50）。 */
	maxIterations?: number;
}

const EPS = 0.01;

/** 2つの AABB が重なるか（境界接触は非重なり扱い）。collision-utils.intersectsAABB と同等。 */
function intersects(a: BoundingBox, b: BoundingBox): boolean {
	return (
		a.x < b.x + b.width - EPS &&
		a.x + a.width > b.x + EPS &&
		a.y < b.y + b.height - EPS &&
		a.y + a.height > b.y + EPS
	);
}

/** box がいずれかの occupied と重なるか。 */
export function overlapsAny(box: BoundingBox, occupied: BoundingBox[]): boolean {
	for (const o of occupied) if (intersects(box, o)) return true;
	return false;
}

function moveTo(box: BoundingBox, x: number, y: number): BoundingBox {
	return { x, y, width: box.width, height: box.height };
}

/**
 * `desired` 中心からの同心リングを外側へ広げ、衝突しない最近傍の位置を返す。
 * 各半径でサンプリングした候補のうち desired 中心に最も近いものを採用。
 */
function findByRing(opts: Required<Omit<FindFreePositionOptions, "maxIterations">>): BoundingBox {
	const { desired, occupied, step, maxDistance } = opts;
	if (!overlapsAny(desired, occupied)) return desired;

	const cx = desired.x + desired.width / 2;
	const cy = desired.y + desired.height / 2;

	for (let r = step; r <= maxDistance; r += step) {
		// 半径が大きいほど角度サンプルを増やす（密度を一定に保つ）。
		const samples = Math.max(8, Math.round((2 * Math.PI * r) / step));
		let best: BoundingBox | null = null;
		let bestDist = Number.POSITIVE_INFINITY;
		for (let i = 0; i < samples; i++) {
			const theta = (i / samples) * Math.PI * 2;
			const ncx = cx + Math.cos(theta) * r;
			const ncy = cy + Math.sin(theta) * r;
			const candidate = moveTo(desired, ncx - desired.width / 2, ncy - desired.height / 2);
			if (overlapsAny(candidate, occupied)) continue;
			const dist = (ncx - cx) ** 2 + (ncy - cy) ** 2;
			if (dist < bestDist) {
				bestDist = dist;
				best = candidate;
			}
		}
		if (best) return best;
	}
	// 見つからなければ best-effort で desired を返す。
	return desired;
}

/**
 * `desired` を起点に、重なる occupied から最小重なり軸方向へ押し出して分離する。
 * 連鎖的な重なりに備えて反復し、上限で打ち切り（best-effort）。
 */
function findByPush(
	opts: Required<Omit<FindFreePositionOptions, "step" | "maxDistance">>,
): BoundingBox {
	const { occupied, maxIterations } = opts;
	let box = opts.desired;
	for (let iter = 0; iter < maxIterations; iter++) {
		// 最も重なっている occupied を選ぶ。
		let target: BoundingBox | null = null;
		let maxOverlapArea = 0;
		for (const o of occupied) {
			if (!intersects(box, o)) continue;
			const ox = Math.min(box.x + box.width, o.x + o.width) - Math.max(box.x, o.x);
			const oy = Math.min(box.y + box.height, o.y + o.height) - Math.max(box.y, o.y);
			const area = ox * oy;
			if (area > maxOverlapArea) {
				maxOverlapArea = area;
				target = o;
			}
		}
		if (!target) return box; // 重なり無し

		// 最小重なり軸へ分離（接触まで）。
		const overlapX =
			Math.min(box.x + box.width, target.x + target.width) - Math.max(box.x, target.x);
		const overlapY =
			Math.min(box.y + box.height, target.y + target.height) - Math.max(box.y, target.y);
		const boxCx = box.x + box.width / 2;
		const boxCy = box.y + box.height / 2;
		const tCx = target.x + target.width / 2;
		const tCy = target.y + target.height / 2;
		if (overlapX < overlapY) {
			const dir = boxCx >= tCx ? 1 : -1;
			box = moveTo(box, box.x + dir * (overlapX + EPS), box.y);
		} else {
			const dir = boxCy >= tCy ? 1 : -1;
			box = moveTo(box, box.x, box.y + dir * (overlapY + EPS));
		}
	}
	return box;
}

/**
 * `desired` に最も近い、occupied と重ならない位置（同サイズ）を返す。
 * `desired` がそのまま空いていればそのまま返す。
 */
export function findFreePosition(opts: FindFreePositionOptions): BoundingBox {
	const strategy = opts.strategy ?? "ring";
	if (opts.occupied.length === 0 || !overlapsAny(opts.desired, opts.occupied)) {
		return opts.desired;
	}
	if (strategy === "push") {
		return findByPush({
			desired: opts.desired,
			occupied: opts.occupied,
			strategy,
			maxIterations: opts.maxIterations ?? 50,
		});
	}
	return findByRing({
		desired: opts.desired,
		occupied: opts.occupied,
		strategy,
		step: opts.step ?? 20,
		maxDistance: opts.maxDistance ?? 2000,
	});
}
