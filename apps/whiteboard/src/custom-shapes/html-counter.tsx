import type { ShapePlugin } from "@usketch/shape-registry";
import { useWhiteboardStore, whiteboardStore } from "@usketch/store";
import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom";

// Custom base shape interface for custom shapes
interface CustomBaseShape {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	opacity: number;
	strokeColor: string;
	fillColor: string;
	strokeWidth: number;
}

export interface HtmlCounterShape extends CustomBaseShape {
	type: "html-counter";
	count: number;
}

// This component renders in SVG space but creates a portal to DOM
const HtmlCounterComponent: React.FC<{
	shape: HtmlCounterShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}> = ({ shape, isSelected, onClick }) => {
	const [localCount, setLocalCount] = useState(shape.count || 0);
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const { camera } = useWhiteboardStore();

	// Create container for portal
	useEffect(() => {
		const div = document.createElement("div");
		div.style.position = "absolute";
		div.style.pointerEvents = "auto";
		div.dataset.shapeId = shape.id;
		div.className = "html-shape-container";

		// Find the canvas container
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
	}, [shape.id]);

	// Update position based on camera
	useEffect(() => {
		if (container) {
			const transformedX = shape.x * camera.zoom + camera.x;
			const transformedY = shape.y * camera.zoom + camera.y;

			container.style.left = `${transformedX}px`;
			container.style.top = `${transformedY}px`;
			container.style.transform = `scale(${camera.zoom})`;
			container.style.transformOrigin = "top left";
			container.style.zIndex = isSelected ? "1000" : "100";
		}
	}, [container, shape.x, shape.y, camera, isSelected]);

	// Handle increment
	const handleIncrement = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			const newCount = localCount + 1;
			setLocalCount(newCount);

			whiteboardStore.getState().updateShape(shape.id, {
				...shape,
				count: newCount,
			});
		},
		[shape, localCount],
	);

	// Handle decrement
	const handleDecrement = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			const newCount = localCount - 1;
			setLocalCount(newCount);

			whiteboardStore.getState().updateShape(shape.id, {
				...shape,
				count: newCount,
			});
		},
		[shape, localCount],
	);

	// Handle drag
	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const startX = e.clientX;
			const startY = e.clientY;
			const originalX = shape.x;
			const originalY = shape.y;

			const handleMouseMove = (e: MouseEvent) => {
				const dx = (e.clientX - startX) / camera.zoom;
				const dy = (e.clientY - startY) / camera.zoom;

				whiteboardStore.getState().updateShape(shape.id, {
					...shape,
					x: originalX + dx,
					y: originalY + dy,
				});
			};

			const handleMouseUp = () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);

			// Also handle selection
			if (onClick) {
				onClick(e as any);
			}
		},
		[shape, camera, onClick],
	);

	// Sync with shape.count if it changes externally
	React.useEffect(() => {
		setLocalCount(shape.count || 0);
	}, [shape.count]);

	if (!container) {
		return null;
	}

	// Render the HTML counter using portal
	return ReactDOM.createPortal(
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "10px",
				padding: "10px",
				userSelect: "none",
			}}
		>
			{/* Decrement Button */}
			<button
				type="button"
				onClick={handleDecrement}
				style={{
					width: "40px",
					height: "40px",
					borderRadius: "50%",
					backgroundColor: "#FF6B6B",
					color: "white",
					border: "none",
					fontSize: "24px",
					fontWeight: "bold",
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
					boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.transform = "scale(1.1) rotate(-5deg)";
					e.currentTarget.style.boxShadow = "0 6px 12px rgba(255,107,107,0.3)";
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.transform = "scale(1) rotate(0)";
					e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
				}}
			>
				−
			</button>

			{/* Counter Display */}
			{/* biome-ignore lint/a11y/useSemanticElements: div needs role for dragging */}
			<div
				role="button"
				tabIndex={0}
				onMouseDown={handleMouseDown}
				style={{
					width: `${shape.width}px`,
					height: `${shape.height}px`,
					backgroundColor: shape.fillColor || "#FFFFFF",
					border: `${shape.strokeWidth || 3}px solid ${isSelected ? "#0066FF" : shape.strokeColor || "#333333"}`,
					borderRadius: "20px",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					fontSize: "16px",
					fontWeight: "600",
					fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
					color: "#333333",
					cursor: "move",
					position: "relative",
					boxShadow: isSelected
						? "0 0 0 4px rgba(0, 102, 255, 0.2), 0 8px 16px rgba(0,0,0,0.1)"
						: "0 4px 12px rgba(0,0,0,0.08)",
					transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
					opacity: shape.opacity || 1,
					background: `linear-gradient(135deg, ${shape.fillColor || "#FFFFFF"} 0%, ${shape.fillColor || "#FFFFFF"}dd 100%)`,
				}}
			>
				<div
					style={{
						fontSize: "14px",
						color: "#888",
						marginBottom: "4px",
						textTransform: "uppercase",
						letterSpacing: "1px",
					}}
				>
					Counter
				</div>
				<div
					style={{
						fontSize: "42px",
						fontWeight: "bold",
						lineHeight: 1,
						background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
						WebkitBackgroundClip: "text",
						WebkitTextFillColor: "transparent",
						backgroundClip: "text",
						textShadow: "0 2px 4px rgba(0,0,0,0.1)",
					}}
				>
					{localCount}
				</div>
			</div>

			{/* Increment Button */}
			<button
				type="button"
				onClick={handleIncrement}
				style={{
					width: "40px",
					height: "40px",
					borderRadius: "50%",
					backgroundColor: "#51CF66",
					color: "white",
					border: "none",
					fontSize: "24px",
					fontWeight: "bold",
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
					boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.transform = "scale(1.1) rotate(5deg)";
					e.currentTarget.style.boxShadow = "0 6px 12px rgba(81,207,102,0.3)";
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.transform = "scale(1) rotate(0)";
					e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
				}}
			>
				+
			</button>
		</div>,
		container,
	);
};

// For the SVG layer, we still need a placeholder
const HtmlCounterSvgPlaceholder: React.FC<{
	shape: HtmlCounterShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}> = ({ shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
	return (
		<>
			{/* Invisible rect for hit detection in SVG */}
			<rect
				x={shape.x}
				y={shape.y}
				width={shape.width}
				height={shape.height}
				fill="transparent"
				style={{ pointerEvents: "none" }}
			/>
			{/* Render the HTML component */}
			<HtmlCounterComponent
				shape={shape}
				isSelected={isSelected}
				onClick={onClick}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
			/>
		</>
	);
};

export const htmlCounterPlugin: ShapePlugin<any> = {
	type: "html-counter",
	component: HtmlCounterSvgPlaceholder,
	createDefaultShape: (props: {
		id: string;
		x: number;
		y: number;
		width?: number;
		height?: number;
	}) => ({
		id: props.id,
		type: "html-counter" as const,
		x: props.x,
		y: props.y,
		width: props.width || 160,
		height: props.height || 100,
		rotation: 0,
		opacity: 1,
		fillColor: "#FFFFFF",
		strokeColor: "#333333",
		strokeWidth: 3,
		count: 0,
	}),
	getBounds: (shape: HtmlCounterShape) => ({
		x: shape.x - 50,
		y: shape.y - 10,
		width: shape.width + 100,
		height: shape.height + 20,
	}),
	hitTest: (shape: HtmlCounterShape, point: { x: number; y: number }) => {
		return (
			point.x >= shape.x - 50 &&
			point.x <= shape.x + shape.width + 50 &&
			point.y >= shape.y - 10 &&
			point.y <= shape.y + shape.height + 10
		);
	},
};
