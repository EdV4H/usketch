import type { Command, CommandRegistry } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { createImageApi, setImageFit, setImageResizeMode } from "../image-service.js";
import type { ImageShapeData } from "../types.js";

function image(id: string, extra: Partial<ImageShapeData> = {}): ImageShapeData {
	return {
		id,
		type: "image",
		x: 0,
		y: 0,
		width: 300,
		height: 100,
		style: { fill: "#f5f5f5", stroke: "#e0e0e0", strokeWidth: 1, opacity: 1 },
		src: "",
		...extra,
	};
}

function setup() {
	const store = createBoardStore();
	store.addShape(image("a"));
	store.addShape(image("b", { aspectRatio: 1.5, resizeMode: "free" }));
	store.addShape({ ...image("r"), type: "rect" });
	const get = (id: string) => store.getShape(id) as ImageShapeData;
	return { store, get };
}

describe("setImageResizeMode", () => {
	it("switches images only, keeping their size", () => {
		const { store, get } = setup();
		setImageResizeMode(store, ["a", "b", "r"], "free")?.execute();
		expect(get("a").resizeMode).toBe("free");
		expect(get("a").width).toBe(300);
		expect((store.getShape("r") as ImageShapeData).resizeMode).toBeUndefined();
	});

	it("locks the current box ratio when switching to keep-aspect without a stored one", () => {
		const { store, get } = setup();
		setImageResizeMode(store, ["a", "b"], "keep-aspect")?.execute();
		expect(get("a").aspectRatio).toBe(3);
		expect(get("b").aspectRatio).toBe(1.5);
		expect(get("b").width).toBe(300);
	});

	it("undoes in one step", () => {
		const { store, get } = setup();
		const cmd = setImageResizeMode(store, ["a", "b"], "keep-aspect");
		cmd?.execute();
		cmd?.undo();
		expect(get("a").resizeMode).toBeUndefined();
		expect(get("a").aspectRatio).toBeUndefined();
		expect(get("b").resizeMode).toBe("free");
	});

	it("returns null when nothing changes", () => {
		const { store } = setup();
		expect(setImageResizeMode(store, ["b", "r"], "free")).toBeNull();
	});
});

describe("setImageFit", () => {
	it("sets the fit on images", () => {
		const { store, get } = setup();
		setImageFit(store, ["a"], "cover")?.execute();
		expect(get("a").fit).toBe("cover");
	});
});

describe("createImageApi", () => {
	it("acts on the selection through the command registry", () => {
		const { store, get } = setup();
		const executed: Command[] = [];
		const commands = {
			execute: (c: Command) => {
				executed.push(c);
				c.execute();
			},
		} as unknown as CommandRegistry;
		store.setSelection(["a"]);
		createImageApi(store, commands).setFit("fill");
		expect(get("a").fit).toBe("fill");
		expect(executed).toHaveLength(1);
	});
});
