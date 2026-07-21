import type { AppInstance } from "@edv4h/usketch-core";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { I } from "../components/ui/index.js";
import { setTheme } from "./theme.js";

/**
 * アプリ横断の操作（AI / 編集 / テーマ / 遷移 / プレゼン）を共有の
 * {@link AppInstance.actions} レジストリに登録する。これにより
 * コマンドパレット（⌘K）と Control HUD の Controls ドックが**同一の
 * アクションレジストリ**を単一ソースとして参照できる（旧: パレット側の
 * ハードコードリスト）。cloud 限定の項目はガードする。
 */
export function useAppActions(
	app: AppInstance | null,
	boardId: string | undefined,
	isCloudBoard: boolean,
): void {
	const navigate = useNavigate();

	useEffect(() => {
		if (!app) return;
		const offs: Array<() => void> = [];
		const reg = (a: Parameters<AppInstance["actions"]["register"]>[0]) => {
			offs.push(app.actions.register(a));
		};

		if (isCloudBoard) {
			reg({
				id: "ai:summarize",
				group: "AI",
				label: "このボードを要約",
				icon: () => <I.sparkles size={14} />,
				run: () => app.events.emit("ai:request", { prompt: "このボードの内容を要約して" }),
			});
			reg({
				id: "ai:align",
				group: "AI",
				label: "フローチャートを整列する",
				icon: () => <I.wand size={14} />,
				run: () => app.events.emit("ai:request", { prompt: "フローチャートを整列して" }),
			});
			reg({
				id: "ai:translate",
				group: "AI",
				label: "選択を英語に翻訳",
				icon: () => <I.translate size={14} />,
				run: () => app.events.emit("ai:request", { prompt: "選択を英語に翻訳して" }),
			});
			reg({
				id: "ai:image",
				group: "AI",
				label: "画像を生成…",
				icon: () => <I.image size={14} />,
				run: () => app.events.emit("ai:image:open", {}),
			});
		}

		reg({
			id: "edit:frame",
			group: "アクション",
			label: "フレームを追加",
			icon: () => <I.frame size={14} />,
			run: () => app.store.setActiveToolId("frame"),
		});
		reg({
			id: "edit:undo",
			group: "アクション",
			label: "元に戻す",
			icon: () => <I.undo size={14} />,
			run: () => app.commands.undo(),
		});
		reg({
			id: "edit:redo",
			group: "アクション",
			label: "やり直す",
			icon: () => <I.redo size={14} />,
			run: () => app.commands.redo(),
		});
		if (isCloudBoard && boardId) {
			reg({
				id: "edit:present",
				group: "アクション",
				label: "プレゼンテーションを開始",
				icon: () => <I.present size={14} />,
				run: () => navigate(`/boards/${boardId}?present=1`),
			});
		}

		reg({
			id: "theme:light",
			group: "テーマ",
			label: "テーマ切替: ライト",
			icon: () => <I.sun size={14} />,
			run: () => setTheme("light"),
		});
		reg({
			id: "theme:dark",
			group: "テーマ",
			label: "テーマ切替: ダーク",
			icon: () => <I.moon size={14} />,
			run: () => setTheme("dark"),
		});
		reg({
			id: "theme:system",
			group: "テーマ",
			label: "テーマ切替: システム",
			icon: () => <I.monitor size={14} />,
			run: () => setTheme("system"),
		});

		reg({
			id: "nav:dashboard",
			group: "移動",
			label: "ダッシュボードへ戻る",
			icon: () => <I.home size={14} />,
			run: () => navigate("/dashboard"),
		});
		reg({
			id: "nav:community",
			group: "移動",
			label: "コミュニティマップ",
			icon: () => <I.community size={14} />,
			run: () => navigate("/community"),
		});

		return () => {
			for (const off of offs) off();
		};
	}, [app, boardId, isCloudBoard, navigate]);
}
