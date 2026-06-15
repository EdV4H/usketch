import { describe, expect, it } from "vitest";
import { anchorTranslate, faceTextureStyle } from "../card-face.js";

describe("faceTextureStyle", () => {
	it("returns empty style for no texture", () => {
		expect(faceTextureStyle(undefined)).toEqual({});
	});

	it("applies a background color / gradient", () => {
		expect(faceTextureStyle({ color: "red" }).background).toBe("red");
	});

	it("uses cover by default and contain/fill/tile when set", () => {
		expect(faceTextureStyle({ image: "a.png" }).backgroundSize).toBe("cover");
		expect(faceTextureStyle({ image: "a.png", fit: "contain" }).backgroundSize).toBe("contain");
		expect(faceTextureStyle({ image: "a.png", fit: "fill" }).backgroundSize).toBe("100% 100%");
		expect(faceTextureStyle({ image: "a.png", fit: "tile" }).backgroundRepeat).toBe("repeat");
	});

	it("wraps the image url", () => {
		expect(faceTextureStyle({ image: "a.png" }).backgroundImage).toBe('url("a.png")');
	});
});

describe("anchorTranslate", () => {
	it("defaults to center/middle", () => {
		expect(anchorTranslate()).toEqual({ tx: "-50%", ty: "-50%" });
	});

	it("maps left/top to 0% and right/bottom to -100%", () => {
		expect(anchorTranslate("left", "top")).toEqual({ tx: "0%", ty: "0%" });
		expect(anchorTranslate("right", "bottom")).toEqual({ tx: "-100%", ty: "-100%" });
	});
});
