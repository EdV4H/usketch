import { useApp } from "@edv4h/usketch-canvas-engine";
import { useCallback, useState } from "react";
import { actionBtnStyle } from "../../lib/styles.js";

type BgType = "grid" | "dots" | "none";

const CYCLE: BgType[] = ["grid", "dots", "none"];
const LABELS: Record<BgType, string> = { grid: "#", dots: ":", none: "/" };
const TITLES: Record<BgType, string> = {
	grid: "Background: Grid",
	dots: "Background: Dots",
	none: "Background: None",
};

export function BgToggle() {
	const app = useApp();
	const [bgType, setBgType] = useState<BgType>("grid");

	const toggle = useCallback(() => {
		const idx = CYCLE.indexOf(bgType);
		const next = CYCLE[(idx + 1) % CYCLE.length];
		setBgType(next);
		app.events.emit("bg:set", { type: next });
	}, [bgType, app.events]);

	return (
		<button
			type="button"
			onClick={toggle}
			title={TITLES[bgType]}
			style={{
				...actionBtnStyle,
				background: bgType !== "none" ? "#f0f4ff" : "transparent",
				color: bgType !== "none" ? "#3b82f6" : "#999",
				fontSize: 13,
				fontFamily: "monospace",
			}}
		>
			{LABELS[bgType]}
		</button>
	);
}
