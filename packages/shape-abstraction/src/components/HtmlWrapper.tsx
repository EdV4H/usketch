import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import type { ShapeRenderer } from "../types";

export interface HtmlWrapperProps {
	renderer: ShapeRenderer;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

export const HtmlWrapper: React.FC<HtmlWrapperProps> = ({
	renderer,
	onClick,
	onPointerDown,
	onPointerMove,
	onPointerUp,
}) => {
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const [useForeignObject, _setUseForeignObject] = useState(true);
	const foreignObjectRef = useRef<SVGForeignObjectElement>(null);

	// Create container for portal mode
	useEffect(() => {
		if (!useForeignObject) {
			const div = document.createElement("div");
			div.style.position = "absolute";
			div.style.pointerEvents = "auto";
			div.dataset.shapeId = renderer.shape.id;
			div.dataset.shapeType = renderer.shape.type;
			div.className = "html-shape-container";

			const canvasContainer = document.querySelector(".whiteboard-container");
			if (canvasContainer) {
				canvasContainer.appendChild(div);
				setContainer(div);
			}

			return () => {
				if (div.parentNode) {
					div.parentNode.removeChild(div);
				}
			};
		}
	}, [useForeignObject, renderer.shape.id, renderer.shape.type]);

	// Update position for portal mode
	useEffect(() => {
		if (container && !useForeignObject) {
			const { x, y } = renderer.shape;
			const { camera } = renderer;

			const transformedX = x * camera.zoom + camera.x;
			const transformedY = y * camera.zoom + camera.y;

			container.style.left = `${transformedX}px`;
			container.style.top = `${transformedY}px`;
			container.style.transform = `scale(${camera.zoom})`;
			container.style.transformOrigin = "top left";
			container.style.zIndex = renderer.isSelected ? "1000" : "100";
		}
	}, [
		container,
		renderer.shape.x,
		renderer.shape.y,
		renderer.camera,
		renderer.isSelected,
		useForeignObject,
		renderer,
	]);

	const handlePointerDown = (e: React.PointerEvent) => {
		if (renderer.onPointerDown) {
			renderer.onPointerDown(e);
		}
		if (onPointerDown) {
			onPointerDown(e);
		}
	};

	const handlePointerMove = (e: React.PointerEvent) => {
		if (renderer.onPointerMove) {
			renderer.onPointerMove(e);
		}
		if (onPointerMove) {
			onPointerMove(e);
		}
	};

	const handlePointerUp = (e: React.PointerEvent) => {
		if (renderer.onPointerUp) {
			renderer.onPointerUp(e);
		}
		if (onPointerUp) {
			onPointerUp(e);
		}
	};

	const handleClick = (e: React.MouseEvent) => {
		if (onClick) {
			onClick(e);
		}
	};

	// Render the shape element from the renderer
	const shapeElement = renderer.render();

	// Wrap the element with event handlers
	const wrappedElement = React.isValidElement(shapeElement)
		? React.cloneElement(shapeElement as React.ReactElement<any>, {
				onClick: handleClick,
				onPointerDown: handlePointerDown,
				onPointerMove: handlePointerMove,
				onPointerUp: handlePointerUp,
			})
		: shapeElement;

	// Try foreignObject first (better performance and integration)
	if (useForeignObject) {
		const bounds = renderer.getBounds();

		return (
			<>
				{/* Invisible rect for hit detection */}
				<rect
					x={renderer.shape.x}
					y={renderer.shape.y}
					width={bounds.width}
					height={bounds.height}
					fill="transparent"
					style={{ pointerEvents: "none" }}
					data-shape-id={renderer.shape.id}
					data-shape-type={renderer.shape.type}
				/>
				<foreignObject
					ref={foreignObjectRef}
					x={renderer.shape.x}
					y={renderer.shape.y}
					width={bounds.width}
					height={bounds.height}
					style={{ overflow: "visible" }}
				>
					<div>{wrappedElement}</div>
				</foreignObject>
			</>
		);
	}

	// Fallback to portal mode
	if (container) {
		return (
			<>
				{/* SVG placeholder for hit detection */}
				<rect
					x={renderer.shape.x}
					y={renderer.shape.y}
					width={"width" in renderer.shape ? (renderer.shape.width as number) : 100}
					height={"height" in renderer.shape ? (renderer.shape.height as number) : 100}
					fill="transparent"
					style={{ pointerEvents: "all" }}
					data-shape-id={renderer.shape.id}
					data-shape-type={renderer.shape.type}
					onClick={handleClick}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
				/>
				{/* HTML content via portal */}
				{ReactDOM.createPortal(wrappedElement, container)}
			</>
		);
	}

	return null;
};
