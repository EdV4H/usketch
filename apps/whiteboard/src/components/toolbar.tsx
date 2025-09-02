import {
	DotsRenderer,
	GridRenderer,
	IsometricRenderer,
	LinesRenderer,
	NoneRenderer,
} from "@usketch/backgrounds";
import type React from "react";
import { useState } from "react";
import { useStore } from "../hooks/use-store";

export interface ToolbarProps {
	onBackgroundChange?: (background: { renderer: any; config?: any }) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onBackgroundChange }) => {
	const currentTool = useStore((state) => state.currentTool);
	const setCurrentTool = useStore((state) => state.setCurrentTool);
	const [currentBackground, setCurrentBackground] = useState("grid");

	const tools = [
		{ id: "select", name: "Select" },
		{ id: "rectangle", name: "Rectangle" },
		{ id: "draw", name: "Draw" },
	];

	const backgrounds = [
		{ id: "none", name: "None", renderer: NoneRenderer, config: {} },
		{
			id: "grid",
			name: "Grid",
			renderer: GridRenderer,
			config: { size: 20, color: "#e0e0e0" },
		},
		{
			id: "dots",
			name: "Dots",
			renderer: DotsRenderer,
			config: { spacing: 20, size: 2, color: "#d0d0d0" },
		},
		{
			id: "lines",
			name: "Lines",
			renderer: LinesRenderer,
			config: { direction: "horizontal", spacing: 25, color: "#e0e0e0" },
		},
		{
			id: "isometric",
			name: "Isometric",
			renderer: IsometricRenderer,
			config: { size: 30, color: "#e0e0e0" },
		},
	];

	const handleBackgroundChange = (backgroundId: string) => {
		setCurrentBackground(backgroundId);
		const bg = backgrounds.find((b) => b.id === backgroundId);
		if (bg && onBackgroundChange) {
			onBackgroundChange({
				renderer: new bg.renderer(),
				config: bg.config,
			});
		}
	};

	return (
		<div className="toolbar">
			<div className="toolbar-group">
				{tools.map((tool) => (
					<button
						type="button"
						key={tool.id}
						className={`tool-button ${currentTool === tool.id ? "active" : ""}`}
						onClick={() => setCurrentTool(tool.id)}
						data-testid={`tool-${tool.id}`}
					>
						{tool.name}
					</button>
				))}
			</div>
			<div className="toolbar-separator" />
			<div className="toolbar-group">
				<label className="toolbar-label" htmlFor="background-selector">
					Background:
				</label>
				<select
					id="background-selector"
					className="toolbar-select"
					value={currentBackground}
					onChange={(e) => handleBackgroundChange(e.target.value)}
					data-testid="background-selector"
				>
					{backgrounds.map((bg) => (
						<option key={bg.id} value={bg.id}>
							{bg.name}
						</option>
					))}
				</select>
			</div>
		</div>
	);
};
