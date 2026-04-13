import { useApp } from "@edv4h/usketch-canvas-engine";
import { useEffect, useState } from "react";
import { actionBtnStyle } from "../../lib/styles.js";

export function VoiceButton() {
	const app = useApp();
	const [listening, setListening] = useState(false);

	useEffect(() => {
		const unsub = app.events.on<{ status: string }>("voice:status", (e) => {
			setListening(e.status === "listening");
		});
		return unsub;
	}, [app.events]);

	return (
		<button
			type="button"
			onClick={() => app.events.emit("voice:toggle", {})}
			title="Voice input"
			style={{
				...actionBtnStyle,
				background: listening ? "#fce4ec" : "transparent",
				color: listening ? "#c62828" : "#999",
				fontSize: 14,
				animation: listening ? "voice-pulse 1s infinite" : "none",
			}}
		>
			🎤
		</button>
	);
}
