// @vitest-environment jsdom
import type { ShapeData } from "@edv4h/usketch-shared";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crossRender3d, type Shape3dRenderContext } from "../shape-3d-render3d.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const shape = (id: string): ShapeData =>
	({ id, type: "rect", x: 0, y: 0, width: 40, height: 20, style: {} }) as unknown as ShapeData;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
	host = document.createElement("div");
	document.body.appendChild(host);
	root = createRoot(host);
});
afterEach(() => {
	act(() => root.unmount());
	host.remove();
});

describe("crossRender3d", () => {
	it("crossRender3d stands two crossed planes, and leaves other modes generic", () => {
		const ctx = {
			params: { mode: "stand" },
			amount: 0.5,
			content: <b data-content="" />,
		} as unknown as Shape3dRenderContext;
		act(() => root.render(crossRender3d(shape("a"), ctx)));
		const planes = [...host.querySelectorAll<HTMLElement>("[data-shape-3d-plane]")];
		expect(planes.map((p) => p.style.transform)).toEqual([
			"rotateZ(0deg) rotateX(-45deg)",
			"rotateZ(45deg) rotateX(-45deg)",
		]);
		expect(host.querySelectorAll("[data-content]").length).toBe(2);
		expect(
			crossRender3d(shape("a"), { ...ctx, params: { mode: "box" } } as Shape3dRenderContext),
		).toBeNull();
	});
});
