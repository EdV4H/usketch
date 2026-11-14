// The elevation plugin's host-facing API on the `ctx.services` seam (the same functions
// the HUD calls; see docs/plugin-system-design.md, reference: the map's map-service.ts).
import {
	type BoardStore,
	type CommandRegistry,
	defineService,
	type ServiceRegistry,
} from "@edv4h/usketch-shared";
import type { BrushSettings } from "./elevation-brush.js";
import type { ElevationFieldConfig } from "./elevation-field.js";
import { elevationHeightAt } from "./elevation-model.js";
import {
	clearElevationEdits,
	disableInfiniteElevation,
	type EnableElevationOptions,
	editedChunkCount,
	enableInfiniteElevation,
	getElevationField,
	type PaintOptions,
	paintElevation,
	removeElevationField,
} from "./elevation-ops.js";
import type { ElevationDisplay } from "./elevation-shade.js";
import type { ReactiveStore } from "./reactive-store.js";

export interface ElevationApi {
	/** Turn the infinite terrain on / change it (one undo step). Returns the seed. */
	enableInfinite(opts?: EnableElevationOptions): number;
	/** Turn the infinite terrain off, keeping the edits (one undo step). */
	disableInfinite(): void;
	/** Remove every brush edit (one undo step). */
	clearEdits(): void;
	/** Remove the field and its edits (one undo step). */
	removeField(): void;
	/** The board's field settings, or `null` when it has none. */
	getField(): ElevationFieldConfig | null;
	/** Number of edited chunks. */
	editedChunkCount(): number;
	/** Ground height (world units) at a world point; 0 without a field. */
	getHeightAt(x: number, y: number): number;
	/**
	 * One brush stroke along `path` (world points), one undo step: what the tool does
	 * between pointer down and up. Missing brush settings come from {@link brush}.
	 * Returns the number of chunks changed.
	 */
	paint(path: readonly { x: number; y: number }[], opts?: PaintOptions): number;
	/** The look (colours / shading / contours). App-local, not synced. */
	display: ReactiveStore<ElevationDisplay>;
	/** The elevation tool's brush (mode, radius, strength…). App-local, not synced. */
	brush: ReactiveStore<BrushSettings>;
}

export const elevationService = defineService<ElevationApi>("usketch-plugin-elevation");

/** Build the API bound to a board (called in the plugin's setup). */
export function createElevationApi(
	store: BoardStore,
	commands: CommandRegistry | undefined,
	display: ReactiveStore<ElevationDisplay>,
	brush: ReactiveStore<BrushSettings>,
): ElevationApi {
	const deps = { store, commands };
	return {
		enableInfinite: (opts) => enableInfiniteElevation(deps, opts),
		disableInfinite: () => disableInfiniteElevation(deps),
		clearEdits: () => clearElevationEdits(deps),
		removeField: () => removeElevationField(deps),
		getField: () => getElevationField(store),
		editedChunkCount: () => editedChunkCount(store),
		getHeightAt: (x, y) => elevationHeightAt(store, x, y),
		paint: (path, opts) =>
			paintElevation(deps, path, { ...opts, brush: { ...brush.get(), ...opts?.brush } }),
		display,
		brush,
	};
}

/** Host accessor: `getElevationApi(app.services)?.enableInfinite({ seed: 7 })`. */
export function getElevationApi(services: ServiceRegistry): ElevationApi | undefined {
	return elevationService.get(services);
}
