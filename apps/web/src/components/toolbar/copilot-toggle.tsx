import { useApp } from "@edv4h/usketch-canvas-engine";
import { useCallback, useState } from "react";
import { actionBtnStyle } from "../../lib/styles.js";

export function CopilotToggle() {
	const app = useApp();
	const [enabled, setEnabled] = useState(false);

	const toggle = useCallback(() => {
		const next = !enabled;
		setEnabled(next);
		app.events.emit("copilot:toggle", { enabled: next });
	}, [enabled, app.events]);

	return (
		<button
			type="button"
			onClick={toggle}
			title={`Copilot: ${enabled ? "ON" : "OFF"}`}
			style={{
				...actionBtnStyle,
				background: enabled ? "#e8f5e9" : "transparent",
				color: enabled ? "#2e7d32" : "#999",
				fontSize: 14,
			}}
		>
			{enabled ? "\u2726" : "\u2727"}
		</button>
	);
}
