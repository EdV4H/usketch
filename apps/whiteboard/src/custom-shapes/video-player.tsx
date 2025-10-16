import type { ShapePlugin } from "@usketch/shape-registry";
import type React from "react";
import { useState } from "react";

// Custom base shape interface
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

// Define the video player shape data structure
export interface VideoPlayerShape extends CustomBaseShape {
	type: "video-player";
	videoUrl: string;
	title: string;
	autoplay: boolean;
}

// React component for the video player (SVG placeholder)
const VideoPlayerComponent: React.FC<{
	shape: VideoPlayerShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}> = ({ shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
	const [isPlaying, setIsPlaying] = useState(false);

	const handlePlayPause = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsPlaying(!isPlaying);
	};

	const controlBarHeight = 40;

	return (
		<g
			role="button"
			onClick={onClick}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
		>
			{/* Video area background */}
			<rect
				x={shape.x}
				y={shape.y}
				width={shape.width}
				height={shape.height - controlBarHeight}
				fill="#1a1a1a"
				stroke="#333"
				strokeWidth={2}
				rx={8}
			/>

			{/* Video placeholder icon */}
			<g opacity={0.3}>
				<circle
					cx={shape.x + shape.width / 2}
					cy={shape.y + (shape.height - controlBarHeight) / 2}
					r={40}
					fill="#555"
				/>
				<polygon
					points={`
						${shape.x + shape.width / 2 - 12},${shape.y + (shape.height - controlBarHeight) / 2 - 20}
						${shape.x + shape.width / 2 - 12},${shape.y + (shape.height - controlBarHeight) / 2 + 20}
						${shape.x + shape.width / 2 + 20},${shape.y + (shape.height - controlBarHeight) / 2}
					`}
					fill="#888"
				/>
			</g>

			{/* Title overlay */}
			<rect x={shape.x} y={shape.y} width={shape.width} height={30} fill="rgba(0,0,0,0.7)" rx={8} />
			<text
				x={shape.x + 10}
				y={shape.y + 20}
				fill="white"
				fontSize="14"
				fontWeight="bold"
				style={{ userSelect: "none" }}
			>
				{shape.title}
			</text>

			{/* Control bar */}
			<rect
				x={shape.x}
				y={shape.y + shape.height - controlBarHeight}
				width={shape.width}
				height={controlBarHeight}
				fill="#2a2a2a"
				stroke="#333"
				strokeWidth={2}
				rx={8}
			/>

			{/* Play/Pause button */}
			<circle
				role="button"
				cx={shape.x + 30}
				cy={shape.y + shape.height - controlBarHeight / 2}
				r={15}
				fill="#4a4a4a"
				stroke="#666"
				strokeWidth={2}
				style={{ cursor: "pointer" }}
				onClick={handlePlayPause}
			/>

			{isPlaying ? (
				// Pause icon
				<g role="button" onClick={handlePlayPause} style={{ cursor: "pointer" }}>
					<rect
						x={shape.x + 24}
						y={shape.y + shape.height - controlBarHeight / 2 - 8}
						width={4}
						height={16}
						fill="white"
					/>
					<rect
						x={shape.x + 32}
						y={shape.y + shape.height - controlBarHeight / 2 - 8}
						width={4}
						height={16}
						fill="white"
					/>
				</g>
			) : (
				// Play icon
				<polygon
					role="button"
					points={`
						${shape.x + 24},${shape.y + shape.height - controlBarHeight / 2 - 8}
						${shape.x + 24},${shape.y + shape.height - controlBarHeight / 2 + 8}
						${shape.x + 36},${shape.y + shape.height - controlBarHeight / 2}
					`}
					fill="white"
					style={{ cursor: "pointer" }}
					onClick={handlePlayPause}
				/>
			)}

			{/* Progress bar */}
			<rect
				x={shape.x + 60}
				y={shape.y + shape.height - controlBarHeight / 2 - 3}
				width={shape.width - 80}
				height={6}
				fill="#555"
				rx={3}
			/>
			<rect
				x={shape.x + 60}
				y={shape.y + shape.height - controlBarHeight / 2 - 3}
				width={isPlaying ? (shape.width - 80) * 0.3 : 0}
				height={6}
				fill="#FF6B6B"
				rx={3}
			/>

			{/* Video URL label */}
			<text
				x={shape.x + shape.width / 2}
				y={shape.y + (shape.height - controlBarHeight) / 2 + 60}
				fill="#888"
				fontSize="10"
				textAnchor="middle"
				style={{ userSelect: "none" }}
			>
				{shape.videoUrl}
			</text>

			{/* Selection highlight */}
			{isSelected && (
				<rect
					x={shape.x}
					y={shape.y}
					width={shape.width}
					height={shape.height}
					fill="none"
					stroke="#0066FF"
					strokeWidth={2}
					strokeDasharray="5,5"
					opacity={0.5}
					style={{ pointerEvents: "none" }}
					rx={8}
				/>
			)}
		</g>
	);
};

export const videoPlayerPlugin: ShapePlugin<VideoPlayerShape> = {
	type: "video-player",
	component: VideoPlayerComponent,
	createDefaultShape: (props: {
		id: string;
		x: number;
		y: number;
		width?: number;
		height?: number;
	}) => ({
		id: props.id,
		type: "video-player" as const,
		x: props.x,
		y: props.y,
		width: props.width || 320,
		height: props.height || 240,
		rotation: 0,
		opacity: 1,
		strokeColor: "#333333",
		fillColor: "#1a1a1a",
		strokeWidth: 2,
		videoUrl: "https://example.com/video.mp4",
		title: "Video Player",
		autoplay: false,
	}),
	getBounds: (shape: VideoPlayerShape) => ({
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
	}),
	hitTest: (shape: VideoPlayerShape, point: { x: number; y: number }) => {
		return (
			point.x >= shape.x &&
			point.x <= shape.x + shape.width &&
			point.y >= shape.y &&
			point.y <= shape.y + shape.height
		);
	},
};
