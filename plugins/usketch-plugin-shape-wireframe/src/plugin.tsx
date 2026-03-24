import {
	type CanvasPointerEvent,
	generateId,
	type PluginContext,
	type ToolContext,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { renderButton } from "./shapes/wireframe-button.js";
import { renderCard } from "./shapes/wireframe-card.js";
import { renderCheckbox } from "./shapes/wireframe-checkbox.js";
import { renderContainer } from "./shapes/wireframe-container.js";
import { renderInput } from "./shapes/wireframe-input.js";
import { renderSelect } from "./shapes/wireframe-select.js";
import { createResize, getBounds, hitTest } from "./shared/wireframe-bounds.js";
import { WIREFRAME_SUBTYPES } from "./shared/wireframe-registry.js";

const SHAPE_RENDERERS: Record<
	string,
	(data: Parameters<typeof renderButton>[0]) => ReturnType<typeof renderButton>
> = {
	"wireframe-button": renderButton,
	"wireframe-input": renderInput,
	"wireframe-select": renderSelect,
	"wireframe-checkbox": renderCheckbox,
	"wireframe-card": renderCard,
	"wireframe-container": renderContainer,
};

const MIN_SIZES: Record<string, { width: number; height: number }> = {
	"wireframe-button": { width: 60, height: 32 },
	"wireframe-input": { width: 100, height: 32 },
	"wireframe-select": { width: 100, height: 32 },
	"wireframe-checkbox": { width: 80, height: 20 },
	"wireframe-card": { width: 160, height: 120 },
	"wireframe-container": { width: 200, height: 150 },
};

function WireframeIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<rect
				x="2"
				y="3"
				width="16"
				height="14"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<rect x="4" y="6" width="5" height="3" rx="1" fill="currentColor" opacity="0.3" />
			<rect x="4" y="11" width="12" height="2" rx="1" fill="currentColor" opacity="0.2" />
			<rect x="11" y="6" width="5" height="3" rx="1" fill="currentColor" opacity="0.15" />
		</svg>
	);
}

export const wireframePlugin: UsketchPlugin = {
	id: "usketch-plugin-shape-wireframe",
	name: "ワイヤーフレーム",

	setup(ctx: PluginContext) {
		// ── Register all wireframe shapes ──
		for (const subtype of WIREFRAME_SUBTYPES) {
			const renderer = SHAPE_RENDERERS[subtype.type];
			const minSize = MIN_SIZES[subtype.type];
			if (!renderer || !minSize) continue;

			ctx.shapes.register(subtype.type, {
				render: renderer,
				getBounds,
				hitTest,
				resize: createResize(minSize.width, minSize.height),
				createDefault: subtype.createDefault,
				renderTarget: "html",
				minSize,
			});
		}

		// ── Tool state ──
		let currentSubtype = WIREFRAME_SUBTYPES[0].type;

		// Listen for subtype changes from the toolbar picker
		ctx.events.on<{ type: string }>("wireframe:select-subtype", (data) => {
			currentSubtype = data.type;
		});

		function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
			const subtype = WIREFRAME_SUBTYPES.find((s) => s.type === currentSubtype);
			if (!subtype) return;

			const id = generateId();
			const shape = subtype.createDefault({
				id,
				x: event.worldPoint.x - subtype.defaultSize.width / 2,
				y: event.worldPoint.y - subtype.defaultSize.height / 2,
			});

			toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
			toolCtx.store.setSelection([id]);
			toolCtx.store.setActiveToolId("select");
		}

		ctx.tools.register("wireframe-draw", {
			icon: WireframeIcon,
			cursor: "crosshair",
			shortcut: "w",
			order: 100,
			onPointerDown,
		});
	},
};
