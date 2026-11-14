// Host-facing API on the `ctx.services` seam (reference: the map plugin's map-service).
// Thin delegation to the plain operations, bound to the board store and the plugin's
// per-type settings.
import { type BoardStore, defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import type { Shape3dLimits } from "./shape-3d-layout.js";
import { clearShapeView3d, getShapeView3d, setShapeView3d } from "./shape-3d-ops.js";
import {
	availableModes,
	resolveShape3d,
	type Shape3dInput,
	type Shape3dMode,
	type Shape3dParams,
	type Shape3dTypeConfig,
	type Shape3dTypes,
} from "./shape-3d-params.js";
import type { Shape3dSettings } from "./shape-3d-settings.js";

export interface Shape3dApi {
	/** A shape's own 3D parameters, or `null`. */
	get(id: string): Shape3dParams | null;
	/** The parameters a shape renders with (its own, else its type's default), or `null`. */
	resolve(id: string): Shape3dParams | null;
	/** Merge parameters into shapes (give `mode` to start). Returns the ids updated. */
	set(ids: Iterable<string>, patch: Shape3dInput): string[];
	/** Make shapes flat again. Returns the ids changed. */
	clear(ids: Iterable<string>): string[];
	/** The modes a shape type may use. */
	modesFor(type: string): readonly Shape3dMode[];
	/** Add / override one shape type's 3D settings at runtime. Returns an undo. */
	registerType(type: string, config: Shape3dTypeConfig): () => void;
	getLimits(): Shape3dLimits;
	setLimits(limits: Partial<Shape3dLimits>): void;
}

export const shape3dService = defineService<Shape3dApi>("usketch-plugin-shape-3d");

export function createShape3dApi(store: BoardStore, settings: Shape3dSettings): Shape3dApi {
	const types = (): Shape3dTypes => settings.get().types;
	return {
		get: (id) => getShapeView3d(store, id),
		resolve: (id) => {
			const shape = store.getShape(id);
			return shape ? resolveShape3d(shape, types()) : null;
		},
		set: (ids, patch) => setShapeView3d(store, ids, patch, types()),
		clear: (ids) => clearShapeView3d(store, ids),
		modesFor: (type) => availableModes(types(), type),
		registerType: (type, config) => settings.registerType(type, config),
		getLimits: () => settings.get().limits,
		setLimits: (limits) => settings.setLimits(limits),
	};
}

/** Host accessor: `getShape3dApi(app.services)?.set(ids, { mode: "stand" })`. */
export function getShape3dApi(services: ServiceRegistry): Shape3dApi | undefined {
	return shape3dService.get(services);
}
