import type React from "react";
import { useStore } from "../hooks/use-store";

export const Toolbar: React.FC = () => {
	const currentTool = useStore((state) => state.currentTool);
	const setCurrentTool = useStore((state) => state.setCurrentTool);

	const tools = [
		{ id: "select", name: "Select" },
		{ id: "rectangle", name: "Rectangle" },
	];

	return (
		<div className="toolbar">
			{tools.map((tool) => (
				<button
					type="button"
					key={tool.id}
					className={`tool-button ${currentTool === tool.id ? "active" : ""}`}
					onClick={() => setCurrentTool(tool.id)}
				>
					{tool.name}
				</button>
			))}
		</div>
	);
};
