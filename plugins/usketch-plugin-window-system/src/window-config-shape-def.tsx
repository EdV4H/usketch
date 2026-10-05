// The JSX shape-definition factory for the `window-system-config` substrate. Kept
// in its own `.tsx` so the pure data module (`window-config-shape.ts`) stays
// React-free and unit-testable. Only the plugin's `setup` imports this.
import type { BoundingBox, ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import {
	makeWindowConfig,
	type WindowConfigData,
	type WindowDefaults,
} from "./window-config-shape.js";

export function createWindowConfigShapeDefinition(defaults: WindowDefaults = {}): ShapeDefinition {
	return {
		render: () => <g />,
		renderTarget: "svg",
		getBounds: (): BoundingBox => ({ x: 0, y: 0, width: 0, height: 0 }),
		hitTest: () => false,
		resizable: false,
		resize: (data): ShapeData => data,
		createDefault: (params): ShapeData => ({ ...makeWindowConfig(defaults), id: params.id }),
		serializeForAi: (data): Record<string, unknown> => {
			const d = data as WindowConfigData;
			return { kind: "window-system-config", mode: d.mode, viewportLock: d.viewportLock };
		},
		debugFields: (data): Record<string, unknown> => {
			const d = data as WindowConfigData;
			return {
				mode: d.mode,
				lock: d.viewportLock,
				gap: d.gap,
				split: d.defaultSplit,
				origin: `${d.originX},${d.originY}`,
				focused: d.focusedId ?? "-",
			};
		},
	};
}
