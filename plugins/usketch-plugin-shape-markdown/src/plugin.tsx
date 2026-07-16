import {
	type BoundingBox,
	type CanvasPointerEvent,
	DEFAULT_STYLE,
	generateId,
	type PluginContext,
	type Point,
	type ResizeHandle,
	type ShapeData,
	type ToolContext,
	type UsketchPlugin,
	withRotation,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { MARKDOWN_DEFAULT_SIZE, MARKDOWN_MIN_SIZE, MARKDOWN_SHORTCUT } from "./constants.js";
import {
	createMarkdownTableHandler,
	createMarkdownTextHandler,
} from "./external-content-handler.js";
import { createMarkdownEditingService } from "./markdown-editing-machine.js";
import {
	MD_BLUR_EVENT,
	MD_ESCAPE_EVENT,
	MD_INPUT_EVENT,
	MD_MEASURE_EVENT,
	renderMarkdown,
	SimplifiedMarkdown,
} from "./render.js";
import { markdownSelection } from "./selection-store.js";
import { MARKDOWN_TYPE, type MarkdownShapeData, readMarkdownMeta } from "./types.js";

// ── Shape definition helpers ──

function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

function hitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

function resize(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	let { x, y, width, height } = data;
	switch (handle) {
		case "se":
			width += delta.x;
			height += delta.y;
			break;
		case "nw":
			x += delta.x;
			y += delta.y;
			width -= delta.x;
			height -= delta.y;
			break;
		case "ne":
			y += delta.y;
			width += delta.x;
			height -= delta.y;
			break;
		case "sw":
			x += delta.x;
			width -= delta.x;
			height += delta.y;
			break;
		case "e":
			width += delta.x;
			break;
		case "w":
			x += delta.x;
			width -= delta.x;
			break;
		case "n":
			y += delta.y;
			height -= delta.y;
			break;
		case "s":
			height += delta.y;
			break;
	}
	return {
		...data,
		x,
		y,
		width: Math.max(MARKDOWN_MIN_SIZE.width, width),
		height: Math.max(MARKDOWN_MIN_SIZE.height, height),
	};
}

function createDefault(params: { id: string; x: number; y: number }): MarkdownShapeData {
	return {
		id: params.id,
		type: MARKDOWN_TYPE,
		x: params.x,
		y: params.y,
		width: MARKDOWN_DEFAULT_SIZE.width,
		height: MARKDOWN_DEFAULT_SIZE.height,
		style: { ...DEFAULT_STYLE, fill: "transparent", strokeWidth: 0 },
		meta: { source: "", isEditing: false },
	};
}

function serializeForAi(shape: ShapeData): Record<string, unknown> {
	return { source: readMarkdownMeta(shape).source };
}

function debugFields(shape: ShapeData): Record<string, unknown> {
	const { source, isEditing } = readMarkdownMeta(shape);
	return {
		source: source.length > 40 ? `${source.slice(0, 40)}…` : source,
		isEditing,
	};
}

function MarkdownIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
			<text
				x="10"
				y="14"
				textAnchor="middle"
				fontSize="11"
				fontWeight="bold"
				fill="currentColor"
				fontFamily="ui-monospace, monospace"
			>
				M↓
			</text>
		</svg>
	);
}

// ── Plugin ──

