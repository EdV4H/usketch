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
		doc,
		fire,
		document,
		fireDoc: (t: string, init: Record<string, unknown> = {}) => {
			for (const f of doc.get(t) ?? []) f(init);
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
		expect(input.read()).toEqual({
			up: true,
			down: false,
			left: false,
			right: false,
			drift: false,
			jump: false,
			jumpPressed: false,
		});
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

	it("captures the drift key only while drift is active", () => {
		let driftOn = false;
		const input = createKeyInput(
			DEFAULT_KEYS,
			() => true,
			() => driftOn,
		);
		const ignored = dom.fire("keydown", { code: "Space" });
		expect(input.read().drift).toBe(false);
		expect(ignored.preventDefault).not.toHaveBeenCalled();
		driftOn = true;
		const taken = dom.fire("keydown", { code: "Space" });
		expect(input.read().drift).toBe(true);
		expect(taken.preventDefault).toHaveBeenCalled();
		dom.fire("keyup", { code: "Space" });
		expect(input.read().drift).toBe(false);
		input.dispose();
	});

	it("leaves Space to a focused button or checkbox", () => {
		const input = createKeyInput(
			DEFAULT_KEYS,
			() => true,
			() => true,
		);
		const e = dom.fire("keydown", {
			code: "Space",
			target: { tagName: "INPUT", type: "checkbox" },
		});
		expect(input.read().drift).toBe(false);
		expect(e.preventDefault).not.toHaveBeenCalled();
		dom.fire("keydown", { code: "Space", target: { tagName: "BUTTON" } });
		expect(input.read().drift).toBe(false);
		input.dispose();
	});

	it("reports a jump press once (a tap between frames counts) and the held state", () => {
		let jumpOn = false;
		const input = createKeyInput(
			DEFAULT_KEYS,
			() => true,
			() => false,
			() => jumpOn,
		);
		const ignored = dom.fire("keydown", { code: "Space" });
		expect(input.read()).toMatchObject({ jump: false, jumpPressed: false });
		expect(ignored.preventDefault).not.toHaveBeenCalled();
		dom.fire("keyup", { code: "Space" });

		jumpOn = true;
		// Tap: pressed and released before the next frame reads.
		const taken = dom.fire("keydown", { code: "Space" });
		dom.fire("keyup", { code: "Space" });
		expect(taken.preventDefault).toHaveBeenCalled();
		expect(input.read()).toMatchObject({ jump: false, jumpPressed: true });
		expect(input.read().jumpPressed).toBe(false);

		// Hold: auto-repeat is not a new press.
		dom.fire("keydown", { code: "Space" });
		expect(input.read()).toMatchObject({ jump: true, jumpPressed: true });
		dom.fire("keydown", { code: "Space", repeat: true });
		expect(input.read()).toMatchObject({ jump: true, jumpPressed: false });
		input.dispose();
	});

	it("lets an active drift win a key it shares with the jump", () => {
		const input = createKeyInput(
			DEFAULT_KEYS,
			() => true,
			() => true,
			() => true,
		);
		dom.fire("keydown", { code: "Space" });
		expect(input.read()).toMatchObject({ drift: true, jump: false, jumpPressed: false });
		input.dispose();
	});

	it("leaves Space to a focused button for the jump too", () => {
		const input = createKeyInput(
			DEFAULT_KEYS,
			() => true,
			() => false,
			() => true,
		);
		const e = dom.fire("keydown", { code: "Space", target: { tagName: "BUTTON" } });
		expect(input.read()).toMatchObject({ jump: false, jumpPressed: false });
		expect(e.preventDefault).not.toHaveBeenCalled();
		input.dispose();
	});

	it("keeps the drift key when movement keys are rebound", () => {
		const input = createKeyInput(
			DEFAULT_KEYS,
			() => true,
			() => true,
		);
		input.setKeys({
			up: ["ArrowUp"],
			down: ["ArrowDown"],
			left: ["ArrowLeft"],
			right: ["ArrowRight"],
		});
		dom.fire("keydown", { code: "Space" });
		expect(input.read().drift).toBe(true);
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

	/** A fake element: `role`, `matches` by role / tag, and an optional parent. */
	const el = (
		tagName: string,
		opts: { role?: string; type?: string; parent?: object; board?: boolean } = {},
	) => ({
		tagName,
		type: opts.type,
		parentElement: opts.parent ?? null,
		getAttribute: (n: string) => (n === "role" ? (opts.role ?? null) : null),
		matches: (sel: string) =>
			(opts.role !== undefined && sel.includes(`[role="${opts.role}"]`)) ||
			sel.split(", ").includes(tagName.toLowerCase()),
		querySelector: () => (opts.board ? {} : null),
	});

	it("leaves every key to an open dialog or menu", () => {
		const input = createKeyInput(
			DEFAULT_KEYS,
			() => true,
			() => true,
		);
		const inDialog = el("DIV", { parent: el("DIV", { role: "dialog" }) });
		const inMenu = el("DIV", { role: "menuitem", parent: el("DIV", { role: "menu" }) });
		for (const target of [inDialog, inMenu]) {
			for (const code of ["KeyW", "ArrowLeft", "Space"]) {
				const e = dom.fire("keydown", { code, target });
				expect(e.preventDefault).not.toHaveBeenCalled();
			}
		}
		expect(input.anyHeld()).toBe(false);
		input.dispose();
	});

	it("still drives when the host shows the board itself inside a dialog", () => {
		const input = createKeyInput(DEFAULT_KEYS, () => true);
		const onBoard = el("DIV", { parent: el("DIALOG", { board: true }) });
		dom.fire("keydown", { code: "KeyW", target: onBoard });
		expect(input.read().up).toBe(true);
		input.dispose();
	});

	it("sees through shadow DOM via composedPath", () => {
		const input = createKeyInput(DEFAULT_KEYS, () => true);
		const inner = el("DIV", { role: "dialog" });
		const host = el("SL-DIALOG");
		const e = dom.fire("keydown", {
			code: "KeyW",
			target: host,
			composedPath: () => [inner, host],
		});
		expect(e.preventDefault).not.toHaveBeenCalled();
		expect(input.anyHeld()).toBe(false);
		input.dispose();
	});

	it("leaves arrow keys (only) to a focused slider, radio, tab or menubar item", () => {
		const input = createKeyInput({ ...DEFAULT_KEYS, left: ["KeyA", "ArrowLeft"] }, () => true);
		const slider = el("DIV", { role: "slider" });
		const arrow = dom.fire("keydown", { code: "ArrowLeft", target: slider });
		expect(arrow.preventDefault).not.toHaveBeenCalled();
		expect(input.read().left).toBe(false);
		dom.fire("keydown", { code: "ArrowLeft", target: el("INPUT", { type: "range" }) });
		expect(input.read().left).toBe(false);
		dom.fire("keydown", { code: "KeyA", target: slider });
		expect(input.read().left).toBe(true);
		dom.fire("keyup", { code: "KeyA" });
		const barItem = el("DIV", { role: "menuitem", parent: el("DIV", { role: "menubar" }) });
		dom.fire("keydown", { code: "KeyA", target: barItem });
		expect(input.read().left).toBe(true);
		input.dispose();
	});

	it("treats a numpad key that acts as an arrow like an arrow", () => {
		const input = createKeyInput({ ...DEFAULT_KEYS, left: ["Numpad4"] }, () => true);
		const e = dom.fire("keydown", {
			code: "Numpad4",
			key: "ArrowLeft",
			target: el("DIV", { role: "slider" }),
		});
		expect(e.preventDefault).not.toHaveBeenCalled();
		dom.fire("keydown", { code: "Numpad4", key: "4", target: el("DIV", { role: "slider" }) });
		expect(input.read().left).toBe(true);
		input.dispose();
	});

	it("releases held keys the newly focused target uses", () => {
		const input = createKeyInput(
			{ ...DEFAULT_KEYS, left: ["KeyA", "ArrowLeft"] },
			() => true,
			() => true,
		);
		dom.fire("keydown", { code: "KeyW" });
		dom.fire("keydown", { code: "ArrowLeft" });
		dom.fire("keydown", { code: "Space" });
		// A button takes Space (activated on keyup), nothing else.
		dom.fireDoc("focusin", { target: el("BUTTON") });
		expect(input.read()).toMatchObject({ up: true, left: true, drift: false });
		const spaceUp = dom.fire("keyup", { code: "Space" });
		expect(spaceUp.preventDefault).not.toHaveBeenCalled();
		// A radio takes the arrows; WASD keeps driving.
		dom.fireDoc("focusin", { target: el("INPUT", { type: "radio" }) });
		expect(input.read()).toMatchObject({ up: true, left: false });
		// A text field or dialog takes everything.
		dom.fireDoc("focusin", { target: el("TEXTAREA") });
		expect(input.anyHeld()).toBe(false);
		input.dispose();
	});

	it("removes every listener on dispose", () => {
		const input = createKeyInput(DEFAULT_KEYS, () => true);
		input.dispose();
		for (const fns of dom.win.values()) expect(fns).toHaveLength(0);
		for (const fns of dom.doc.values()) expect(fns).toHaveLength(0);
	});
});
