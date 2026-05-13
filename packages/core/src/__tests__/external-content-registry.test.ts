import type {
	BoardStore,
	CommandRegistry,
	EventBus,
	ExternalContentFile,
	ExternalContentHandler,
	ExternalContentHandlerCtx,
	ExternalContentRegistry,
	ExternalContentText,
	ExternalContentUrl,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createExternalContentRegistry } from "../external-content-registry.js";

function makeCtx(registry: ExternalContentRegistry): ExternalContentHandlerCtx {
	return {
		store: {} as BoardStore,
		shapes: {} as ShapeRegistry,
		commands: {} as CommandRegistry,
		events: {} as EventBus,
		externalContent: registry,
	};
}

function makeRegistry(): ExternalContentRegistry {
	let registry!: ExternalContentRegistry;
	registry = createExternalContentRegistry(() => makeCtx(registry));
	return registry;
}

function fileContent(): ExternalContentFile {
	return {
		kind: "file",
		via: "drop",
		files: [new File(["x"], "x.png", { type: "image/png" })],
	};
}

function urlContent(url = "https://example.com"): ExternalContentUrl {
	return { kind: "url", via: "drop", url, source: "text" };
}

function textContent(text = "hello"): ExternalContentText {
	return { kind: "text", via: "drop", text, html: null };
}

function fileHandler(
	id: string,
	order: number,
	overrides: Partial<ExternalContentHandler<"file">> = {},
): ExternalContentHandler<"file"> {
	return {
		id,
		kind: "file",
		order,
		match: () => true,
		handle: vi.fn(),
		...overrides,
	};
}

function urlHandler(
	id: string,
	order: number,
	overrides: Partial<ExternalContentHandler<"url">> = {},
): ExternalContentHandler<"url"> {
	return {
		id,
		kind: "url",
		order,
		match: () => true,
		handle: vi.fn(),
		...overrides,
	};
}

describe("createExternalContentRegistry", () => {
	let errorSpy: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	it("returns false when no handlers are registered", async () => {
		const r = makeRegistry();
		expect(await r.dispatch(fileContent())).toBe(false);
	});

	it("filters by kind — a file handler does not run for url content", async () => {
		const r = makeRegistry();
		const handle = vi.fn();
		r.register(fileHandler("file", 0, { handle }));
		const dispatched = await r.dispatch(urlContent());
		expect(dispatched).toBe(false);
		expect(handle).not.toHaveBeenCalled();
	});

	it("higher order wins among matching handlers", async () => {
		const r = makeRegistry();
		const low = vi.fn();
		const high = vi.fn();
		r.register(fileHandler("low", 0, { handle: low }));
		r.register(fileHandler("high", 50, { handle: high }));
		await r.dispatch(fileContent());
		expect(high).toHaveBeenCalledTimes(1);
		expect(low).not.toHaveBeenCalled();
	});

	it("on tie, the last-registered handler wins", async () => {
		const r = makeRegistry();
		const first = vi.fn();
		const second = vi.fn();
		r.register(fileHandler("first", 10, { handle: first }));
		r.register(fileHandler("second", 10, { handle: second }));
		await r.dispatch(fileContent());
		expect(second).toHaveBeenCalledTimes(1);
		expect(first).not.toHaveBeenCalled();
	});

	it("re-registering the same id bumps it to last (wins on tie)", async () => {
		const r = makeRegistry();
		const a = vi.fn();
		const b = vi.fn();
		r.register(fileHandler("a", 10, { handle: a }));
		r.register(fileHandler("b", 10, { handle: b }));
		// b wins
		await r.dispatch(fileContent());
		expect(b).toHaveBeenCalledTimes(1);
		// re-register a; now a should win on tie
		const a2 = vi.fn();
		r.register(fileHandler("a", 10, { handle: a2 }));
		await r.dispatch(fileContent());
		expect(a2).toHaveBeenCalledTimes(1);
		expect(a).toHaveBeenCalledTimes(0);
	});

	it("unsubscribe returned by register removes the handler; unregister(id) too", async () => {
		const r = makeRegistry();
		const handle = vi.fn();
		const off = r.register(fileHandler("a", 0, { handle }));
		off();
		expect(await r.dispatch(fileContent())).toBe(false);

		r.register(fileHandler("b", 0, { handle }));
		r.unregister("b");
		expect(await r.dispatch(fileContent())).toBe(false);
	});

	it("match throw is treated as false; logs and other handlers are still considered", async () => {
		const r = makeRegistry();
		const winner = vi.fn();
		r.register(
			fileHandler("thrower", 100, {
				match: () => {
					throw new Error("boom");
				},
			}),
		);
		r.register(fileHandler("winner", 0, { handle: winner }));
		const dispatched = await r.dispatch(fileContent());
		expect(dispatched).toBe(true);
		expect(winner).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalled();
	});

	it("handle throw is logged; dispatch still resolves to true and next handler is NOT tried", async () => {
		const r = makeRegistry();
		const next = vi.fn();
		r.register(fileHandler("next", 0, { handle: next }));
		r.register(
			fileHandler("winner", 50, {
				handle: () => {
					throw new Error("kaboom");
				},
			}),
		);
		const dispatched = await r.dispatch(fileContent());
		expect(dispatched).toBe(true);
		expect(next).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalled();
	});

	it("awaits async handle before resolving", async () => {
		const r = makeRegistry();
		let resolved = false;
		r.register(
			fileHandler("async", 0, {
				handle: async () => {
					await new Promise((res) => setTimeout(res, 5));
					resolved = true;
				},
			}),
		);
		await r.dispatch(fileContent());
		expect(resolved).toBe(true);
	});

	it("handlers whose match returns false do not run", async () => {
		const r = makeRegistry();
		const skipped = vi.fn();
		const winner = vi.fn();
		r.register(urlHandler("skipped", 100, { match: () => false, handle: skipped }));
		r.register(urlHandler("winner", 0, { handle: winner }));
		await r.dispatch(urlContent());
		expect(skipped).not.toHaveBeenCalled();
		expect(winner).toHaveBeenCalledTimes(1);
	});

	it("getHandlers returns all registered handlers in insertion order", () => {
		const r = makeRegistry();
		r.register(fileHandler("a", 0));
		r.register(urlHandler("b", 0));
		const ids = r.getHandlers().map((h) => h.id);
		expect(ids).toEqual(["a", "b"]);
	});

	it("text kind dispatch invokes a matching text handler", async () => {
		const r = makeRegistry();
		const handle = vi.fn();
		r.register({
			id: "text",
			kind: "text",
			order: 0,
			match: () => true,
			handle,
		});
		await r.dispatch(textContent("svg-paste"));
		expect(handle).toHaveBeenCalledTimes(1);
	});
});
