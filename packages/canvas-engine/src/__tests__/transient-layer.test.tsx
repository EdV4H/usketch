// @vitest-environment jsdom
import { createTransientRegistry } from "@edv4h/usketch-core";
import type { LayerRenderContext, TransientObject } from "@edv4h/usketch-shared";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TransientLayer } from "../components/transient-layer.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cursor = (id: string, x: number, name = id): TransientObject => ({
	id,
	type: "cursor",
	sourceUserId: id,
	position: { x, y: 0 },
	data: { name },
	createdAt: Date.now(),
});

describe("TransientLayer", () => {
	let el: HTMLDivElement;
	let root: Root;
	let renders: string[];
	const ctx = { viewport: { x: 0, y: 0, zoom: 1 } } as unknown as LayerRenderContext;

	beforeEach(() => {
		el = document.createElement("div");
		document.body.appendChild(el);
		root = createRoot(el);
		renders = [];
	});

	afterEach(() => {
		act(() => root.unmount());
		el.remove();
	});

	function setup() {
		const registry = createTransientRegistry();
		registry.registerType("cursor", {
			render: (obj) => {
				renders.push(obj.id);
				return <span>{obj.data.name as string}</span>;
			},
		});
		for (const id of ["a", "b", "c"]) registry.emit(cursor(id, 0));
		return registry;
	}

	it("re-renders only the emitted object", () => {
		const registry = setup();
		act(() => root.render(<TransientLayer registry={registry} ctx={ctx} />));
		renders = [];

		act(() => registry.emit(cursor("b", 50, "moved")));

		expect(renders).toEqual(["b"]);
		const items = el.querySelectorAll<HTMLDivElement>("[data-layer='transient'] > div");
		expect([...items].map((d) => d.textContent)).toEqual(["a", "moved", "c"]);
		expect(items[1].style.left).toBe("50px");
	});

	it("dismiss removes the object without re-rendering the others", () => {
		const registry = setup();
		act(() => root.render(<TransientLayer registry={registry} ctx={ctx} />));
		renders = [];

		act(() => registry.dismiss("a"));

		expect(renders).toEqual([]);
		expect(el.textContent).toBe("bc");
	});

	it("re-renders every object when the render context changes", () => {
		const registry = setup();
		act(() => root.render(<TransientLayer registry={registry} ctx={ctx} />));
		renders = [];

		const next = { viewport: { x: 10, y: 0, zoom: 1 } } as unknown as LayerRenderContext;
		act(() => root.render(<TransientLayer registry={registry} ctx={next} />));

		expect(renders.sort()).toEqual(["a", "b", "c"]);
	});

	it("re-renders an object when its type's renderer is replaced", () => {
		const registry = setup();
		act(() => root.render(<TransientLayer registry={registry} ctx={ctx} />));

		registry.registerType("cursor", { render: (obj) => <b>{`new-${obj.id}`}</b> });
		act(() => registry.emit(cursor("d", 0)));

		expect(el.textContent).toBe("new-anew-bnew-cnew-d");
	});
});
