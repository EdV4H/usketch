import type { BaseShapeConfig, Bounds } from "@usketch/shape-abstraction";
import { BaseShape } from "@usketch/shape-abstraction";
import { UnifiedShapePluginAdapter } from "@usketch/shape-registry";
import type React from "react";
import { useRef, useState } from "react";

// Define the video player shape data structure
export interface VideoPlayerShape {
	id: string;
	type: "video-player-unified";
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	opacity: number;
	videoUrl: string;
	title: string;
	autoplay: boolean;
}

/**
 * Video Player Shape using HTML rendering
 * Demonstrates embedding rich media content
 */
class VideoPlayer extends BaseShape<VideoPlayerShape> {
	constructor(shape: VideoPlayerShape, config: BaseShapeConfig<VideoPlayerShape>) {
		super(shape, {
			...config,
			renderMode: "html", // HTML for video elements
			enableInteractivity: true,
		});
	}

	render(): React.ReactElement {
		return <VideoPlayerComponent shape={this.shape} />;
	}

	getBounds(): Bounds {
		return {
			x: this.shape.x,
			y: this.shape.y,
			width: this.shape.width,
			height: this.shape.height,
		};
	}

	hitTest(point: { x: number; y: number }): boolean {
		const bounds = this.getBounds();
		return (
			point.x >= bounds.x &&
			point.x <= bounds.x + bounds.width &&
			point.y >= bounds.y &&
			point.y <= bounds.y + bounds.height
		);
	}
}

// React component for the video player
const VideoPlayerComponent: React.FC<{ shape: VideoPlayerShape }> = ({ shape }) => {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);

	const togglePlayPause = () => {
		if (videoRef.current) {
			if (isPlaying) {
				videoRef.current.pause();
			} else {
				videoRef.current.play();
			}
			setIsPlaying(!isPlaying);
		}
	};

	const handleTimeUpdate = () => {
		if (videoRef.current) {
			setCurrentTime(videoRef.current.currentTime);
		}
	};

	const handleLoadedMetadata = () => {
		if (videoRef.current) {
			setDuration(videoRef.current.duration);
		}
	};

	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const time = parseFloat(e.target.value);
		if (videoRef.current) {
			videoRef.current.currentTime = time;
			setCurrentTime(time);
		}
	};

	const formatTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<div
			style={{
				position: "relative",
				left: 0,
				top: 0,
				width: shape.width,
				height: shape.height,
				background: "#000",
				border: "2px solid #333",
				borderRadius: "8px",
				overflow: "hidden",
				opacity: shape.opacity,
				transform: `rotate(${shape.rotation}deg)`,
				transformOrigin: "center",
			}}
		>
			{/* Title bar */}
			<div
				style={{
					background: "linear-gradient(to bottom, #333, #222)",
					color: "white",
					padding: "8px",
					fontSize: "12px",
					fontWeight: "bold",
					borderBottom: "1px solid #111",
				}}
			>
				{shape.title}
			</div>

			{/* Video element */}
			<div
				style={{
					position: "relative",
					width: "100%",
					height: `calc(100% - 80px)`,
					background: "#000",
				}}
			>
				{shape.videoUrl ? (
					<video
						ref={videoRef}
						style={{
							width: "100%",
							height: "100%",
							objectFit: "contain",
						}}
						onTimeUpdate={handleTimeUpdate}
						onLoadedMetadata={handleLoadedMetadata}
						autoPlay={shape.autoplay}
						loop
					>
						<source src={shape.videoUrl} type="video/mp4" />
						<track kind="captions" />
						{/* Fallback for demo - using a placeholder */}
						Your browser does not support the video tag.
					</video>
				) : (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							height: "100%",
							color: "#666",
							fontSize: "14px",
						}}
					>
						{/* Placeholder SVG for demo */}
						<svg width="60" height="60" viewBox="0 0 24 24" fill="none">
							<title>Video Player Placeholder</title>
							<path
								d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
								fill="#666"
							/>
							<path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#666" strokeWidth="2" />
						</svg>
					</div>
				)}
			</div>

			{/* Controls */}
			<div
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					background: "linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.7))",
					padding: "8px",
				}}
			>
				{/* Progress bar */}
				<input
					type="range"
					min="0"
					max={duration || 100}
					value={currentTime}
					onChange={handleSeek}
					style={{
						width: "100%",
						height: "4px",
						marginBottom: "8px",
						cursor: "pointer",
					}}
				/>

				{/* Control buttons */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<button
						type="button"
						onClick={togglePlayPause}
						style={{
							background: "none",
							border: "none",
							color: "white",
							fontSize: "20px",
							cursor: "pointer",
							padding: "4px 8px",
						}}
					>
						{isPlaying ? "⏸" : "▶"}
					</button>

					<span
						style={{
							color: "white",
							fontSize: "11px",
						}}
					>
						{formatTime(currentTime)} / {formatTime(duration)}
					</span>
				</div>
			</div>
		</div>
	);
};

// Create the plugin using the adapter
export const videoPlayerPlugin = UnifiedShapePluginAdapter.fromBaseShape(
	"video-player-unified",
	VideoPlayer as any,
	(props: { id: string; x: number; y: number; width?: number; height?: number }) =>
		({
			id: props.id,
			type: "video-player-unified",
			x: props.x,
			y: props.y,
			width: props.width || 320,
			height: props.height || 240,
			rotation: 0,
			opacity: 1,
			videoUrl: "", // Empty for demo, can be set to actual video URL
			title: "Video Player Shape",
			autoplay: false,
		}) as any,
	"Video Player (Unified)",
) as any;
