import { useApp } from "@edv4h/usketch-canvas-engine";
import { useCallback, useState } from "react";
import { I, IconBtn } from "../ui/index.js";

export function CopilotToggle() {
	const app = useApp();
	const [enabled, setEnabled] = useState(false);

	const toggle = useCallback(() => {
		const next = !enabled;
		setEnabled(next);
		app.events.emit("copilot:toggle", { enabled: next });
	}, [enabled, app.events]);

	return (
		<IconBtn
			icon={I.sparkles}
			label={`Copilot: ${enabled ? "ON" : "OFF"}`}
			active={enabled}
			onClick={toggle}
		/>
	);
}
