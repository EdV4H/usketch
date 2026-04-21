import type { AppInstance } from "@edv4h/usketch-core";
import { useEffect, useState } from "react";
import { I, IconBtn } from "../ui/index.js";

interface Props {
	app: AppInstance;
}

/**
 * SidePanel が閉じているときに画面右端に出すトグル群。
 * 各ボタンを押すと `side-panel:open` イベントで該当タブを開く。
 */
export function SidePanelToggles({ app }: Props) {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const unsubs: (() => void)[] = [];
		unsubs.push(app.events.on("side-panel:open", () => setOpen(true)));
		unsubs.push(app.events.on("side-panel:close", () => setOpen(false)));
		unsubs.push(
			app.events.on("side-panel:toggle", () => {
				setOpen((v) => !v);
			}),
		);
		return () => {
			for (const u of unsubs) u();
		};
	}, [app]);

	if (open) return null;

	const openTab = (tabId: string) => app.events.emit("side-panel:open", { tabId });

	return (
		<div
			className="u-surface"
			style={{
				position: "fixed",
				top: 70,
				right: 12,
				zIndex: 140,
				padding: 3,
				borderRadius: 10,
				display: "flex",
				flexDirection: "column",
				gap: 1,
			}}
		>
			<IconBtn
				icon={I.comment}
				label="コメント"
				tooltipPlacement="left"
				onClick={() => openTab("comments")}
			/>
			<IconBtn
				icon={I.sparkles}
				label="AI"
				tooltipPlacement="left"
				onClick={() => openTab("ai-chat")}
			/>
			<IconBtn
				icon={I.folder}
				label="情報"
				tooltipPlacement="left"
				onClick={() => openTab("info")}
			/>
			<IconBtn
				icon={I.history}
				label="履歴"
				tooltipPlacement="left"
				onClick={() => openTab("activity")}
			/>
		</div>
	);
}
