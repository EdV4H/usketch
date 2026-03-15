import type { ShapeDefinition, ShapeRegistry } from "@edv4h/usketch-shared";

export function createShapeRegistry(): ShapeRegistry {
	const definitions = new Map<string, ShapeDefinition>();

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
	};
}
