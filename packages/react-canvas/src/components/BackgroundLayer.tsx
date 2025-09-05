import type React from "react";
import { useBackgroundRenderer } from "../hooks/useBackgroundRenderer";
import type { BackgroundLayerProps } from "../types";
import type { BackgroundComponent } from "./BackgroundComponent";

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
	camera,
	options,
	className = "",
}) => {
	const containerRef = useBackgroundRenderer(camera, options);

	// Reactコンポーネントが指定されている場合
	if (options?.type === "component" && options.component) {
		const Component = options.component as BackgroundComponent;
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
					pointerEvents: "none",
				}}
			>
				<Component camera={camera} config={options.config} />
			</div>
		);
	}

	// 通常のレンダラーを使用
	return (
		<div
			ref={containerRef}
			className={`background-layer ${className}`.trim()}
			data-testid="background-layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		/>
	);
};
