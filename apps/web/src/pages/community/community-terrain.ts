import {
	DEFAULT_GEN,
	DEFAULT_WATER_RATIO,
	ELEVATION_FIELD_ID,
	getElevationField,
	makeFieldShape,
} from "@edv4h/usketch-plugin-elevation";
import type { BoardStore } from "@edv4h/usketch-shared";

/**
 * 標高マップ（無限地形の丘・谷・海岸）にする地域と、その地形のシード。
 * どの人が開いても同じ地形になるよう、シードと生成パラメーターは固定。
 */
export const ELEVATION_REGIONS: Readonly<Record<string, { seed: number }>> = {
	playground: { seed: 1304 },
};

/**
 * 標高マップの地域で、ボードにまだ標高の場が無ければ無限地形の場を置く。
 * 置いたら true。
 *
 * - 場の id は固定なので、何人が同時に置いても場は 1 つ。中身も同じなので食い違わない。
 * - ストアに直接書く（undo の履歴に載せない）ので、開いた人の Ctrl+Z で消えない。
 * - あとから HUD「標高」で地形を変えたり消したりできる。消した場は次に開いた人がまた置く。
 */
export function ensureRegionTerrain(store: BoardStore, slug: string): boolean {
	const region = ELEVATION_REGIONS[slug];
	if (!region || getElevationField(store)) return false;
	store.addShape(
		makeFieldShape(ELEVATION_FIELD_ID, {
			seed: region.seed,
			gen: DEFAULT_GEN,
			waterLevel: Math.round(DEFAULT_GEN.relief * DEFAULT_WATER_RATIO),
		}),
	);
	return true;
}
