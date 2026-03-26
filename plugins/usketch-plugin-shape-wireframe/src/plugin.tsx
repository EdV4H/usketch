import {
	type CanvasPointerEvent,
	generateId,
	type PluginContext,
	type ShapeData,
	type ToolContext,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import type { ReactElement } from "react";
import { renderAccordion } from "./shapes/wireframe-accordion.js";
import { renderAlert } from "./shapes/wireframe-alert.js";
import { renderAvatar } from "./shapes/wireframe-avatar.js";
import { renderBadge } from "./shapes/wireframe-badge.js";
import { renderBreadcrumb } from "./shapes/wireframe-breadcrumb.js";
import { renderButton } from "./shapes/wireframe-button.js";
import { renderCard } from "./shapes/wireframe-card.js";
import { renderCheckbox } from "./shapes/wireframe-checkbox.js";
import { renderContainer } from "./shapes/wireframe-container.js";
import { renderDivider } from "./shapes/wireframe-divider.js";
import { renderImage } from "./shapes/wireframe-image.js";
import { renderInput } from "./shapes/wireframe-input.js";
import { renderList } from "./shapes/wireframe-list.js";
import { renderModal } from "./shapes/wireframe-modal.js";
import { renderNavbar } from "./shapes/wireframe-navbar.js";
import { renderProgress } from "./shapes/wireframe-progress.js";
import { renderSelect } from "./shapes/wireframe-select.js";
import { renderSidebar } from "./shapes/wireframe-sidebar.js";
import { renderTable } from "./shapes/wireframe-table.js";
import { renderTabs } from "./shapes/wireframe-tabs.js";
import { renderToast } from "./shapes/wireframe-toast.js";
import { createResize, getBounds, hitTest } from "./shared/wireframe-bounds.js";
import { WIREFRAME_SUBTYPES } from "./shared/wireframe-registry.js";

const SHAPE_RENDERERS: Record<string, (data: ShapeData) => ReactElement> = {
	"wireframe-button": renderButton,
	"wireframe-input": renderInput,
	"wireframe-select": renderSelect,
	"wireframe-checkbox": renderCheckbox,
	"wireframe-card": renderCard,
	"wireframe-container": renderContainer,
	"wireframe-navbar": renderNavbar,
	"wireframe-tabs": renderTabs,
	"wireframe-breadcrumb": renderBreadcrumb,
	"wireframe-sidebar": renderSidebar,
	"wireframe-avatar": renderAvatar,
	"wireframe-image": renderImage,
	"wireframe-badge": renderBadge,
	"wireframe-table": renderTable,
	"wireframe-list": renderList,
	"wireframe-alert": renderAlert,
	"wireframe-modal": renderModal,
	"wireframe-toast": renderToast,
	"wireframe-progress": renderProgress,
	"wireframe-divider": renderDivider,
	"wireframe-accordion": renderAccordion,
};

const MIN_SIZES: Record<string, { width: number; height: number }> = {
	"wireframe-button": { width: 60, height: 32 },
	"wireframe-input": { width: 100, height: 32 },
	"wireframe-select": { width: 100, height: 32 },
	"wireframe-checkbox": { width: 80, height: 20 },
	"wireframe-card": { width: 160, height: 120 },
	"wireframe-container": { width: 200, height: 150 },
	"wireframe-navbar": { width: 300, height: 40 },
	"wireframe-tabs": { width: 160, height: 32 },
	"wireframe-breadcrumb": { width: 120, height: 20 },
	"wireframe-sidebar": { width: 120, height: 150 },
	"wireframe-avatar": { width: 24, height: 24 },
	"wireframe-image": { width: 80, height: 60 },
	"wireframe-badge": { width: 40, height: 20 },
	"wireframe-table": { width: 200, height: 80 },
	"wireframe-list": { width: 100, height: 60 },
	"wireframe-alert": { width: 160, height: 36 },
	"wireframe-modal": { width: 240, height: 160 },
	"wireframe-toast": { width: 200, height: 36 },
	"wireframe-progress": { width: 80, height: 16 },
	"wireframe-divider": { width: 60, height: 8 },
	"wireframe-accordion": { width: 160, height: 100 },
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
