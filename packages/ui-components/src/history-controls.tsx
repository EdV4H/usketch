import { useWhiteboardStore } from "@usketch/store";
import type React from "react";

export const HistoryControls: React.FC = () => {
	const { undo, redo, canUndo, canRedo } = useWhiteboardStore();

	return (
		<div
			className="history-controls"
			style={{
				display: "flex",
				gap: "4px",
				padding: "4px",
				borderRadius: "8px",
				backgroundColor: "white",
				boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
			}}
		>
			<button
				type="button"
				onClick={undo}
				disabled={!canUndo}
				aria-label="Undo"
				title="Undo (Cmd+Z)"
				style={{
					width: "32px",
					height: "32px",
					border: "1px solid #e0e0e0",
					borderRadius: "4px",
					backgroundColor: canUndo ? "white" : "#f5f5f5",
					cursor: canUndo ? "pointer" : "not-allowed",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					transition: "background-color 0.2s",
				}}
				onMouseEnter={(e) => {
					if (canUndo) {
						e.currentTarget.style.backgroundColor = "#f0f0f0";
					}
				}}
				onMouseLeave={(e) => {
					if (canUndo) {
						e.currentTarget.style.backgroundColor = "white";
					}
				}}
			>
				<UndoIcon disabled={!canUndo} />
			</button>
			<button
				type="button"
				onClick={redo}
				disabled={!canRedo}
				aria-label="Redo"
				title="Redo (Cmd+Shift+Z)"
				style={{
					width: "32px",
					height: "32px",
					border: "1px solid #e0e0e0",
					borderRadius: "4px",
					backgroundColor: canRedo ? "white" : "#f5f5f5",
					cursor: canRedo ? "pointer" : "not-allowed",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					transition: "background-color 0.2s",
				}}
				onMouseEnter={(e) => {
					if (canRedo) {
						e.currentTarget.style.backgroundColor = "#f0f0f0";
					}
				}}
				onMouseLeave={(e) => {
					if (canRedo) {
						e.currentTarget.style.backgroundColor = "white";
					}
				}}
			>
				<RedoIcon disabled={!canRedo} />
			</button>
		</div>
	);
};

// Undo Icon Component
const UndoIcon: React.FC<{ disabled: boolean }> = ({ disabled }) => (
	<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<title>Undo</title>
		<path
			d="M3.5 6.5L6 4L8.5 6.5"
			stroke={disabled ? "#999" : "#333"}
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M6 4V10C6 11.1046 6.89543 12 8 12H12"
			stroke={disabled ? "#999" : "#333"}
			strokeWidth="1.5"
			strokeLinecap="round"
		/>
	</svg>
);

// Redo Icon Component
const RedoIcon: React.FC<{ disabled: boolean }> = ({ disabled }) => (
	<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<title>Redo</title>
		<path
			d="M12.5 6.5L10 4L7.5 6.5"
			stroke={disabled ? "#999" : "#333"}
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M10 4V10C10 11.1046 9.10457 12 8 12H4"
			stroke={disabled ? "#999" : "#333"}
			strokeWidth="1.5"
			strokeLinecap="round"
		/>
	</svg>
);
