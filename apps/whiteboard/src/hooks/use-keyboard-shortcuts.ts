import { useWhiteboardStore } from "@usketch/store";
import { useEffect } from "react";
import { showToast } from "../components/toast";

interface KeyboardShortcutsOptions {
	onPanelToggle?: () => void;
}

export const useKeyboardShortcuts = ({ onPanelToggle }: KeyboardShortcutsOptions = {}) => {
	const copyStyleFromSelection = useWhiteboardStore((state) => state.copyStyleFromSelection);
	const pasteStyleToSelection = useWhiteboardStore((state) => state.pasteStyleToSelection);
	const undo = useWhiteboardStore((state) => state.undo);
	const redo = useWhiteboardStore((state) => state.redo);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Prevent shortcuts when typing in input fields
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
			const modKey = isMac ? e.metaKey : e.ctrlKey;

			// Cmd/Ctrl + Shift + C: Copy style
			if (modKey && e.shiftKey && e.key.toLowerCase() === "c") {
				e.preventDefault();
				copyStyleFromSelection();
				showToast("スタイルをコピーしました", "success");
				return;
			}

			// Cmd/Ctrl + Shift + V: Paste style
			if (modKey && e.shiftKey && e.key.toLowerCase() === "v") {
				e.preventDefault();
				const result = pasteStyleToSelection();
				if (result) {
					showToast("スタイルを適用しました", "success");
				} else {
					showToast("コピーされたスタイルがありません", "error");
				}
				return;
			}

			// Cmd/Ctrl + ,: Toggle property panel
			if (modKey && e.key === ",") {
				e.preventDefault();
				onPanelToggle?.();
				return;
			}

			// Cmd/Ctrl + Z: Undo (without shift)
			if (modKey && !e.shiftKey && e.key.toLowerCase() === "z") {
				e.preventDefault();
				undo();
				return;
			}

			// Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y: Redo
			if (
				(modKey && e.shiftKey && e.key.toLowerCase() === "z") ||
				(modKey && e.key.toLowerCase() === "y")
			) {
				e.preventDefault();
				redo();
				return;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [copyStyleFromSelection, pasteStyleToSelection, undo, redo, onPanelToggle]);
};
