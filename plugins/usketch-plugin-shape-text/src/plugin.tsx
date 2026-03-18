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
} from "@edv4h/usketch-shared";
import {
	createAddShapeCommand,
	createDeleteShapeCommand,
	createUpdateShapeCommand,
} from "@edv4h/usketch-store";

// ── Shape Definition ──

const textStyle = (data: ShapeData): React.CSSProperties => ({
	width: "100%",
	height: "100%",
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
	outline: "none",
	fontFamily: (data.fontFamily as string) ?? "system-ui, sans-serif",
	fontSize: (data.fontSize as number) ?? 16,
	color: data.style.stroke,
	background: data.style.fill === "transparent" ? "transparent" : data.style.fill,
	lineHeight: 1.4,
	padding: 4,
	boxSizing: "border-box",
});

function focusAtEnd(el: HTMLElement) {
	el.focus();
	const sel = window.getSelection();
	if (sel) {
		const range = document.createRange();
		range.selectNodeContents(el);
		range.collapse(false);
		sel.removeAllRanges();
		sel.addRange(range);
	}
}

function render(data: ShapeData) {
	if (!data.isEditing) {
		return (
			<div style={{ ...textStyle(data), pointerEvents: "none", userSelect: "none" }}>
				{(data.text as string) ?? ""}
			</div>
		);
	}

	return (
		// biome-ignore lint/a11y/useSemanticElements: contentEditable div is standard for rich text editing
		<div
			contentEditable
			suppressContentEditableWarning
			role="textbox"
			aria-multiline="true"
			tabIndex={0}
			ref={(el: HTMLDivElement | null) => {
				if (!el) return;
				// Defer focus to next frame so it works even during pointerdown
				requestAnimationFrame(() => focusAtEnd(el));
			}}
			onInput={(e: React.FormEvent<HTMLDivElement>) => {
				// Skip store update during IME composition
				if ((e.nativeEvent as InputEvent).isComposing) return;
				const el = e.currentTarget;
				window.dispatchEvent(
					new CustomEvent("usketch:text-input", {
						detail: { id: data.id, text: el.innerText, scrollHeight: el.scrollHeight },
					}),
				);
			}}
			onCompositionEnd={(e: React.CompositionEvent<HTMLDivElement>) => {
				const el = e.currentTarget;
				window.dispatchEvent(
					new CustomEvent("usketch:text-input", {
						detail: { id: data.id, text: el.innerText, scrollHeight: el.scrollHeight },
					}),
				);
			}}
			onKeyDown={(e: React.KeyboardEvent) => {
				e.stopPropagation();
				// Ignore Escape during IME composition (let IME handle it)
				if (e.key === "Escape" && !e.nativeEvent.isComposing) {
					window.dispatchEvent(new CustomEvent("usketch:text-escape", { detail: { id: data.id } }));
				}
			}}
			onBlur={() => {
				window.dispatchEvent(new CustomEvent("usketch:text-blur", { detail: { id: data.id } }));
			}}
			onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
			style={{ ...textStyle(data), cursor: "text", pointerEvents: "auto", userSelect: "auto" }}
		>
			{(data.text as string) ?? ""}
		</div>
	);
}

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
	return { ...data, x, y, width: Math.max(40, width), height: Math.max(24, height) };
}

function createDefault(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "text",
		x: params.x,
		y: params.y,
		width: 200,
		height: 28,
		style: { ...DEFAULT_STYLE, fill: "transparent", strokeWidth: 0 },
		text: "",
		fontSize: 16,
		fontFamily: "system-ui, sans-serif",
		isEditing: false,
	};
}

// ── Icon ──

function TextIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<text
				x="10"
				y="15"
				textAnchor="middle"
				fontSize="14"
				fontWeight="bold"
				fill="currentColor"
				fontFamily="serif"
			>
				T
			</text>
		</svg>
	);
}

// ── Plugin ──

