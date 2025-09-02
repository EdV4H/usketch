import type { Camera, Shape } from "@usketch/shared-types";
import type React from "react";

interface SelectionLayerProps {
	shapes: Shape[];
	camera: Camera;
}

export const SelectionLayer: React.FC<SelectionLayerProps> = ({ shapes, camera }) => {
	const transform = `translate(${-camera.x * camera.zoom}px, ${-camera.y * camera.zoom}px) scale(${camera.zoom})`;

	if (shapes.length === 0) return null;

	// Calculate bounding box for all selected shapes
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const shape of shapes) {
		const left = shape.x;
		const top = shape.y;
		const right = shape.x + ((shape as any).width || 0);
		const bottom = shape.y + ((shape as any).height || 0);

		minX = Math.min(minX, left);
		minY = Math.min(minY, top);
		maxX = Math.max(maxX, right);
		maxY = Math.max(maxY, bottom);
	}

	const selectionBox = {
		x: minX - 2,
		y: minY - 2,
		width: maxX - minX + 4,
		height: maxY - minY + 4,
	};

	return (
		<div
			className="selection-layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				transformOrigin: "0 0",
				transform,
				pointerEvents: "none",
			}}
		>
			{/* Selection box */}
			<div
				className="selection-box"
				style={{
					position: "absolute",
					left: selectionBox.x,
					top: selectionBox.y,
					width: selectionBox.width,
					height: selectionBox.height,
					border: "2px solid #0066ff",
					backgroundColor: "rgba(0, 102, 255, 0.1)",
					pointerEvents: "none",
				}}
			>
				{/* Resize handles */}
				{[
					{ className: "nw", left: -4, top: -4 },
					{ className: "n", left: "50%", top: -4, marginLeft: -4 },
					{ className: "ne", right: -4, top: -4 },
					{ className: "e", right: -4, top: "50%", marginTop: -4 },
					{ className: "se", right: -4, bottom: -4 },
					{ className: "s", left: "50%", bottom: -4, marginLeft: -4 },
					{ className: "sw", left: -4, bottom: -4 },
					{ className: "w", left: -4, top: "50%", marginTop: -4 },
				].map((handle) => (
					<div
						key={handle.className}
						className={`resize-handle resize-handle-${handle.className}`}
						style={{
							position: "absolute",
							width: 8,
							height: 8,
							backgroundColor: "#0066ff",
							border: "1px solid white",
							borderRadius: "50%",
							...handle,
						}}
					/>
				))}
			</div>
		</div>
	);
};
