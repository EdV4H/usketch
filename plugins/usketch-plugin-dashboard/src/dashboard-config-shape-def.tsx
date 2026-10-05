// The JSX shape-definition factory for the `dashboard-config` substrate. Kept in
// its own `.tsx` so the pure data module (`dashboard-config-shape.ts`) stays
// React-free and unit-testable. Only the plugin's `setup` imports this.
import type { BoundingBox, ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import {
	type DashboardConfigData,
	type DashboardDefaults,
	makeDashboardConfig,
} from "./dashboard-config-shape.js";

export function createDashboardConfigShapeDefinition(
	defaults: DashboardDefaults = {},
): ShapeDefinition {
	return {
		render: () => <g />,
		renderTarget: "svg",
		getBounds: (): BoundingBox => ({ x: 0, y: 0, width: 0, height: 0 }),
		hitTest: () => false,
		resizable: false,
		resize: (data): ShapeData => data,
		createDefault: (params): ShapeData => ({ ...makeDashboardConfig(defaults), id: params.id }),
		serializeForAi: (data): Record<string, unknown> => {
			const d = data as DashboardConfigData;
			return {
				kind: "dashboard-config",
				columns: d.columns,
				cell: [d.cellW, d.cellH],
				gap: d.gap,
			};
		},
		debugFields: (data): Record<string, unknown> => {
			const d = data as DashboardConfigData;
			return {
				columns: d.columns,
				cell: `${d.cellW}×${d.cellH}`,
				gap: d.gap,
				padding: d.padding,
				origin: `${d.originX},${d.originY}`,
			};
		},
	};
}
