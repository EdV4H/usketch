import type React from "react";
import { useToolMachine } from "../hooks";
import type { ToolRegistration } from "../machines/types";

interface XStateToolbarProps {
	className?: string;
}

export const XStateToolbar: React.FC<XStateToolbarProps> = ({ className }) => {
	const { currentToolId, availableTools, switchTool, isActive } = useToolMachine();

	return (
		<div className={`xstate-toolbar ${className || ""}`}>
			<div className="toolbar-tools">
				{availableTools.map((tool: ToolRegistration) => (
					<button
						key={tool.id}
						className={`tool-button ${currentToolId === tool.id ? "active" : ""}`}
						onClick={() => switchTool(tool.id)}
						title={tool.name}
						disabled={!isActive && currentToolId !== tool.id}
					>
						<span className={`icon icon-${tool.icon}`} />
						<span className="tool-label">{tool.name}</span>
					</button>
				))}
			</div>

			<div className="toolbar-status">
				<span className="status-indicator">
					{isActive ? "🟢" : "⚪"}
					{currentToolId ? ` ${currentToolId}` : " No tool selected"}
				</span>
			</div>
		</div>
	);
};

export default XStateToolbar;
