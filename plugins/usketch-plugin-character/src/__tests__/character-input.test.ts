import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createKeyInput } from "../character-input.js";
import { DEFAULT_KEYS } from "../character-types.js";

type Listener = (e: unknown) => void;

/** A minimal window/document stand-in that records listeners (the test env has no DOM). */
function fakeDom() {
	const win = new Map<string, Listener[]>();
	const doc = new Map<string, Listener[]>();
	const add = (m: Map<string, Listener[]>) => (type: string, fn: Listener) =>
		m.set(type, [...(m.get(type) ?? []), fn]);
	const remove = (m: Map<string, Listener[]>) => (type: string, fn: Listener) =>
		m.set(
			type,
			(m.get(type) ?? []).filter((f) => f !== fn),
		);
	vi.stubGlobal("window", { addEventListener: add(win), removeEventListener: remove(win) });
	const document = { hidden: false, addEventListener: add(doc), removeEventListener: remove(doc) };
	vi.stubGlobal("document", document);
	const fire = (type: string, init: Record<string, unknown> = {}) => {
		const e = {
			code: "",
			target: { tagName: "DIV" },
			ctrlKey: false,
			metaKey: false,
			altKey: false,
			preventDefault: vi.fn(),
			stopImmediatePropagation: vi.fn(),
			...init,
		};
		for (const fn of win.get(type) ?? []) fn(e);
		return e;
	};
	return {
		win,
		fire,
		document,
		fireDoc: (t: string) => {
			for (const f of doc.get(t) ?? []) f({});
		},
	};
}

describe("createKeyInput", () => {
	let dom: ReturnType<typeof fakeDom>;
	beforeEach(() => {
		dom = fakeDom();
	});
	afterEach(() => vi.unstubAllGlobals());

	it("tracks held bound keys and swallows them", () => {
		const input = createKeyInput(DEFAULT_KEYS, () => true);
		const e = dom.fire("keydown", { code: "KeyW" });
		expect(input.read()).toEqual({ up: true, down: false, left: false, right: false });
		expect(e.stopImmediatePropagation).toHaveBeenCalled();
		dom.fire("keyup", { code: "KeyW" });
		expect(input.read().up).toBe(false);
		input.dispose();
	});

	it("ignores unbound keys, chords, text inputs, and inactive state", () => {
		let active = true;
		const input = createKeyInput(DEFAULT_KEYS, () => active);
		const other = dom.fire("keydown", { code: "KeyQ" });
		expect(other.stopImmediatePropagation).not.toHaveBeenCalled();
		dom.fire("keydown", { code: "KeyS", metaKey: true });
		dom.fire("keydown", { code: "KeyA", target: { tagName: "INPUT" } });
		active = false;
		const off = dom.fire("keydown", { code: "KeyD" });
		expect(off.preventDefault).not.toHaveBeenCalled();
		expect(input.anyHeld()).toBe(false);
		input.dispose();
	});

	it("still moves while a non-text control (HUD checkbox) has focus", () => {
		const input = createKeyInput(DEFAULT_KEYS, () => true);
		dom.fire("keydown", { code: "KeyW", target: { tagName: "INPUT", type: "checkbox" } });
		expect(input.read().up).toBe(true);
		dom.fire("keydown", { code: "KeyA", target: { tagName: "INPUT", type: "number" } });
		expect(input.read().left).toBe(false);
		input.dispose();
	});

	it("honours custom bindings (multiple codes per direction)", () => {
		const input = createKeyInput({ ...DEFAULT_KEYS, up: ["ArrowUp", "KeyW"] }, () => true);
		dom.fire("keydown", { code: "ArrowUp" });
		expect(input.read().up).toBe(true);
		input.dispose();
	});

	it("clears held keys on blur and when the tab is hidden", () => {
		const input = createKeyInput(DEFAULT_KEYS, () => true);
		dom.fire("keydown", { code: "KeyD" });
		dom.fire("blur");
		expect(input.anyHeld()).toBe(false);
		dom.fire("keydown", { code: "KeyD" });
		dom.document.hidden = true;
		dom.fireDoc("visibilitychange");
		expect(input.anyHeld()).toBe(false);
		input.dispose();
	});

	it("removes every listener on dispose", () => {
		const input = createKeyInput(DEFAULT_KEYS, () => true);
		input.dispose();
		for (const fns of dom.win.values()) expect(fns).toHaveLength(0);
	});
});
