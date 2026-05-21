import { describe, expect, it } from "vitest";
import { sanitizeLangSource } from "../sanitize.js";

describe("sanitizeLangSource", () => {
	it("returns empty string for blank input", () => {
		expect(sanitizeLangSource("")).toBe("");
		expect(sanitizeLangSource("   \n  ")).toBe("");
	});

	it("strips a leading ```openui-lang fence", () => {
		const input = '```openui-lang\nroot = Stack({direction: "column"})\n```';
		expect(sanitizeLangSource(input)).toBe('root = Stack({direction: "column"})');
	});

	it("strips a leading ``` fence with no language tag", () => {
		const input = "```\nroot = Stack()\n```";
		expect(sanitizeLangSource(input)).toBe("root = Stack()");
	});

	it("strips a leading ```ts fence (some models pick the wrong tag)", () => {
		const input = "```ts\nroot = Stack()\n```";
		expect(sanitizeLangSource(input)).toBe("root = Stack()");
	});

	it("leaves clean lang source untouched", () => {
		const input = 'root = Stack({direction: "column"})\nchild = Button({label: "OK"})';
		expect(sanitizeLangSource(input)).toBe(input);
	});

	it("strips a leading prose preface line ending with a colon", () => {
		const input = "Here is the UI:\nroot = Stack()";
		expect(sanitizeLangSource(input)).toBe("root = Stack()");
	});

	it("does NOT strip a first line that looks like an assignment", () => {
		const input = 'root = Stack()\nchild = Button({label: "OK"})';
		expect(sanitizeLangSource(input)).toBe(input);
	});

	it("strips a leading comment-style preface", () => {
		const input = "// Generated UI\nroot = Stack()";
		expect(sanitizeLangSource(input)).toBe("root = Stack()");
	});
});
