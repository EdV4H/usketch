import type React from "react";
import { useEffect, useRef, useState } from "react";
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
	// Use foreignObject mode by default for better coordinate alignment
	const [useForeignObject, _setUseForeignObject] = useState(true);
	const foreignObjectRef = useRef<SVGForeignObjectElement>(null);

	// Create container for portal mode
	useEffect(() => {
		if (!useForeignObject) {
			// Use a small delay to ensure DOM is ready
			const timer = setTimeout(() => {
				const div = document.createElement("div");
				div.style.position = "absolute";
				div.style.pointerEvents = "auto";
				div.dataset.shapeId = renderer.shape.id;
				div.dataset.shapeType = renderer.shape.type;
				div.className = "html-shape-container";

				// Find the HTML shapes layer that has the proper camera transform
				const canvasContainer =
					document.querySelector(".html-shapes-layer") ||
					document.querySelector(".whiteboard-canvas") ||
					document.querySelector(".whiteboard-container") ||
					document.body;

				console.log(
					"[HtmlWrapper] Container search result:",
					canvasContainer?.className || canvasContainer?.tagName,
				);

				if (canvasContainer) {
					canvasContainer.appendChild(div);
					setContainer(div);
					console.log(
						`[HtmlWrapper] Created HTML container for shape ${renderer.shape.type}#${renderer.shape.id}`,
					);
				} else {
					console.error("[HtmlWrapper] No container found for HTML shape");
				}
			}, 100); // Small delay to ensure DOM is ready

			return () => {
				clearTimeout(timer);
				// Don't use the state container variable here as it might be stale
				// Find and remove by class and data attributes
				const divToRemove = document.querySelector(
					`.html-shape-container[data-shape-id="${renderer.shape.id}"]`,
				);
				if (divToRemove?.parentNode) {
					divToRemove.parentNode.removeChild(divToRemove);
				}
			};
		}
	}, [useForeignObject, renderer.shape.id, renderer.shape.type]);

	// Update position for portal mode
	useEffect(() => {
		if (container && !useForeignObject) {
			const { x, y } = renderer.shape;
			const { camera } = renderer;

			// If we're in the html-shapes-layer, the parent already has the camera transform
			// So we just need to position at shape coordinates
			const parentHasTransform = container.parentElement?.classList.contains("html-shapes-layer");

			if (parentHasTransform) {
				// Parent already has camera transform, just position at shape coordinates
				container.style.left = `${x}px`;
				container.style.top = `${y}px`;
				container.style.transform = "";
			} else {
				// Apply camera transform ourselves if not in transformed parent
				container.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
				container.style.transformOrigin = "0 0";
				container.style.left = `${x}px`;
				container.style.top = `${y}px`;
			}

			container.style.zIndex = renderer.isSelected ? "1000" : "100";
			container.style.pointerEvents = "auto";

			console.log(
				`[HtmlWrapper] Position update for ${renderer.shape.type}: x=${x}, y=${y}, parentTransform=${parentHasTransform}`,
			);
		}
	}, [container, renderer.shape, renderer.camera, renderer.isSelected, useForeignObject, renderer]);

	const handlePointerDown = (e: React.PointerEvent) => {
		// Check if the pointer down is on an interactive element
		const target = e.target as HTMLElement;
		const isInteractiveElement =
			target.tagName === "BUTTON" ||
			target.tagName === "INPUT" ||
			target.tagName === "TEXTAREA" ||
			target.tagName === "SELECT" ||
			target.tagName === "A" ||
			target.closest("button") !== null ||
			target.closest("input") !== null ||
			target.closest("textarea") !== null ||
			target.closest("select") !== null;

		// If clicking on an interactive element, prevent dragging
		if (isInteractiveElement) {
			e.stopPropagation();
			// Still allow the renderer to handle it if needed
			if (renderer.onPointerDown) {
				renderer.onPointerDown(e);
			}
		} else {
			// For non-interactive areas, allow both renderer handling and shape dragging
			if (renderer.onPointerDown) {
				renderer.onPointerDown(e);
			}
			if (onPointerDown) {
				onPointerDown(e);
			}
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
		// Check if the click is on an interactive element (button, input, etc.)
		const target = e.target as HTMLElement;
		const isInteractiveElement =
			target.tagName === "BUTTON" ||
			target.tagName === "INPUT" ||
			target.tagName === "TEXTAREA" ||
			target.tagName === "SELECT" ||
			target.tagName === "A" ||
			target.closest("button") !== null ||
			target.closest("input") !== null ||
			target.closest("textarea") !== null ||
			target.closest("select") !== null ||
			target.closest("a") !== null;

		// If clicking on an interactive element, don't trigger shape selection
		if (isInteractiveElement) {
			e.stopPropagation();
		} else if (onClick) {
			// For non-interactive areas, allow shape selection
			onClick(e);
		}
	};

	// Render the shape element from the renderer
	console.log(`[HtmlWrapper] Rendering shape ${renderer.shape.type}#${renderer.shape.id}`);
	const shapeElement = renderer.render();
	console.log(`[HtmlWrapper] Shape element:`, shapeElement);

	// Try foreignObject first (better performance and integration)
	if (useForeignObject) {
		const bounds = renderer.getBounds();

		return (
			<foreignObject
				ref={foreignObjectRef}
				x={bounds.x}
				y={bounds.y}
				width={bounds.width}
				height={bounds.height}
				style={{ overflow: "visible", pointerEvents: "all" }}
				data-shape-id={renderer.shape.id}
				data-shape-type={renderer.shape.type}
			>
				<div
					role="button"
					tabIndex={0}
					style={{
						width: "100%",
						height: "100%",
						position: "relative",
					}}
					onClick={handleClick}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							const syntheticEvent = {
								...e,
								button: 0,
								buttons: 1,
								clientX: 0,
								clientY: 0,
								pageX: 0,
								pageY: 0,
								screenX: 0,
								screenY: 0,
								movementX: 0,
								movementY: 0,
								getModifierState: () => false,
								relatedTarget: null,
							} as any;
							handleClick(syntheticEvent);
						}
					}}
				>
					{shapeElement}
				</div>
			</foreignObject>
		);
	}

	// Portal mode - always show placeholder rect for hit detection
	return (
		<>
			{/* SVG placeholder for hit detection */}
			<rect
				role="button"
				tabIndex={0}
				x={renderer.shape.x}
				y={renderer.shape.y}
				width={"width" in renderer.shape ? (renderer.shape.width as number) : 100}
				height={"height" in renderer.shape ? (renderer.shape.height as number) : 100}
				fill="transparent"
				stroke="transparent"
				strokeWidth="1"
				style={{ pointerEvents: "all" }}
				data-shape-id={renderer.shape.id}
				data-shape-type={renderer.shape.type}
				onClick={handleClick}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
			/>
			{/* HTML content via portal (when container is ready) */}
			{container &&
				ReactDOM.createPortal(
					<div
						role="button"
						tabIndex={0}
						style={{
							width: "100%",
							height: "100%",
							position: "relative",
						}}
						onClick={handleClick}
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerUp}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								const syntheticEvent = {
									...e,
									button: 0,
									buttons: 1,
									clientX: 0,
									clientY: 0,
									pageX: 0,
									pageY: 0,
									screenX: 0,
									screenY: 0,
									movementX: 0,
									movementY: 0,
									getModifierState: () => false,
									relatedTarget: null,
								} as any;
								handleClick(syntheticEvent);
							}
						}}
					>
						{shapeElement}
					</div>,
					container,
				)}
		</>
	);
};
