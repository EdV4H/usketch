import { useApp } from "@edv4h/usketch-canvas-engine";
import { useEffect, useState } from "react";
import { I, IconBtn } from "../ui/index.js";

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
		<IconBtn
			icon={I.mic}
			label={listening ? "音声入力（認識中）" : "音声入力"}
			active={listening}
			danger={listening}
			onClick={() => app.events.emit("voice:toggle", {})}
		/>
	);
}
