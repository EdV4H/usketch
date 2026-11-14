import type { ShapeDefinition, ShapeRegistry, ShapeTypeView3d } from "@edv4h/usketch-shared";

export function createShapeRegistry(): ShapeRegistry {
	const definitions = new Map<string, ShapeDefinition>();
	// A host's 3D overrides per type, in the order they were made (later ones win).
	const view3dOverrides = new Map<string, { view3d: ShapeTypeView3d }[]>();
	const view3dListeners = new Set<() => void>();
	const notifyView3d = (): void => {
		for (const fn of [...view3dListeners]) fn();
	};

	return {
		register(type: string, definition: ShapeDefinition): void {
			definitions.set(type, definition);
		},

		get(type: string): ShapeDefinition | undefined {
			return definitions.get(type);
		},

		getAll(): ReadonlyMap<string, ShapeDefinition> {
			return definitions;
		},

		configureView3d(type, view3d) {
			const entry = { view3d };
			const list = view3dOverrides.get(type) ?? [];
			list.push(entry);
			view3dOverrides.set(type, list);
			notifyView3d();
			return () => {
				const current = view3dOverrides.get(type);
				const i = current?.indexOf(entry) ?? -1;
				if (!current || i < 0) return;
				current.splice(i, 1);
				if (current.length === 0) view3dOverrides.delete(type);
				notifyView3d();
			};
		},

		getView3d(type) {
			const declared = definitions.get(type)?.view3d;
			const overrides = view3dOverrides.get(type);
			if (!overrides) return declared;
			let merged: ShapeTypeView3d = { ...declared };
			for (const { view3d } of overrides) merged = { ...merged, ...view3d };
			return merged;
		},

		subscribeView3d(listener) {
			view3dListeners.add(listener);
			return () => {
				view3dListeners.delete(listener);
			};
		},
	};
}