export const textPlugin: UsketchPlugin = {
	id: "usketch-plugin-shape-text",
	name: "テキスト",

	setup(ctx: PluginContext) {
		// ── Editing state (scoped to closure) ──
		let editingShapeId: string | null = null;
		let textSnapshot: string | null = null;
		let enterEditModeTime = 0;

		// ── Double-click detection ──
		let lastPointerDownTime = 0;
		let lastPointerDownShapeId: string | null = null;

		function enterEditMode(id: string) {
			if (editingShapeId === id) return;
			if (editingShapeId) exitEditMode();

			const shape = ctx.store.getShape(id);
			if (!shape || shape.type !== "text") return;

			editingShapeId = id;
			textSnapshot = (shape.text as string) ?? "";
			enterEditModeTime = Date.now();
			ctx.store.updateShape(id, { isEditing: true });
		}

		function exitEditMode() {
			if (!editingShapeId) return;
			const id = editingShapeId;
			const prevText = textSnapshot;
			editingShapeId = null;
			textSnapshot = null;

			const shape = ctx.store.getShape(id);
			if (!shape) return;

			ctx.store.updateShape(id, { isEditing: false });

			const currentText = (shape.text as string) ?? "";

			if (currentText.trim() === "") {
				// Empty text — delete shape
				ctx.commands.execute(createDeleteShapeCommand(ctx.store, id));
			} else if (currentText !== prevText) {
				// Text changed — create undo command
				ctx.commands.execute(
					createUpdateShapeCommand(
						ctx.store,
						id,
						{ text: prevText, height: shape.height },
						{ text: currentText, height: shape.height },
					),
				);
			}
		}

		// ── CustomEvent listeners ──
		const onTextInput = (e: Event) => {
			const { id, text, scrollHeight } = (e as CustomEvent).detail;
			if (id !== editingShapeId) return;
			const shape = ctx.store.getShape(id);
			if (!shape) return;
			const newHeight = Math.max(28, scrollHeight);
			ctx.store.updateShape(id, { text, height: newHeight });
		};

		const onTextBlur = (e: Event) => {
			const { id } = (e as CustomEvent).detail;
			if (id !== editingShapeId) return;
			// Ignore blur during initial focus setup after enterEditMode
			if (Date.now() - enterEditModeTime < 200) return;
			requestAnimationFrame(() => {
				if (id !== editingShapeId) return;
				exitEditMode();
			});
		};

		const onTextEscape = (e: Event) => {
			const { id } = (e as CustomEvent).detail;
			if (id !== editingShapeId) return;
			exitEditMode();
		};

		window.addEventListener("usketch:text-input", onTextInput);
		window.addEventListener("usketch:text-blur", onTextBlur);
		window.addEventListener("usketch:text-escape", onTextEscape);

		// ── Global pointerdown to exit edit mode on outside click ──
		const onWindowPointerDown = (e: PointerEvent) => {
			if (!editingShapeId) return;
			// Ignore clicks during initial focus setup after enterEditMode
			if (Date.now() - enterEditModeTime < 200) return;
			// If the click target is inside the editing contentEditable, ignore
			const target = e.target as HTMLElement;
			if (target.closest?.("[contenteditable=true]")) return;
			exitEditMode();
		};
		window.addEventListener("pointerdown", onWindowPointerDown, true);

		// ── Double-click detection via EventBus ──
		const offPointerDown = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", (event) => {
			const now = Date.now();
			const timeDiff = now - lastPointerDownTime;

			// Find text shape under pointer
			const shapes = ctx.store.getShapes();
			let hitShapeId: string | null = null;
			for (const [id, shape] of shapes) {
				if (shape.type === "text" && hitTest(shape, event.worldPoint)) {
					hitShapeId = id;
				}
			}

			if (hitShapeId && hitShapeId === lastPointerDownShapeId && timeDiff < 300) {
				enterEditMode(hitShapeId);
				lastPointerDownTime = 0;
				lastPointerDownShapeId = null;
			} else {
				lastPointerDownTime = now;
				lastPointerDownShapeId = hitShapeId;
			}
		});

		// ── Selection change monitoring ──
		const unsubscribe = ctx.store.subscribe(() => {
			if (!editingShapeId) return;
			const selection = ctx.store.getSelection();
			if (!selection.has(editingShapeId)) {
				exitEditMode();
			}
		});

		// ── Shape registration ──
		ctx.shapes.register("text", {
			render,
			getBounds,
			hitTest,
			resize,
			createDefault,
			renderTarget: "html",
			minSize: { width: 40, height: 24 },
		});

		// ── Draw tool registration ──
		ctx.tools.register("text-draw", {
			icon: TextIcon,
			cursor: "text",
			shortcut: "t",
			order: 25,
			onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
				const id = generateId();
				const defaults = createDefault({ id, x: event.worldPoint.x, y: event.worldPoint.y });
				// Anchor: left-center (shift Y up by half height)
				const shape = { ...defaults, y: defaults.y - defaults.height / 2 };
				toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
				toolCtx.store.setSelection([id]);
				toolCtx.store.setActiveToolId("select");
				// Enter edit mode — focus is deferred via rAF in ref callback
				enterEditMode(id);
			},
			onPointerMove() {},
			onPointerUp() {},
		});

		// ── Teardown ──
		const originalTeardown = textPlugin.teardown;
		textPlugin.teardown = () => {
			window.removeEventListener("usketch:text-input", onTextInput);
			window.removeEventListener("usketch:text-blur", onTextBlur);
			window.removeEventListener("usketch:text-escape", onTextEscape);
			window.removeEventListener("pointerdown", onWindowPointerDown, true);
			offPointerDown();
			unsubscribe();
			originalTeardown?.();
		};
	},
};
