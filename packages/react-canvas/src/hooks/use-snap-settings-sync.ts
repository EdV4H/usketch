import type { SnapSettings } from "@usketch/store";
import { updateSnapRange } from "@usketch/tools";
import { useEffect } from "react";

/**
 * Hook to synchronize snap settings with the SnapEngine
 * Listens to store changes and updates the SnapEngine accordingly
 */
export function useSnapSettingsSync(snapSettings: SnapSettings) {
	useEffect(() => {
		// Update SnapEngine when settings change
		updateSnapRange(snapSettings.snapCalculationRange, snapSettings.viewportMargin);
	}, [snapSettings.snapCalculationRange, snapSettings.viewportMargin]);
}
