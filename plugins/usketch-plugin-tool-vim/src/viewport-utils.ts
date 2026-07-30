// Vim viewport helpers now delegate to the shared, animated viewport utilities
// so jumps are smooth by default. Kept as thin wrappers to avoid churn at call
// sites within the vim plugin.
import type { BoardStore, Point } from "@edv4h/usketch-shared";
import { centerOnWorld, getScreenSize, screenCenterWorld } from "@edv4h/usketch-shared";

export { getScreenSize, screenCenterWorld };

/** world 座標 `target` が画面中央に来るようビューポートを移動する（スムーズ）。 */
export function centerViewportOn(store: BoardStore, target: Point): void {
	centerOnWorld(store, target);
}
