import { describe, expect, it, vi } from "vitest";
import {
	clickElement,
	createMockElement,
	createMockMouseEvent,
	dragElement,
	mockElementDimensions,
	waitForElement,
} from "../dom-helpers";

describe("DOM Helpers", () => {
	describe("createMockElement", () => {
		it("should create an element with specified tag", () => {
			const div = createMockElement("div");
			expect(div.tagName).toBe("DIV");
		});

		it("should set attributes on the element", () => {
			const button = createMockElement("button", {
				id: "test-button",
				class: "btn btn-primary",
				"data-testid": "mock-button",
			});

			expect(button.id).toBe("test-button");
			expect(button.className).toBe("btn btn-primary");
			expect(button.getAttribute("data-testid")).toBe("mock-button");
		});
	});

	describe("createMockMouseEvent", () => {
		it("should create a mouse event with default properties", () => {
			const event = createMockMouseEvent("click");

			expect(event.type).toBe("click");
			expect(event.bubbles).toBe(true);
			expect(event.cancelable).toBe(true);
			expect(event.clientX).toBe(0);
			expect(event.clientY).toBe(0);
		});

		it("should override default properties", () => {
			const event = createMockMouseEvent("mousedown", {
				clientX: 100,
				clientY: 200,
				ctrlKey: true,
			});

			expect(event.clientX).toBe(100);
			expect(event.clientY).toBe(200);
			expect(event.ctrlKey).toBe(true);
		});
	});

	describe("clickElement", () => {
		it("should dispatch click event at specified coordinates", () => {
			const element = createMockElement("div");
			const spy = vi.fn();
			element.addEventListener("click", spy);

			// Mock getBoundingClientRect
			vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
				left: 10,
				top: 20,
				width: 100,
				height: 50,
				right: 110,
				bottom: 70,
				x: 10,
				y: 20,
				toJSON: () => ({}),
			});

			clickElement(element, 30, 25);

			expect(spy).toHaveBeenCalled();
			const event = spy.mock.calls[0]?.[0];
			expect(event?.clientX).toBe(40); // 10 + 30
			expect(event?.clientY).toBe(45); // 20 + 25
		});
	});

	describe("dragElement", () => {
		it("should dispatch mouse events for drag operation", () => {
			const element = createMockElement("div");
			const mouseDownSpy = vi.fn();
			const mouseMoveSpy = vi.fn();
			const mouseUpSpy = vi.fn();

			element.addEventListener("mousedown", mouseDownSpy);
			element.addEventListener("mousemove", mouseMoveSpy);
			element.addEventListener("mouseup", mouseUpSpy);

			vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
				left: 0,
				top: 0,
				width: 100,
				height: 100,
				right: 100,
				bottom: 100,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			});

			dragElement(element, 10, 10, 50, 50);

			expect(mouseDownSpy).toHaveBeenCalled();
			expect(mouseMoveSpy).toHaveBeenCalled();
			expect(mouseUpSpy).toHaveBeenCalled();
		});
	});

	describe("waitForElement", () => {
		it("should resolve when element appears", async () => {
			setTimeout(() => {
				const div = createMockElement("div", { class: "target" });
				document.body.appendChild(div);
			}, 100);

			const element = await waitForElement(".target");
			expect(element).toBeTruthy();
			expect(element.className).toBe("target");
		});

		it("should timeout if element does not appear", async () => {
			await expect(waitForElement(".non-existent", 100)).rejects.toThrowError(
				new Error('Element with selector ".non-existent" not found within 100ms'),
			);
		});
	});

	describe("mockElementDimensions", () => {
		it("should mock getBoundingClientRect", () => {
			const element = createMockElement("div");
			mockElementDimensions(element, {
				width: 200,
				height: 150,
				x: 50,
				y: 75,
			});

			const rect = element.getBoundingClientRect();
			expect(rect.width).toBe(200);
			expect(rect.height).toBe(150);
			expect(rect.x).toBe(50);
			expect(rect.y).toBe(75);
			expect(rect.right).toBe(250);
			expect(rect.bottom).toBe(225);
		});
	});
});