export function createMarkdownPlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-shape-markdown",
		name: "Markdown",

		setup(ctx: PluginContext) {
			const service = createMarkdownEditingService(ctx);
			const { send, matches, stop: stopMachine } = service;

			// ── Editor CustomEvent listeners (dispatched from render.tsx) ──
			const onInput = (e: Event) => {
				const { id, source, scrollHeight } = (e as CustomEvent).detail;
				send({ type: "EDIT_INPUT", id, source, scrollHeight });
			};
			const onBlur = (e: Event) => {
				const { id } = (e as CustomEvent).detail;
				requestAnimationFrame(() => send({ type: "EDIT_BLUR", id }));
			};
			const onEscape = (e: Event) => {
				const { id } = (e as CustomEvent).detail;
				send({ type: "EDIT_ESCAPE", id });
			};
			// Auto-fit shape height to rendered content (view mode only). Applied
			// directly (not via a command) so it never pollutes undo history.
			const onMeasure = (e: Event) => {
				const { id, height } = (e as CustomEvent).detail as { id: string; height: number };
				const shape = ctx.store.getShape(id);
				if (!shape || shape.type !== MARKDOWN_TYPE) return;
				if (readMarkdownMeta(shape).isEditing) return;
				if (height > 0 && Math.abs(shape.height - height) > 1) {
					ctx.store.updateShape(id, { height });
				}
			};

			window.addEventListener(MD_INPUT_EVENT, onInput);
			window.addEventListener(MD_BLUR_EVENT, onBlur);
			window.addEventListener(MD_ESCAPE_EVENT, onEscape);
			window.addEventListener(MD_MEASURE_EVENT, onMeasure);

			// ── Outside-click exits edit mode ──
			const onWindowPointerDown = (e: PointerEvent) => {
				if (!matches("editing")) return;
				const target = e.target instanceof Element ? e.target : (e.target as Node)?.parentElement;
				if (target?.closest("[data-usketch-md-editor]")) return;
				send({ type: "OUTSIDE_CLICK" });
			};
			window.addEventListener("pointerdown", onWindowPointerDown, true);

			// ── Paste / drop → markdown shape ──
			// Table handler (order 10) wins for tabular content; plain text falls
			// through to the catch-all (order 0).
			const offTableHandler = ctx.externalContent.register(createMarkdownTableHandler());
			const offExternal = ctx.externalContent.register(createMarkdownTextHandler());

			// The currently-selected single markdown shape, or null. Used by the
			// "Edit source" action's isEnabled/run.
			const selectedMarkdownId = (): string | null => {
				const sel = ctx.store.getSelection();
				if (sel.size !== 1) return null;
				const id = [...sel][0] as string;
				return ctx.store.getShape(id)?.type === MARKDOWN_TYPE ? id : null;
			};

			// ── Explicit edit trigger: Control HUD "Edit source" action ──
			// (Editing is intentionally NOT bound to double-click, so rendered
			// content interactions stay free.)
			const offEditAction = ctx.actions.register({
				id: "markdown:edit",
				label: "✎ Edit source",
				group: "Markdown",
				isEnabled: () => selectedMarkdownId() !== null,
				run: () => {
					const id = selectedMarkdownId();
					if (id) send({ type: "BEGIN_EDIT", shapeId: id });
				},
			});

			// ── Track selection (drives content interactivity) + exit edit on deselect ──
			markdownSelection.set(ctx.store.getSelection());
			const unsubscribe = ctx.store.subscribe(() => {
				markdownSelection.set(ctx.store.getSelection());
				const editingShapeId = service.context.editingShapeId;
				if (editingShapeId && !ctx.store.getSelection().has(editingShapeId)) {
					send({ type: "DESELECTED" });
				}
			});

			// ── Shape registration ──
			ctx.shapes.register(MARKDOWN_TYPE, {
				render: renderMarkdown,
				getBounds,
				hitTest: withRotation(hitTest),
				resize,
				createDefault,
				renderTarget: "html",
				minSize: MARKDOWN_MIN_SIZE,
				simplifiedComponent: SimplifiedMarkdown,
				serializeForAi,
				debugFields,
			});

			// ── Draw tool ──
			ctx.tools.register("markdown-draw", {
				icon: MarkdownIcon,
				cursor: "text",
				shortcut: MARKDOWN_SHORTCUT,
				order: 26,
				onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
					const id = generateId();
					const defaults = createDefault({ id, x: event.worldPoint.x, y: event.worldPoint.y });
					const shape = { ...defaults, y: defaults.y - defaults.height / 2 };
					toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
					toolCtx.store.setSelection([id]);
					toolCtx.store.resetToDefaultTool();
					send({ type: "CREATE_SHAPE", shapeId: id });
				},
				onPointerMove() {},
				onPointerUp() {},
			});

			// ── Teardown ──
			return () => {
				stopMachine();
				window.removeEventListener(MD_INPUT_EVENT, onInput);
				window.removeEventListener(MD_BLUR_EVENT, onBlur);
				window.removeEventListener(MD_ESCAPE_EVENT, onEscape);
				window.removeEventListener(MD_MEASURE_EVENT, onMeasure);
				window.removeEventListener("pointerdown", onWindowPointerDown, true);
				offEditAction();
				offTableHandler();
				offExternal();
				unsubscribe();
			};
		},
	};
}
