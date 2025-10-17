import { render, screen } from "@testing-library/react";
import type { Camera, Shape } from "@usketch/shared-types";
import { describe, expect, it } from "vitest";
import { ShapeRegistryProvider } from "./context";
import { ShapeRegistry } from "./shape-registry";
import { ShapeRenderer } from "./shape-renderer";
import type { ShapePlugin } from "./types";

describe("ShapeRenderer", () => {
	const mockCamera: Camera = {
		x: 0,
		y: 0,
		zoom: 1,
	};

	const mockRectangleShape: Shape = {
		id: "rect-1",
		type: "rectangle",
		x: 100,
		y: 100,
	};

	const MockRectangleComponent = ({ shape }: { shape: Shape }) => (
		<div data-testid="rectangle-shape" data-shape-id={shape.id}>
			Rectangle: {shape.id}
		</div>
	);

	const rectanglePlugin: ShapePlugin = {
		type: "rectangle",
		name: "Rectangle",
		component: MockRectangleComponent,
		createDefaultShape: (props) => ({
			...props,
			type: "rectangle",
		}),
		getBounds: (shape) => ({
			x: shape.x,
			y: shape.y,
			width: 100,
			height: 100,
		}),
		hitTest: () => true,
	};

	it("renders shape component from registry", () => {
		const registry = new ShapeRegistry();
		registry.register(rectanglePlugin);

		render(
			<ShapeRegistryProvider registry={registry}>
				<ShapeRenderer shape={mockRectangleShape} camera={mockCamera} />
			</ShapeRegistryProvider>,
		);

		expect(screen.getByTestId("rectangle-shape")).toBeInTheDocument();
		expect(screen.getByText("Rectangle: rect-1")).toBeInTheDocument();
	});

	it("renders nothing for unknown shape type", () => {
		const registry = new ShapeRegistry();
		const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const unknownShape: Shape = {
			id: "unknown-1",
			type: "unknown",
			x: 0,
			y: 0,
		};

		const { container } = render(
			<ShapeRegistryProvider registry={registry}>
				<ShapeRenderer shape={unknownShape} camera={mockCamera} />
			</ShapeRegistryProvider>,
		);

		expect(container.firstChild).toBeNull();
		expect(consoleSpy).toHaveBeenCalledWith("Unknown shape type: unknown");

		consoleSpy.mockRestore();
	});

	it("passes props to shape component", () => {
		const registry = new ShapeRegistry();

		const PropsCheckComponent = ({
			shape,
			isSelected,
			onClick,
		}: {
			shape: Shape;
			isSelected?: boolean;
			onClick?: (e: React.MouseEvent) => void;
		}) => (
			<div
				role="button"
				tabIndex={0}
				data-testid="props-check"
				data-selected={isSelected}
				onClick={onClick}
				onKeyDown={(e) => {
					if (e.key === "Enter" && onClick) {
						onClick(e as any);
					}
				}}
			>
				{shape.id}
			</div>
		);

		const plugin: ShapePlugin = {
			type: "test",
			component: PropsCheckComponent,
			createDefaultShape: (props) => ({ ...props, type: "test" }),
			getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
			hitTest: () => true,
		};

		registry.register(plugin);

		const handleClick = vi.fn();

		render(
			<ShapeRegistryProvider registry={registry}>
				<ShapeRenderer
					shape={{ id: "test-1", type: "test", x: 0, y: 0 }}
					camera={mockCamera}
					isSelected={true}
					onClick={handleClick}
				/>
			</ShapeRegistryProvider>,
		);

		const element = screen.getByTestId("props-check");
		expect(element).toBeInTheDocument();
		expect(element.dataset.selected).toBe("true");

		element.click();
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it("defaults isSelected to false when not provided", () => {
		const registry = new ShapeRegistry();

		const SelectedCheckComponent = ({
			shape,
			isSelected,
		}: {
			shape: Shape;
			isSelected?: boolean;
		}) => (
			<div data-testid="selected-check" data-selected={isSelected}>
				{shape.id}
			</div>
		);

		const plugin: ShapePlugin = {
			type: "test",
			component: SelectedCheckComponent,
			createDefaultShape: (props) => ({ ...props, type: "test" }),
			getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
			hitTest: () => true,
		};

		registry.register(plugin);

		render(
			<ShapeRegistryProvider registry={registry}>
				<ShapeRenderer shape={{ id: "test-1", type: "test", x: 0, y: 0 }} camera={mockCamera} />
			</ShapeRegistryProvider>,
		);

		const element = screen.getByTestId("selected-check");
		expect(element.dataset.selected).toBe("false");
	});
});
