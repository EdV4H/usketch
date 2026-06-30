import { type FreePositionStrategy, findFreePosition } from "@edv4h/usketch-shape-utils";
import {
	type BoundingBox,
	getRotatedAABB,
	type PluginContext,
	safeRotation,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";

export interface FreePositionConfig {
	/** 既定の探索戦略（"ring" | "push"、既定 "ring"）。 */
	strategy?: FreePositionStrategy;
	/** ring の半径刻み（world px）。 */
	step?: number;
	/** ring の探索上限距離（world px）。 */
	maxDistance?: number;
	/** push の反復上限。 */
	maxIterations?: number;
}

/**
 * `free-position:find` リクエストのペイロード。
 * snap の `snap:get-settings` と同様、同期コールバック（`onResult`）で結果を返す。
 */
export interface FreePositionRequest {
	/** 置きたい位置・サイズ（回転 shape は回転後 AABB を渡す）。 */
	desired: BoundingBox;
	/** 衝突判定から除外する shape ID（移動対象自身など）。 */
	excludeIds?: string[];
	/** この問い合わせ限定の戦略上書き。 */
	strategy?: FreePositionStrategy;
	/** 結果（同サイズの空き位置）を受け取るコールバック。 */
	onResult: (free: BoundingBox) => void;
}

/**
 * 指定位置から最も近い「被らない位置」を求める機能を提供するプラグイン（#581）。
 * EventBus の `free-position:find` で問い合わせると、現在のボード上の shape（回転考慮 AABB）を
 * 避けた最近傍の空き位置を返す。UI は持たない。
 */
export function createFreePositionPlugin(config: FreePositionConfig = {}): UsketchPlugin {
	return {
		id: "usketch-plugin-free-position",
		name: "Free Position",

		setup(ctx: PluginContext) {
			function collectOccupied(exclude?: string[]): BoundingBox[] {
				const ex = exclude && exclude.length > 0 ? new Set(exclude) : null;
				const out: BoundingBox[] = [];
				for (const [id, shape] of ctx.store.getShapes()) {
					if (ex?.has(id)) continue;
					const def = ctx.shapes.get(shape.type);
					const bounds = def
						? def.getBounds(shape)
						: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
					const rotation = safeRotation(shape.rotation);
					out.push(rotation ? getRotatedAABB(bounds, rotation) : bounds);
				}
				return out;
			}

			const off = ctx.events.on<FreePositionRequest>("free-position:find", (req) => {
				const free = findFreePosition({
					desired: req.desired,
					occupied: collectOccupied(req.excludeIds),
					strategy: req.strategy ?? config.strategy,
					step: config.step,
					maxDistance: config.maxDistance,
					maxIterations: config.maxIterations,
				});
				req.onResult(free);
			});

			return () => off();
		},
	};
}
