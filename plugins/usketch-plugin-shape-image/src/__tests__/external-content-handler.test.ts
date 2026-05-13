import type {
	BoardStore,
	CommandRegistry,
	EventBus,
	ExternalContentFile,
	ExternalContentHandlerCtx,
	ExternalContentRegistry,
	ShapeData,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createImageFileHandler } from "../external-content-handler.js";

vi.mock("../image-utils.js", () => ({
	validateImage: (file: File, max: number) =>
		file.size <= max * 1024 * 1024 && file.type.startsWith("image/")
			? { valid: true }
			: { valid: false, error: "bad" },
	fileToBase64: async () => "data:image/png;base64,AAA",
	resizeImage: async (url: string) => url,
	getImageDimensions: async () => ({ width: 100, height: 50 }),
}));

function makeCtx(): {
	ctx: ExternalContentHandlerCtx;
	addShape: ReturnType<typeof vi.fn>;
	execute: ReturnType<typeof vi.fn>;
	setSelection: ReturnType<typeof vi.fn>;
	events: { emit: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };
} {
	const addShape = vi.fn();
	const execute = vi.fn((cmd: { execute: () => void }) => cmd.execute());
	const setSelection = vi.fn();
	const events = {
		emit: vi.fn(),
		on: vi.fn(() => () => undefined),
	} as unknown as EventBus & {
		emit: ReturnType<typeof vi.fn>;
		on: ReturnType<typeof vi.fn>;
	};
	const store = {
		addShape: addShape as (shape: ShapeData) => void,
		deleteShape: vi.fn(),
		setSelection,
	} as unknown as BoardStore;
	const commands = { execute } as unknown as CommandRegistry;
	const registry = {} as ExternalContentRegistry;
	return {
		ctx: {
			store,
			shapes: {} as ShapeRegistry,
			commands,
			events,
			externalContent: registry,
		},
		addShape,
		execute,
		setSelection,
		events: events as unknown as {
			emit: ReturnType<typeof vi.fn>;
			on: ReturnType<typeof vi.fn>;
		},
	};
}

function imageFile(name = "x.png", type = "image/png", size = 100): File {
	return new File([new Uint8Array(size)], name, { type });
}

function fileContent(files: File[]): ExternalContentFile {
	return { kind: "file", via: "drop", files };
}

describe("createImageFileHandler", () => {
	it("matches only when every file is an image", () => {
		const h = createImageFileHandler();
		const { ctx } = makeCtx();

		expect(h.match(fileContent([imageFile()]), ctx)).toBe(true);
		expect(h.match(fileContent([imageFile(), imageFile()]), ctx)).toBe(true);
		expect(
			h.match(
				fileContent([imageFile(), new File(["x"], "doc.pdf", { type: "application/pdf" })]),
				ctx,
			),
		).toBe(false);
		expect(h.match(fileContent([]), ctx)).toBe(false);
	});

	it("placeImageShape executes a command and selects the new shape", async () => {
		const h = createImageFileHandler();
		const { ctx, addShape, execute, setSelection } = makeCtx();
		await h.handle(fileContent([imageFile()]), ctx);
		expect(execute).toHaveBeenCalledTimes(1);
		expect(addShape).toHaveBeenCalledTimes(1);
		expect(setSelection).toHaveBeenCalledTimes(1);
		const shape = addShape.mock.calls[0]?.[0] as ShapeData;
		expect(shape.type).toBe("image");
	});

	it("uses configured `order` default of 0", () => {
		const h = createImageFileHandler();
		expect(h.order).toBe(0);
	});

	it("`order` option is propagated", () => {
		const h = createImageFileHandler({ order: 5 });
		expect(h.order).toBe(5);
	});
});
