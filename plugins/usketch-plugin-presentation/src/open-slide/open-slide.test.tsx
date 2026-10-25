import type { Command, CommandRegistry } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { type Context, createContext, useContext } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenSlideDeckRegistry } from "./deck-registry.js";
import { OpenSlideEditState } from "./edit-state.js";
import { createOpenSlideApi, setOpenSlidePage } from "./open-slide-service.js";
import { createOpenSlideShapeData, resizeOpenSlideShape } from "./open-slide-shape.js";
import { isInsideOpenSlideShape, OpenSlideShapeView } from "./open-slide-shape-view.js";
import { OpenSlideText } from "./open-slide-text.js";
import {
	resetOpenSlideOverrides,
	setOpenSlidePalette,
	setOpenSlideText,
	withOpenSlidePalette,
	withOpenSlideText,
} from "./overrides.js";
import { MutablePresentCursor } from "./present-cursor.js";
import { isOpenSlideShape, type OpenSlideModule, type OpenSlideShapeData } from "./types.js";

const PAGE_KEY = "__open_slide_page_context__";

function deckModule(titles: string[]): OpenSlideModule {
	return {
		default: titles.map((t) => {
			const Page = () => <h1>{t}</h1>;
			return Page;
		}),
		meta: { title: "Demo" },
		design: {
			palette: { bg: "#101010", text: "#fafafa", accent: "#ff0000" },
			fonts: { display: "serif", body: "sans-serif" },
			typeScale: { hero: 120, body: 32 },
			radius: 8,
		},
	};
}

function commandsFor(): CommandRegistry {
	return {
		execute: (c) => c.execute(),
		undo: () => {},
		redo: () => {},
		canUndo: () => false,
		canRedo: () => false,
		getHistorySize: () => 0,
		getCursor: () => 0,
	};
}

function shapeOf(overrides: Partial<OpenSlideShapeData> = {}): OpenSlideShapeData {
	return {
		...createOpenSlideShapeData({
			id: "os1",
			deck: { id: "demo", title: "Demo" },
			center: { x: 960, y: 540 },
			width: 1920,
		}),
		...overrides,
	};
}

afterEach(() => {
	delete (globalThis as Record<string, unknown>)[PAGE_KEY];
});

