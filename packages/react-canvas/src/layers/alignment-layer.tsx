import type { AlignmentGuide, Camera } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { memo } from "react";

interface AlignmentLayerProps {
	camera: Camera;
}

interface AlignmentGuideLineProps {
	guide: AlignmentGuide;
	camera: Camera;
}

const AlignmentGuideLine: React.FC<AlignmentGuideLineProps> = memo(({ guide, camera }) => {
	// Apply camera transformation to guide coordinates
	const start = {
		x: guide.start.x * camera.zoom + camera.x,
		y: guide.start.y * camera.zoom + camera.y,
	};
	const end = {
		x: guide.end.x * camera.zoom + camera.x,
		y: guide.end.y * camera.zoom + camera.y,
	};

	return (
		<line
			x1={start.x}
			y1={start.y}
			x2={end.x}
			y2={end.y}
			stroke="#2196F3"
			strokeWidth={1}
			strokeDasharray="5,5"
			opacity={0.8}
			pointerEvents="none"
		/>
	);
});

AlignmentGuideLine.displayName = "AlignmentGuideLine";

export const AlignmentLayer: React.FC<AlignmentLayerProps> = memo(({ camera }) => {
	const guides = useWhiteboardStore((state) => state.alignmentGuides);
	const config = useWhiteboardStore((state) => state.alignmentConfig);

	// Don't render if guides are disabled or there are no guides
	if (!config.showGuides || guides.length === 0) {
		return null;
	}

	return (
		<svg
			className="alignment-layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				zIndex: 1000,
			}}
			aria-label="Alignment guides for shape positioning"
		>
			{guides.map((guide) => (
				<AlignmentGuideLine key={guide.id} guide={guide} camera={camera} />
			))}
		</svg>
	);
});

AlignmentLayer.displayName = "AlignmentLayer";
