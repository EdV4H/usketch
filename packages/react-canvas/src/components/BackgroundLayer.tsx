import type React from "react";
import { type CSSProperties, useMemo } from "react";
import type { BackgroundLayerProps } from "../types";

type BackgroundType = "none" | "dots" | "grid" | "lines" | "isometric";

interface BackgroundConfig {
	type: BackgroundType;
	size?: number;
	spacing?: number;
	color?: string;
	thickness?: number;
	direction?: "horizontal" | "vertical" | "both";
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
	camera,
	options,
	className = "",
}) => {
	const config = (options as BackgroundConfig) || { type: "dots" };

	const backgroundStyle = useMemo((): CSSProperties => {
		switch (config.type) {
			case "none":
				return {
					backgroundColor: "#ffffff",
				};

			case "dots": {
				const spacing = (config.spacing || 20) * camera.zoom;
				const size = config.size || 2;
				const color = config.color || "#d0d0d0";

				const svg = `<svg width="${spacing}" height="${spacing}" viewBox="0 0 ${spacing} ${spacing}" xmlns="http://www.w3.org/2000/svg">
					<circle cx="${spacing / 2}" cy="${spacing / 2}" r="${size / 2}" fill="${color}" />
				</svg>`;

				return {
					backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
					backgroundSize: `${spacing}px ${spacing}px`,
					backgroundPosition: `${-camera.x % spacing}px ${-camera.y % spacing}px`,
				};
			}

			case "grid": {
				const size = (config.size || 20) * camera.zoom;
				const color = config.color || "#e0e0e0";
				const thickness = config.thickness || 1;

				const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
					<rect width="${size}" height="${thickness}" fill="${color}" />
					<rect width="${thickness}" height="${size}" fill="${color}" />
				</svg>`;

				return {
					backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
					backgroundSize: `${size}px ${size}px`,
					backgroundPosition: `${-camera.x % size}px ${-camera.y % size}px`,
				};
			}

			case "lines": {
				const spacing = (config.spacing || 25) * camera.zoom;
				const color = config.color || "#e0e0e0";
				const thickness = config.thickness || 1;
				const direction = config.direction || "horizontal";

				let svg = "";
				if (direction === "horizontal" || direction === "both") {
					svg = `<svg width="${spacing}" height="${spacing}" viewBox="0 0 ${spacing} ${spacing}" xmlns="http://www.w3.org/2000/svg">
						<rect y="0" width="${spacing}" height="${thickness}" fill="${color}" />
						${direction === "both" ? `<rect x="0" width="${thickness}" height="${spacing}" fill="${color}" />` : ""}
					</svg>`;
				} else {
					svg = `<svg width="${spacing}" height="${spacing}" viewBox="0 0 ${spacing} ${spacing}" xmlns="http://www.w3.org/2000/svg">
						<rect x="0" width="${thickness}" height="${spacing}" fill="${color}" />
					</svg>`;
				}

				return {
					backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
					backgroundSize: `${spacing}px ${spacing}px`,
					backgroundPosition: `${-camera.x % spacing}px ${-camera.y % spacing}px`,
				};
			}

			case "isometric": {
				const size = (config.size || 30) * camera.zoom;
				const color = config.color || "#e0e0e0";
				const height = Math.sqrt(3) * size;

				const svg = `<svg width="${size * 2}" height="${height}" viewBox="0 0 ${size * 2} ${height}" xmlns="http://www.w3.org/2000/svg">
					<path d="M 0,${height / 2} L ${size},0 L ${size * 2},${height / 2}" stroke="${color}" stroke-width="1" fill="none" />
					<path d="M 0,${height / 2} L ${size},${height}" stroke="${color}" stroke-width="1" fill="none" />
					<path d="M ${size * 2},${height / 2} L ${size},${height}" stroke="${color}" stroke-width="1" fill="none" />
				</svg>`;

				return {
					backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
					backgroundSize: `${size * 2}px ${height}px`,
					backgroundPosition: `${-camera.x % (size * 2)}px ${-camera.y % height}px`,
				};
			}

			default:
				return {
					backgroundColor: "#f8f8f8",
				};
		}
	}, [config, camera]);

	return (
		<div
			className={`background-layer ${className}`.trim()}
			data-testid="background-layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				...backgroundStyle,
				pointerEvents: "none",
			}}
		/>
	);
};
