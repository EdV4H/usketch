import type {
	Command,
	ExternalContentHandlerCtx,
	ExternalContentText,
	PluginContext,
	ShapeData,
} from "@edv4h/usketch-shared";
import { DEFAULT_STYLE } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { afterEach, describe, expect, it } from "vitest";
import { createMarkdownTextHandler } from "../external-content-handler.js";
import { createMarkdownEditingService } from "../markdown-editing-machine.js";
import { MARKDOWN_TYPE, type MarkdownShapeData, readMarkdownMeta } from "../types.js";

// ── readMarkdownMeta (pure) ──

describe("readMarkdownMeta", () => {
	it("returns safe defaults when meta is missing", () => {
		const shape = { meta: undefined } as unknown as ShapeData;
		expect(readMarkdownMeta(shape)).toEqual({ source: "", isEditing: false });
	});

	it("reads source and isEditing from meta", () => {
		const shape = { meta: { source: "# Hi", isEditing: true } } as unknown as ShapeData;
		expect(readMarkdownMeta(shape)).toEqual({ source: "# Hi", isEditing: true });
	});

	it("coerces wrong types to defaults (defensive against foreign shapes)", () => {
		const shape = { meta: { source: 123, isEditing: "yes" } } as unknown as ShapeData;
		expect(readMarkdownMeta(shape)).toEqual({ source: "", isEditing: false });
	});
});

// ── Editing machine flow (real store + minimal command registry) ──

function makeCtx() {
	const store = createBoardStore();
	const history: Command[] = [];
	const commands = {
		execute: (c: Command) => {
			c.execute();
			history.push(c);
		},
		undo: () => history.pop()?.undo(),
		redo: () => {},
		canUndo: () => history.length > 0,
		canRedo: () => false,
		getHistorySize: () => history.length,
		getCursor: () => history.length - 1,
	};
	const ctx = { store, commands } as unknown as PluginContext;
	return { ctx, store, history };
}

function addMarkdown(store: ReturnType<typeof createBoardStore>, id: string, source = ""): void {
	const shape: MarkdownShapeData = {
		id,
		type: MARKDOWN_TYPE,
		x: 0,
		y: 0,
		width: 320,
		height: 120,
		style: { ...DEFAULT_STYLE },
		meta: { source, isEditing: false },
	};
	store.addShape(shape);
}

describe("markdown editing machine", () => {
	let service: ReturnType<typeof createMarkdownEditingService> | null = null;
	// The machine processes internally-queued events (e.g. the entry action's
	// ENTER_EDIT) on a microtask, so flush between sends before asserting.
	const tick = () => new Promise((r) => setTimeout(r, 0));
	afterEach(() => {
		service?.stop();
		service = null;
	});

	it("CREATE_SHAPE → EDIT_INPUT updates meta.source (merged, not replaced) and height", async () => {
		const { ctx, store } = makeCtx();
		addMarkdown(store, "m1");
		store.setSelection(["m1"]);
		service = createMarkdownEditingService(ctx);

		service.send({ type: "CREATE_SHAPE", shapeId: "m1" });
		await tick();
		expect(readMarkdownMeta(store.getShape("m1") as ShapeData).isEditing).toBe(true);

		service.send({ type: "EDIT_INPUT", id: "m1", source: "# Title", scrollHeight: 200 });
		await tick();
		const shape = store.getShape("m1") as ShapeData;
		expect(readMarkdownMeta(shape).source).toBe("# Title");
		// isEditing must survive the source merge (meta is merged, not overwritten).
		expect(readMarkdownMeta(shape).isEditing).toBe(true);
		expect(shape.height).toBe(200);
	});

	it("EDIT_ESCAPE with non-empty source exits edit and records an undoable change", async () => {
		const { ctx, store, history } = makeCtx();
		addMarkdown(store, "m2");
		store.setSelection(["m2"]);
		service = createMarkdownEditingService(ctx);

		service.send({ type: "CREATE_SHAPE", shapeId: "m2" });
		await tick();
		service.send({ type: "EDIT_INPUT", id: "m2", source: "hello", scrollHeight: 100 });
		await tick();
		service.send({ type: "EDIT_ESCAPE", id: "m2" });
		await tick();

		const shape = store.getShape("m2") as ShapeData;
		expect(readMarkdownMeta(shape).isEditing).toBe(false);
		expect(readMarkdownMeta(shape).source).toBe("hello");
		expect(history.length).toBe(1);
	});

	it("BEGIN_EDIT enters edit mode for an existing shape (explicit edit trigger)", async () => {
		const { ctx, store } = makeCtx();
		addMarkdown(store, "me", "# existing");
		store.setSelection(["me"]);
		service = createMarkdownEditingService(ctx);

		service.send({ type: "BEGIN_EDIT", shapeId: "me" });
		await tick();

		const shape = store.getShape("me") as ShapeData;
		expect(readMarkdownMeta(shape).isEditing).toBe(true);
		expect(readMarkdownMeta(shape).source).toBe("# existing");
	});

	it("EDIT_ESCAPE with empty source deletes the shape", async () => {
		const { ctx, store } = makeCtx();
		addMarkdown(store, "m3");
		store.setSelection(["m3"]);
		service = createMarkdownEditingService(ctx);

		service.send({ type: "CREATE_SHAPE", shapeId: "m3" });
		await tick();
		service.send({ type: "EDIT_INPUT", id: "m3", source: "   ", scrollHeight: 60 });
		await tick();
		service.send({ type: "EDIT_ESCAPE", id: "m3" });
		await tick();

		expect(store.getShape("m3")).toBeUndefined();
	});
});

// ── Paste / drop text → markdown shape ──

function textContent(text: string): ExternalContentText {
	return { kind: "text", via: "paste", text, html: null };
}

describe("markdown text external-content handler", () => {
	const handler = createMarkdownTextHandler();
	const ctx = {} as ExternalContentHandlerCtx;

	it("matches non-empty text", () => {
		expect(handler.match(textContent("# hello"), ctx)).toBe(true);
	});

	it("ignores empty/whitespace-only text", () => {
		expect(handler.match(textContent("   "), ctx)).toBe(false);
	});

	it("does not hijack the internal shape-clipboard JSON", () => {
		const internal = JSON.stringify({ format: "usketch/shapes", shapes: [] });
		expect(handler.match(textContent(internal), ctx)).toBe(false);
		// ...but unrelated JSON is still treated as markdown text.
		expect(handler.match(textContent('{"foo":1}'), ctx)).toBe(true);
	});

	it("creates a selected markdown shape carrying the pasted text (undoable)", () => {
		const store = createBoardStore();
		const history: Command[] = [];
		const hctx = {
			store,
			commands: {
				execute: (c: Command) => {
					c.execute();
					history.push(c);
				},
			},
		} as unknown as ExternalContentHandlerCtx;

		handler.handle(textContent("# Pasted\n\n- a\n- b"), hctx);

		const shapes = [...store.getShapes().values()];
		expect(shapes).toHaveLength(1);
		const shape = shapes[0] as ShapeData;
		expect(shape.type).toBe(MARKDOWN_TYPE);
		expect(readMarkdownMeta(shape).source).toBe("# Pasted\n\n- a\n- b");
		expect(store.getSelection().has(shape.id)).toBe(true);
		expect(history).toHaveLength(1);
	});
});
