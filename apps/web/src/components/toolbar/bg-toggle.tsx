import { useApp } from "@edv4h/usketch-canvas-engine";
import { useCallback, useState } from "react";
import { I, IconBtn } from "../ui/index.js";

type BgType = "grid" | "dots" | "none";

const CYCLE: BgType[] = ["grid", "dots", "none"];
const ICONS = { grid: I.grid, dots: I.dots, none: I.bgNone };
const LABELS: Record<BgType, string> = {
	grid: "背景: グリッド",
	dots: "背景: ドット",
	none: "背景: なし",
};

export function BgToggle() {
	const app = useApp();
	const [bgType, setBgType] = useState<BgType>("grid");

	const toggle = useCallback(() => {
		const idx = CYCLE.indexOf(bgType);
		const next = CYCLE[(idx + 1) % CYCLE.length];
		if (!next) return;
		setBgType(next);
		app.events.emit("bg:set", { type: next });
	}, [bgType, app.events]);

	return (
		<IconBtn
			icon={ICONS[bgType]}
			label={LABELS[bgType]}
			active={bgType !== "none"}
			onClick={toggle}
		/>
	);
}
