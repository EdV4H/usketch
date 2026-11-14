// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { flatShapeHeight } from "../gpu3d-shapes.js";
import { MAX_PICTURE_PX, nodePictureSvg, PICTURE_PAD, pictureScale } from "../shape-raster.js";

describe("pictureScale", () => {
	it("is twice the screen's px, as a power of two between 1/4 and 4", () => {
		expect(pictureScale(1, 1, 100, 100)).toBe(2);
		expect(pictureScale(0.8, 1, 100, 100)).toBe(2);
		expect(pictureScale(0.3, 1, 100, 100)).toBe(1);
		expect(pictureScale(5, 2, 100, 100)).toBe(4);
		expect(pictureScale(0.01, 1, 100, 100)).toBe(0.25);
		expect(pictureScale(Number.NaN, 0, 100, 100)).toBe(2);
	});

	it("keeps a big shape's picture within the size limit", () => {
		const s = pictureScale(2, 2, 3000, 100);
		expect((3000 + 2 * PICTURE_PAD) * s).toBeLessThanOrEqual(MAX_PICTURE_PX);
		expect(s).toBe(0.5);
	});
});

describe("flatShapeHeight", () => {
	it("is the ground under the shape's centre, never below 0", () => {
		const box = { x: 0, y: 0, width: 100, height: 40 };
		expect(flatShapeHeight(box, (x, y) => (x === 50 && y === 20 ? 30 : 99))).toBe(30);
		expect(flatShapeHeight(box, () => -5)).toBe(0);
		expect(flatShapeHeight(box, () => Number.NaN)).toBe(0);
	});
});

describe("nodePictureSvg", () => {
	it("copies the node with its styles into a padded foreignObject, unplaced and visible", () => {
		const host = document.createElement("div");
		host.style.visibility = "hidden";
		const node = document.createElement("div");
		node.setAttribute("data-shape-id", "a");
		node.style.position = "absolute";
		node.style.left = "300px";
		node.style.transform = "rotate(30deg)";
		node.innerHTML = '<span style="color: red">Hi</span><img src="https://example.com/x.png">';
		host.appendChild(node);
		document.body.appendChild(host);
		const svg = nodePictureSvg(node, 100, 50, 2);
		host.remove();
		const w = (100 + 2 * PICTURE_PAD) * 2;
		const h = (50 + 2 * PICTURE_PAD) * 2;
		expect(svg).toContain(`width="${w}" height="${h}"`);
		expect(svg).toContain("<foreignObject");
		expect(svg).toContain("Hi");
		expect(svg).toMatch(/color:\s*(red|rgb\(255, 0, 0\))/);
		expect(svg).toContain(`padding:${PICTURE_PAD}px`);
		expect(svg).toContain("transform:scale(2)");
		expect(svg).toMatch(/left:\s*0px/);
		expect(svg).toMatch(/transform:\s*none/);
		expect(svg).not.toMatch(/[;"\s]visibility:/);
		expect(svg).not.toContain("<img");
		// The live node is left as it was.
		expect(node.style.left).toBe("300px");
	});
});
