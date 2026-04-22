import {
	type PluginContext,
	type UsketchPlugin,
	withRotation,
} from "@edv4h/usketch-shared";
import { createResize, getBounds, pointInPolygon } from "@edv4h/usketch-shape-utils";
import { createDefaultHexagon, getHexagonPoints, renderHexagon } from "./shapes/hexagon.js";

export const acmeShapeBasicPlugin: UsketchPlugin = {
	id: "acme-shape-basic",
	name: "Acme Shapes",

	setup(ctx: PluginContext) {
		ctx.shapes.register("acme-hexagon", {
			render: renderHexagon,
			getBounds,
			hitTest: withRotation((data, point) => pointInPolygon(point, getHexagonPoints(data))),
			resize: createResize(10, 10),
			createDefault: createDefaultHexagon,
		});
	},
};
