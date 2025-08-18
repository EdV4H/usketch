import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useToolMachine } from "../hooks/useToolMachine";
import type { ToolStateValue } from "../types/state";

interface WhiteboardProps {
	className?: string;
}

// === Whiteboard Component ===
export const Whiteboard: React.FC<WhiteboardProps> = ({ className = "" }) => {
	const canvasRef = useRef<HTMLDivElement>(null);
	const [currentTool, setCurrentTool] = useState("select");

	const { state, context, handlers, isIn } = useToolMachine(currentTool);

	// Apply cursor
	useEffect(() => {
		if (canvasRef.current) {
			canvasRef.current.style.cursor = context.cursor;
		}
	}, [context.cursor]);

	// Debug visualization in development
	useEffect(() => {
		if (process.env.NODE_ENV === "development") {
			console.log("Tool State:", state);
			console.log("Tool Context:", context);
		}
	}, [state, context]);

	return (
		<div className={`whiteboard-container ${className}`}>
			<Toolbar currentTool={currentTool} onToolChange={setCurrentTool} toolState={state} />

			<div
				ref={canvasRef}
				className="whiteboard-canvas"
				role="application"
				aria-label="Drawing canvas"
				onPointerDown={(e) => handlers.onPointerDown(e.nativeEvent)}
				onPointerMove={(e) => handlers.onPointerMove(e.nativeEvent)}
				onPointerUp={(e) => handlers.onPointerUp(e.nativeEvent)}
				onKeyDown={(e) => handlers.onKeyDown(e.nativeEvent)}
				onDoubleClick={(e) => handlers.onDoubleClick(e.nativeEvent)}
				style={{
					width: "100%",
					height: "100%",
					position: "relative",
					outline: "none",
				}}
			>
				{/* Render shapes - placeholder */}
				<div className="shapes-container">{/* Shapes will be rendered here */}</div>

				{/* Selection box */}
				{isIn("selecting.brush") && context.selectionBox && (
					<SelectionBox bounds={context.selectionBox} />
				)}

				{/* Current stroke preview */}
				{isIn("drawing") && context.currentStroke?.length > 0 && (
					<StrokePreview points={context.currentStroke} style={context.strokeStyle} />
				)}

				{/* Crop overlay */}
				{isIn("cropping") && context.croppingShapeId && (
					<CropOverlay shapeId={context.croppingShapeId} />
				)}
			</div>

			{/* State Inspector (Dev Only) */}
			{process.env.NODE_ENV === "development" && <StateInspector state={state} context={context} />}
		</div>
	);
};

// === Toolbar Component ===
interface ToolbarProps {
	currentTool: string;
	onToolChange: (toolId: string) => void;
	toolState: ToolStateValue;
}

const Toolbar: React.FC<ToolbarProps> = ({ currentTool, onToolChange, toolState }) => {
	const tools = [
		{ id: "select", label: "Select", icon: "⬚" },
		{ id: "draw", label: "Draw", icon: "✏️" },
		{ id: "rectangle", label: "Rectangle", icon: "▭" },
		{ id: "ellipse", label: "Ellipse", icon: "○" },
		{ id: "arrow", label: "Arrow", icon: "→" },
		{ id: "text", label: "Text", icon: "T" },
	];

	return (
		<div
			className="toolbar"
			style={{
				display: "flex",
				gap: "8px",
				padding: "8px",
				borderBottom: "1px solid #ccc",
				backgroundColor: "#f5f5f5",
			}}
		>
			{tools.map((tool) => (
				<button
					type="button"
					key={tool.id}
					onClick={() => onToolChange(tool.id)}
					className={`tool-button ${currentTool === tool.id ? "active" : ""}`}
					style={{
						padding: "8px 12px",
						border: "1px solid #999",
						borderRadius: "4px",
						backgroundColor: currentTool === tool.id ? "#007bff" : "white",
						color: currentTool === tool.id ? "white" : "black",
						cursor: "pointer",
					}}
					disabled={tool.id !== "select" && tool.id !== "draw"} // Only select and draw are implemented
				>
					<span>{tool.icon}</span>
					<span style={{ marginLeft: "4px" }}>{tool.label}</span>
				</button>
			))}
			<div style={{ marginLeft: "auto", padding: "8px" }}>State: {JSON.stringify(toolState)}</div>
		</div>
	);
};

// === Selection Box Component ===
interface SelectionBoxProps {
	bounds: { x: number; y: number; width: number; height: number };
}

const SelectionBox: React.FC<SelectionBoxProps> = ({ bounds }) => {
	return (
		<div
			className="selection-box"
			style={{
				position: "absolute",
				left: bounds.x,
				top: bounds.y,
				width: bounds.width,
				height: bounds.height,
				border: "1px dashed #007bff",
				backgroundColor: "rgba(0, 123, 255, 0.1)",
				pointerEvents: "none",
			}}
		/>
	);
};

// === Stroke Preview Component ===
interface StrokePreviewProps {
	points: Array<{ x: number; y: number }>;
	style: { color: string; width: number; opacity: number };
}

const StrokePreview: React.FC<StrokePreviewProps> = ({ points, style }) => {
	if (points.length < 2) return null;

	const pathData = points.reduce((acc, point, index) => {
		if (index === 0) return `M ${point.x} ${point.y}`;
		return `${acc} L ${point.x} ${point.y}`;
	}, "");

	return (
		<svg
			aria-label="Stroke preview"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<title>Drawing stroke preview</title>
			<path
				d={pathData}
				stroke={style.color}
				strokeWidth={style.width}
				opacity={style.opacity}
				fill="none"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
};

// === Crop Overlay Component ===
interface CropOverlayProps {
	shapeId: string;
}

const CropOverlay: React.FC<CropOverlayProps> = ({ shapeId }) => {
	return (
		<div
			className="crop-overlay"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: "rgba(0, 0, 0, 0.5)",
				pointerEvents: "none",
			}}
		>
			<div
				style={{
					color: "white",
					padding: "8px",
					backgroundColor: "rgba(0, 0, 0, 0.7)",
					borderRadius: "4px",
					position: "absolute",
					top: "8px",
					left: "50%",
					transform: "translateX(-50%)",
				}}
			>
				Cropping shape: {shapeId}
			</div>
		</div>
	);
};

// === State Inspector Component ===
interface StateInspectorProps {
	state: ToolStateValue;
	context: any;
}

const StateInspector: React.FC<StateInspectorProps> = ({ state, context }) => {
	return (
		<div
			className="state-inspector"
			style={{
				position: "fixed",
				bottom: "16px",
				right: "16px",
				backgroundColor: "rgba(0, 0, 0, 0.8)",
				color: "white",
				padding: "12px",
				borderRadius: "8px",
				fontFamily: "monospace",
				fontSize: "12px",
				maxWidth: "300px",
				maxHeight: "200px",
				overflow: "auto",
			}}
		>
			<div>State: {JSON.stringify(state)}</div>
			<div style={{ marginTop: "8px" }}>
				Context:{" "}
				{JSON.stringify(
					context,
					(_key, value) => {
						// Handle Set and Map serialization
						if (value instanceof Set) {
							return { type: "Set", values: Array.from(value) };
						}
						if (value instanceof Map) {
							return { type: "Map", entries: Array.from(value.entries()) };
						}
						return value;
					},
					2,
				)}
			</div>
		</div>
	);
};