describe("OpenSlideDeckRegistry", () => {
	it("同じデッキは一度だけ読み込み、完了を通知する", async () => {
		const load = vi.fn(async () => deckModule(["a", "b"]));
		const registry = new OpenSlideDeckRegistry([{ id: "demo", title: "Demo", load }]);
		const listener = vi.fn();
		registry.subscribe(listener);

		expect(registry.getPageCount("demo")).toBeUndefined();
		await Promise.all([registry.load("demo"), registry.load("demo")]);
		expect(load).toHaveBeenCalledTimes(1);
		expect(registry.getPageCount("demo")).toBe(2);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("失敗はエラーとして残し、再読み込みできる", async () => {
		const load = vi
			.fn<() => Promise<OpenSlideModule>>()
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValueOnce(deckModule(["a"]));
		const registry = new OpenSlideDeckRegistry([{ id: "demo", title: "Demo", load }]);
		await expect(registry.load("demo")).rejects.toThrow("boom");
		expect(registry.getError("demo")).toBeInstanceOf(Error);
		await registry.load("demo");
		expect(registry.getPageCount("demo")).toBe(1);
		expect(registry.getError("demo")).toBeUndefined();
	});

	it("未登録のデッキは reject する", async () => {
		const registry = new OpenSlideDeckRegistry([]);
		await expect(registry.load("missing")).rejects.toThrow(/not registered/);
	});
});

describe("open-slide Shape のジオメトリ", () => {
	it("中心を基準に 16:9 の Shape を作る", () => {
		const s = createOpenSlideShapeData({
			id: "x",
			deck: { id: "demo", title: "Demo" },
			center: { x: 0, y: 0 },
			width: 1600,
			pageCount: 4,
		});
		expect(s).toMatchObject({
			x: -800,
			y: -450,
			width: 1600,
			height: 900,
			page: 0,
			pageCount: 4,
			title: "Demo",
		});
		expect(isOpenSlideShape(s)).toBe(true);
	});

	it("リサイズしても 16:9 を保つ", () => {
		const s = shapeOf({ x: 0, y: 0, width: 1600, height: 900 });
		const se = resizeOpenSlideShape(s, "se", { x: 160, y: 0 });
		expect(se).toMatchObject({ x: 0, y: 0, width: 1760, height: 990 });

		const nw = resizeOpenSlideShape(s, "nw", { x: 160, y: 0 });
		expect(nw).toMatchObject({ x: 160, y: 90, width: 1440, height: 810 });

		const n = resizeOpenSlideShape(s, "n", { x: 0, y: -90 });
		expect(n.height).toBe(990);
		expect(n.width).toBe(1760);
		expect(n.x).toBe(-80);
	});

	it("最小幅より小さくしない", () => {
		const s = shapeOf({ x: 0, y: 0, width: 200, height: 112.5 });
		const r = resizeOpenSlideShape(s, "se", { x: -500, y: 0 });
		expect(r.width).toBe(160);
		expect(r.height).toBe(90);
	});
});

describe("OpenSlideShapeView", () => {
	async function loadedRegistry() {
		const registry = new OpenSlideDeckRegistry([
			{ id: "demo", title: "Demo", load: async () => deckModule(["one", "two", "three"]) },
		]);
		await registry.load("demo");
		return registry;
	}

	function render(
		registry: OpenSlideDeckRegistry,
		shape: OpenSlideShapeData,
		cursor = new MutablePresentCursor(),
		editState = new OpenSlideEditState(),
	) {
		return renderToStaticMarkup(
			<OpenSlideShapeView
				shape={shape}
				registry={registry}
				presentCursor={cursor}
				onSetPage={() => {}}
				editState={editState}
				onCommitText={() => {}}
			/>,
		);
	}

	async function textRegistry() {
		const Title = () => (
			<h1>
				<OpenSlideText id="title">Hello</OpenSlideText>
			</h1>
		);
		const registry = new OpenSlideDeckRegistry([
			{
				id: "demo",
				title: "Demo",
				load: async () => ({ ...deckModule([]), default: [Title, Title] }),
			},
		]);
		await registry.load("demo");
		return registry;
	}

	it("OpenSlideText は差し替えがあればその文字を、なければ初期値を出す", async () => {
		const registry = await textRegistry();
		expect(render(registry, shapeOf({ page: 0 }))).toContain("<h1>Hello</h1>");
		const html = render(
			registry,
			shapeOf({ page: 1, overrides: { text: { "0:title": "First", "1:title": "Second" } } }),
		);
		expect(html).toContain("Second");
		expect(html).not.toContain("First");
	});

	it("編集中のデッキだけ OpenSlideText を入力欄にする。発表中は編集しない", async () => {
		const registry = await textRegistry();
		const editState = new OpenSlideEditState();
		editState.begin("os1");
		// HTML の属性名は大文字小文字を区別しないので、小文字にそろえて見る。
		const html = (shape: OpenSlideShapeData, cursor?: MutablePresentCursor) =>
			render(registry, shape, cursor, editState).toLowerCase();
		expect(html(shapeOf())).toContain('contenteditable="plaintext-only"');
		expect(html(shapeOf({ id: "os2" }))).not.toContain("contenteditable");
		const cursor = new MutablePresentCursor();
		cursor.set({ shapeId: "os1", step: 0 });
		expect(html(shapeOf(), cursor)).not.toContain("contenteditable");
	});

	it("配色の差し替えはデッキの design に重ねる", async () => {
		const html = render(
			await loadedRegistry(),
			shapeOf({ overrides: { palette: { accent: "#00ff00" } } }),
		);
		expect(html).toContain("--osd-accent:#00ff00");
		expect(html).toContain("--osd-bg:#101010");
	});

	it("編集中は Shape の page を表示し、ページ送りを出す", async () => {
		const html = render(await loadedRegistry(), shapeOf({ page: 1 }));
		expect(html).toContain("<h1>two</h1>");
		expect(html).toContain(">2 / 3<");
		expect(html).toContain("--osd-accent:#ff0000");
	});

	it("発表中に画角に入っていれば発表のステップを表示し、ページ送りは出さない", async () => {
		const cursor = new MutablePresentCursor();
		cursor.set({ shapeId: "os1", step: 2 });
		const html = render(await loadedRegistry(), shapeOf({ page: 0 }), cursor);
		expect(html).toContain("<h1>three</h1>");
		expect(html).not.toContain("次のページ");
	});

	it("別のスライドを発表中なら Shape の page のまま", async () => {
		const cursor = new MutablePresentCursor();
		cursor.set({ shapeId: "other", step: 2 });
		const html = render(await loadedRegistry(), shapeOf({ page: 0 }), cursor);
		expect(html).toContain("<h1>one</h1>");
	});

	it("open-slide のページ Context があればページ番号を流す", async () => {
		const ctx = createContext<{ index: number; total: number } | null>(null);
		(globalThis as Record<string, unknown>)[PAGE_KEY] = ctx;
		const PageNumber = () => {
			const v = useContext(ctx as Context<{ index: number; total: number } | null>);
			return <p>{v ? `${v.index + 1}/${v.total}` : "none"}</p>;
		};
		const registry = new OpenSlideDeckRegistry([
			{ id: "demo", title: "Demo", load: async () => ({ default: [PageNumber, PageNumber] }) },
		]);
		await registry.load("demo");
		expect(render(registry, shapeOf({ page: 1 }))).toContain("<p>2/2</p>");
	});

	it("デッキの描画に shapeId を付ける", async () => {
		expect(render(await loadedRegistry(), shapeOf())).toContain('data-open-slide-shape-id="os1"');
	});

	it("同じ Shape の別の描画 (サムネイル等) の内側はデッキの外と見なさない", () => {
		// closest だけを持つ最小の要素。属性を持つ祖先を返す。
		const inside = (shapeId: string | null) => ({
			closest: () => (shapeId === null ? null : { getAttribute: () => shapeId }),
		});
		expect(isInsideOpenSlideShape(inside("os1") as unknown as EventTarget, "os1")).toBe(true);
		expect(isInsideOpenSlideShape(inside("os2") as unknown as EventTarget, "os1")).toBe(false);
		expect(isInsideOpenSlideShape(inside(null) as unknown as EventTarget, "os1")).toBe(false);
		expect(isInsideOpenSlideShape(null, "os1")).toBe(false);
	});

	it("読み込み前・未登録はプレースホルダを出す", () => {
		const registry = new OpenSlideDeckRegistry([
			{ id: "demo", title: "Demo", load: () => new Promise(() => {}) },
		]);
		expect(render(registry, shapeOf())).toContain("読み込み中");
		expect(render(registry, shapeOf({ deckId: "missing" }))).toContain("見つかりません");
	});
});

describe("open-slide サービス", () => {
	it("insertDeck は画面中央にデッキ Shape を置き、読み込み後にページ数を反映する", async () => {
		const store = createBoardStore();
		const registry = new OpenSlideDeckRegistry([
			{ id: "demo", title: "Demo", load: async () => deckModule(["a", "b", "c"]) },
		]);
		const api = createOpenSlideApi({
			store,
			commands: commandsFor(),
			registry,
			editState: new OpenSlideEditState(),
			getViewportSize: () => ({ width: 800, height: 600 }),
		});

		const id = api.insertDeck({ deckId: "demo", width: 800 });
		expect(id).not.toBeNull();
		const placed = store.getShape(id as string) as OpenSlideShapeData;
		expect(placed).toMatchObject({ type: "open-slide", deckId: "demo", width: 800, height: 450 });
		// viewport 初期値 (原点・zoom 1) の画面中央 (400, 300) が中心になる
		expect(placed.x + placed.width / 2).toBe(400);
		expect(placed.y + placed.height / 2).toBe(300);

		await registry.load("demo");
		await Promise.resolve();
		expect((store.getShape(id as string) as OpenSlideShapeData).pageCount).toBe(3);
		expect(api.insertDeck({ deckId: "missing" })).toBeNull();
	});

	it("setPage はページ数に clamp する", async () => {
		const store = createBoardStore();
		const registry = new OpenSlideDeckRegistry([
			{ id: "demo", title: "Demo", load: async () => deckModule(["a", "b"]) },
		]);
		await registry.load("demo");
		store.addShape(shapeOf());
		setOpenSlidePage(store, registry, "os1", 5);
		expect((store.getShape("os1") as OpenSlideShapeData).page).toBe(1);
		setOpenSlidePage(store, registry, "os1", -1);
		expect((store.getShape("os1") as OpenSlideShapeData).page).toBe(0);
	});
});

describe("open-slide の差し替え", () => {
	function recordingCommands(): CommandRegistry & { last: () => Command | undefined } {
		const done: Command[] = [];
		return {
			...commandsFor(),
			execute: (c) => {
				c.execute();
				done.push(c);
			},
			last: () => done.at(-1),
		};
	}

	it("初期値と同じ文字や null は差し替えを消し、空なら {} になる", () => {
		const a = withOpenSlideText(undefined, 0, "title", "New", "Old");
		expect(a).toEqual({ text: { "0:title": "New" } });
		expect(withOpenSlideText(a, 0, "title", "Old", "Old")).toEqual({});
		expect(withOpenSlideText(a, 0, "title", null, "Old")).toEqual({});
		const b = withOpenSlidePalette(a, { accent: "#00ff00", bg: null });
		expect(b).toEqual({ text: { "0:title": "New" }, palette: { accent: "#00ff00" } });
		expect(withOpenSlidePalette(b, { accent: null })).toEqual({ text: { "0:title": "New" } });
	});

	it("setOpenSlideText / setOpenSlidePalette は undo でき、reset で全部消える", () => {
		const store = createBoardStore();
		store.addShape(shapeOf());
		const commands = recordingCommands();
		const overrides = () => (store.getShape("os1") as OpenSlideShapeData).overrides;

		setOpenSlideText(store, commands, "os1", {
			page: 1,
			id: "title",
			value: "New",
			defaultValue: "Old",
		});
		expect(overrides()).toEqual({ text: { "1:title": "New" } });
		commands.last()?.undo();
		expect(overrides()).toEqual({});

		setOpenSlidePalette(store, commands, "os1", { text: "#111111" });
		expect(overrides()).toEqual({ palette: { text: "#111111" } });
		resetOpenSlideOverrides(store, commands, "os1");
		expect(overrides()).toEqual({});
	});

	it("変化がなければコマンドを積まない", () => {
		const store = createBoardStore();
		store.addShape(shapeOf());
		const commands = recordingCommands();
		setOpenSlideText(store, commands, "os1", {
			page: 0,
			id: "title",
			value: "Old",
			defaultValue: "Old",
		});
		expect(commands.last()).toBeUndefined();
	});

	it("beginEdit はデッキ Shape だけ編集状態にする", () => {
		const store = createBoardStore();
		store.addShape(shapeOf());
		const editState = new OpenSlideEditState();
		const api = createOpenSlideApi({
			store,
			commands: commandsFor(),
			registry: new OpenSlideDeckRegistry([]),
			editState,
			getViewportSize: () => ({ width: 800, height: 600 }),
		});
		api.beginEdit("missing");
		expect(api.getEditingId()).toBeNull();
		api.beginEdit("os1");
		expect(api.getEditingId()).toBe("os1");
		api.endEdit();
		expect(api.getEditingId()).toBeNull();
	});

	it("ボードの外では OpenSlideText は初期値をそのまま出す", () => {
		expect(renderToStaticMarkup(<OpenSlideText id="t">Plain</OpenSlideText>)).toBe("Plain");
	});
});
