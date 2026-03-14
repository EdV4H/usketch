import { useApp, useStoreSubscribe } from "@usketch/canvas-engine";

export function Toolbar() {
	const app = useApp();
	const activeToolId = useStoreSubscribe(app.store, (s) => s.getActiveToolId());
	const tools = app.tools.getOrdered();

	return (
		<div
			style={{
				position: "fixed",
				top: 12,
				left: "50%",
				transform: "translateX(-50%)",
				display: "flex",
				gap: 4,
				padding: 4,
				background: "white",
				borderRadius: 8,
				boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
				zIndex: 100,
			}}
		>
			{tools.map(({ id, definition }) => (
				<button
					key={id}
					type="button"
					onClick={() => app.store.setActiveToolId(id)}
					title={`${id}${definition.shortcut ? ` (${definition.shortcut})` : ""}`}
					style={{
						width: 36,
						height: 36,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						border: "none",
						borderRadius: 6,
						background: activeToolId === id ? "#e3f2fd" : "transparent",
						color: activeToolId === id ? "#1976d2" : "#333",
						cursor: "pointer",
					}}
				>
					{definition.icon()}
				</button>
			))}
			<div style={{ width: 1, background: "#e0e0e0", margin: "4px 2px" }} />
			<button
				type="button"
				onClick={() => app.commands.undo()}
				title="Undo (Ctrl+Z)"
				style={actionButtonStyle}
			>
				↩
			</button>
			<button
				type="button"
				onClick={() => app.commands.redo()}
				title="Redo (Ctrl+Shift+Z)"
				style={actionButtonStyle}
			>
				↪
			</button>
		</div>
	);
}

const actionButtonStyle: React.CSSProperties = {
	width: 36,
	height: 36,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	border: "none",
	borderRadius: 6,
	background: "transparent",
	color: "#666",
	cursor: "pointer",
	fontSize: 16,
};
