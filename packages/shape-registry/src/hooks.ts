import type { BaseShape, Point } from "@usketch/shared-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShapeRegistry } from "./context";
import type { Bounds, CreateShapeProps, ShapePlugin } from "./types";

/**
 * Hook to create a shape using the registry
 */
export function useCreateShape() {
	const { registry } = useShapeRegistry();

	return useCallback(
		(type: string, props: CreateShapeProps): BaseShape | null => {
			return registry.createShape(type, props);
		},
		[registry],
	);
}

/**
 * Hook to validate a shape
 */
export function useValidateShape() {
	const { registry } = useShapeRegistry();

	return useCallback(
		(shape: BaseShape): boolean => {
			return registry.validateShape(shape);
		},
		[registry],
	);
}

/**
 * Hook to get shape bounds
 */
export function useShapeBounds(shape: BaseShape | null): Bounds | null {
	const { getPlugin } = useShapeRegistry();

	return useMemo(() => {
		if (!shape) return null;

		const plugin = getPlugin(shape.type);
		if (!plugin) return null;

		return plugin.getBounds(shape);
	}, [shape, getPlugin]);
}

/**
 * Hook to perform hit testing on a shape
 */
export function useShapeHitTest(shape: BaseShape | null) {
	const { getPlugin } = useShapeRegistry();

	return useCallback(
		(point: Point): boolean => {
			if (!shape) return false;

			const plugin = getPlugin(shape.type);
			if (!plugin) return false;

			return plugin.hitTest(shape, point);
		},
		[shape, getPlugin],
	);
}

/**
 * Hook to get shape component
 */
export function useShapeComponent(type: string) {
	const { getPlugin } = useShapeRegistry();

	return useMemo(() => {
		const plugin = getPlugin(type);
		return plugin?.component;
	}, [type, getPlugin]);
}

/**
 * Hook to get tool component for a shape type
 */
export function useShapeToolComponent(type: string) {
	const { getPlugin } = useShapeRegistry();

	return useMemo(() => {
		const plugin = getPlugin(type);
		return plugin?.toolComponent;
	}, [type, getPlugin]);
}

/**
 * Hook to serialize/deserialize shapes
 */
export function useShapeSerialization() {
	const { registry } = useShapeRegistry();

	const serialize = useCallback(
		(shape: BaseShape): any => {
			const plugin = registry.getPlugin(shape.type);

			if (plugin?.serialize) {
				return plugin.serialize(shape);
			}

			// Default serialization: return shape as-is
			return shape;
		},
		[registry],
	);

	const deserialize = useCallback(
		(type: string, data: any): BaseShape | null => {
			const plugin = registry.getPlugin(type);

			if (plugin?.deserialize) {
				return plugin.deserialize(data);
			}

			// Default deserialization: return data as-is if it has required properties
			if (data?.id && data.type) {
				return data as BaseShape;
			}

			return null;
		},
		[registry],
	);

	return { serialize, deserialize };
}

/**
 * Hook to get registry statistics
 */
export function useRegistryStats() {
	const { registry } = useShapeRegistry();

	const [stats, setStats] = useState(() => registry.getStats());

	useEffect(() => {
		setStats(registry.getStats());
	}, [registry]);

	return stats;
}

/**
 * Hook to filter shapes by type
 */
export function useFilterShapesByType(shapes: BaseShape[], type: string): BaseShape[] {
	return useMemo(() => {
		return shapes.filter((shape) => shape.type === type);
	}, [shapes, type]);
}

/**
 * Hook to group shapes by type
 */
export function useGroupShapesByType(shapes: BaseShape[]): Record<string, BaseShape[]> {
	return useMemo(() => {
		const grouped: Record<string, BaseShape[]> = {};

		shapes.forEach((shape) => {
			if (!grouped[shape.type]) {
				grouped[shape.type] = [];
			}
			grouped[shape.type].push(shape);
		});

		return grouped;
	}, [shapes]);
}

/**
 * Hook to get plugins with specific capabilities
 */
export function usePluginsWithCapability(
	capability: "tool" | "serialization" | "validation",
): ShapePlugin[] {
	const { registry } = useShapeRegistry();

	return useMemo(() => {
		const allPlugins = registry.getAllPlugins();

		switch (capability) {
			case "tool":
				return allPlugins.filter((p) => p.toolComponent !== undefined);

			case "serialization":
				return allPlugins.filter((p) => p.serialize !== undefined && p.deserialize !== undefined);

			case "validation":
				return allPlugins.filter((p) => p.validate !== undefined);

			default:
				return allPlugins;
		}
	}, [registry, capability]);
}
