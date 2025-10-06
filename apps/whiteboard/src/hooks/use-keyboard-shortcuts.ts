import { useWhiteboardStore } from "@usketch/store";
import { useEffect } from "react";
import { useToast } from "../contexts/toast-context";

interface KeyboardShortcutsOptions {
	onPanelToggle?: () => void;
}

export const useKeyboardShortcuts = ({ onPanelToggle }: KeyboardShortcutsOptions = {}) => {
	const copyStyleFromSelection = useWhiteboardStore((state) => state.copyStyleFromSelection);
	const pasteStyleToSelection = useWhiteboardStore((state) => state.pasteStyleToSelection);
	const undo = useWhiteboardStore((state) => state.undo);
	const redo = useWhiteboardStore((state) => state.redo);
	const currentTool = useWhiteboardStore((state) => state.currentTool);
	const setCurrentTool = useWhiteboardStore((state) => state.setCurrentTool);
	const { showToast } = useToast();

	useEffect(() => {
		// Track previous tool for space key toggle
		let previousTool: string | null = null;
		let isSpacePressed = false;

		const handleKeyDown = (e: KeyboardEvent) => {
			// Prevent shortcuts when typing in input fields
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			// Platform detection with fallback for deprecated navigator.platform
			const isMac = (() => {
				// Try modern approach first
				if (navigator.userAgentData?.platform) {
					return navigator.userAgentData.platform.toUpperCase().includes("MAC");
				}
				// Fallback to userAgent parsing
				if (navigator.userAgent) {
					return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
				}
				// Last resort: deprecated but still widely supported
				return navigator.platform?.toUpperCase().indexOf("MAC") >= 0;
			})();
			const modKey = isMac ? e.metaKey : e.ctrlKey;

			// Space key: Temporarily switch to pan tool
			if (e.code === "Space" && !e.repeat && !isSpacePressed) {
				e.preventDefault();
				isSpacePressed = true;
				previousTool = currentTool;
				setCurrentTool("pan");
				return;
			}

			// Cmd/Ctrl + Shift + C: Copy style
			if (modKey && e.shiftKey && e.key.toLowerCase() === "c") {
				e.preventDefault();
				const result = copyStyleFromSelection();
				if (result) {
					showToast("スタイルをコピーしました", "success");
				} else {
					showToast("形状が選択されていません", "error");
				}
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

		const handleKeyUp = (e: KeyboardEvent) => {
			// Space key release: Return to previous tool
			if (e.code === "Space" && isSpacePressed) {
				e.preventDefault();
				isSpacePressed = false;
				if (previousTool) {
					setCurrentTool(previousTool);
					previousTool = null;
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [
		copyStyleFromSelection,
		pasteStyleToSelection,
		undo,
		redo,
		currentTool,
		setCurrentTool,
		onPanelToggle,
		showToast,
	]);
};
