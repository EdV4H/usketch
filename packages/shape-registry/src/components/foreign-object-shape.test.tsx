import { fireEvent, render, screen } from "@testing-library/react";
import type { Shape } from "@usketch/shared-types";
import { describe, expect, it } from "vitest";
import { ForeignObjectShape } from "./foreign-object-shape";

describe("ForeignObjectShape", () => {
	const mockShape: Shape = {
		id: "test-shape-1",
		type: "test",
		x: 100,
		y: 200,
	};

	const mockBounds = {
		x: 100,
		y: 200,
		width: 300,
		height: 150,
	};

	it("renders children inside foreignObject", () => {
		const { container } = render(
			<svg role="img" aria-label="Test SVG">
				<ForeignObjectShape shape={mockShape} bounds={mockBounds}>
					<div data-testid="child-content">Test Content</div>
				</ForeignObjectShape>
			</svg>,
		);

		const foreignObject = container.querySelector("foreignObject");
		expect(foreignObject).toBeInTheDocument();
		expect(foreignObject).toHaveAttribute("x", "100");
		expect(foreignObject).toHaveAttribute("y", "200");
		expect(foreignObject).toHaveAttribute("width", "300");
		expect(foreignObject).toHaveAttribute("height", "150");

		expect(screen.getByTestId("child-content")).toBeInTheDocument();
	});

	it("sets data attributes correctly", () => {
		const { container } = render(
			<svg role="img" aria-label="Test SVG">
				<ForeignObjectShape shape={mockShape} bounds={mockBounds} isSelected={true}>
					<div>Content</div>
				</ForeignObjectShape>
			</svg>,
		);

		const foreignObject = container.querySelector("foreignObject");
		expect(foreignObject).toHaveAttribute("data-shape-id", "test-shape-1");
		expect(foreignObject).toHaveAttribute("data-shape-type", "test");
		expect(foreignObject).toHaveAttribute("data-selected", "true");
	});

	it("defaults isSelected to false", () => {
		const { container } = render(
			<svg role="img" aria-label="Test SVG">
				<ForeignObjectShape shape={mockShape} bounds={mockBounds}>
					<div>Content</div>
				</ForeignObjectShape>
			</svg>,
		);

		const foreignObject = container.querySelector("foreignObject");
		expect(foreignObject).toHaveAttribute("data-selected", "false");
	});

	it("calls onClick when clicking non-interactive elements", () => {
		const handleClick = vi.fn();

		render(
			<svg role="img" aria-label="Test SVG">
				<ForeignObjectShape shape={mockShape} bounds={mockBounds} onClick={handleClick}>
					<div data-testid="clickable">Click me</div>
				</ForeignObjectShape>
			</svg>,
		);

		fireEvent.click(screen.getByTestId("clickable"));
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it("does not call onClick when clicking interactive elements", () => {
		const handleClick = vi.fn();

		render(
			<svg role="img" aria-label="Test SVG">
				<ForeignObjectShape shape={mockShape} bounds={mockBounds} onClick={handleClick}>
					<div>
						<button type="button" data-testid="button">
							Button
						</button>
					</div>
				</ForeignObjectShape>
			</svg>,
		);

		const button = screen.getByTestId("button");
		fireEvent.click(button);

		// Click should be stopped, not propagated to shape selection
		expect(handleClick).not.toHaveBeenCalled();
	});

	it("calls onPointerDown when pointer down on non-interactive elements", () => {
		const handlePointerDown = vi.fn();

		render(
			<svg role="img" aria-label="Test SVG">
				<ForeignObjectShape shape={mockShape} bounds={mockBounds} onPointerDown={handlePointerDown}>
					<div data-testid="draggable">Drag me</div>
				</ForeignObjectShape>
			</svg>,
		);

		fireEvent.pointerDown(screen.getByTestId("draggable"));
		expect(handlePointerDown).toHaveBeenCalledTimes(1);
	});

	it("does not call onPointerDown when pointer down on interactive elements", () => {
		const handlePointerDown = vi.fn();

		render(
			<svg role="img" aria-label="Test SVG">
				<ForeignObjectShape shape={mockShape} bounds={mockBounds} onPointerDown={handlePointerDown}>
					<input data-testid="input" type="text" />
				</ForeignObjectShape>
			</svg>,
		);

		const input = screen.getByTestId("input");
		fireEvent.pointerDown(input);

		// PointerDown should be stopped for interactive elements
		expect(handlePointerDown).not.toHaveBeenCalled();
	});

	it("calls onPointerMove handler", () => {
		const handlePointerMove = vi.fn();

		render(
			<svg role="img" aria-label="Test SVG">
				<ForeignObjectShape shape={mockShape} bounds={mockBounds} onPointerMove={handlePointerMove}>
					<div data-testid="moveable">Move me</div>
				</ForeignObjectShape>
			</svg>,
		);

		fireEvent.pointerMove(screen.getByTestId("moveable"));
		expect(handlePointerMove).toHaveBeenCalledTimes(1);
	});

	it("calls onPointerUp handler", () => {
		const handlePointerUp = vi.fn();

		render(
			<svg role="img" aria-label="Test SVG">
				<ForeignObjectShape shape={mockShape} bounds={mockBounds} onPointerUp={handlePointerUp}>
					<div data-testid="releaseable">Release me</div>
				</ForeignObjectShape>
			</svg>,
		);

		fireEvent.pointerUp(screen.getByTestId("releaseable"));
		expect(handlePointerUp).toHaveBeenCalledTimes(1);
	});

	it("handles keyboard activation with Enter key", () => {
		const handleClick = vi.fn();

		const { container } = render(
			<svg role="img" aria-label="Test SVG">
				<ForeignObjectShape shape={mockShape} bounds={mockBounds} onClick={handleClick}>
					<div>Content</div>
				</ForeignObjectShape>
			</svg>,
		);

		const wrapper = container.querySelector('div[role="button"]');
		expect(wrapper).toBeInTheDocument();

		fireEvent.keyDown(wrapper!, { key: "Enter" });
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it("handles keyboard activation with Space key", () => {
		const handleClick = vi.fn();

		const { container } = render(
			<svg role="img" aria-label="Test SVG">
				<ForeignObjectShape shape={mockShape} bounds={mockBounds} onClick={handleClick}>
					<div>Content</div>
				</ForeignObjectShape>
			</svg>,
		);

		const wrapper = container.querySelector('div[role="button"]');
		fireEvent.keyDown(wrapper!, { key: " " });
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it("is keyboard accessible with tabIndex", () => {
		const { container } = render(
			<svg role="img" aria-label="Test SVG">
				<ForeignObjectShape shape={mockShape} bounds={mockBounds}>
					<div>Content</div>
				</ForeignObjectShape>
			</svg>,
		);

		const wrapper = container.querySelector('div[role="button"]');
		expect(wrapper).toHaveAttribute("tabIndex", "0");
		expect(wrapper).toHaveAttribute("role", "button");
	});
});
