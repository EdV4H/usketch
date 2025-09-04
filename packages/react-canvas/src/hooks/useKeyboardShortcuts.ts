import { useWhiteboardStore } from "@usketch/store";
import { useCallback, useEffect } from "react";

export const useKeyboardShortcuts = () => {
	const {
		selectedShapeIds,
		deleteShapes,
		selectAllShapes,
		clearSelection,
		undo,
		redo,
		setActiveTool,
	} = useWhiteboardStore();

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			// Don't handle shortcuts when typing in input fields
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
			const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

			// Delete selected shapes
			if (e.key === "Delete" || e.key === "Backspace") {
				if (selectedShapeIds.size > 0) {
					e.preventDefault();
					deleteShapes(Array.from(selectedShapeIds));
				}
				return;
			}

			// Escape to clear selection or cancel current operation
			if (e.key === "Escape") {
				e.preventDefault();
				clearSelection();
				setActiveTool("select");
				return;
			}

			// Select all (Cmd/Ctrl + A)
			if (cmdOrCtrl && e.key === "a") {
				e.preventDefault();
				selectAllShapes();
				return;
			}

			// Undo (Cmd/Ctrl + Z)
			if (cmdOrCtrl && e.key === "z" && !e.shiftKey) {
				e.preventDefault();
				undo();
				return;
			}

			// Redo (Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y)
			if ((cmdOrCtrl && e.key === "z" && e.shiftKey) || (cmdOrCtrl && e.key === "y")) {
				e.preventDefault();
				redo();
				return;
			}

			// Tool shortcuts (without modifiers)
			if (!cmdOrCtrl && !e.shiftKey && !e.altKey) {
				switch (e.key.toLowerCase()) {
					case "v":
					case "s":
						e.preventDefault();
						setActiveTool("select");
						break;
					case "r":
						e.preventDefault();
						setActiveTool("rectangle");
						break;
					case "o":
					case "e":
						e.preventDefault();
						setActiveTool("ellipse");
						break;
					case "d":
					case "p":
						e.preventDefault();
						setActiveTool("freedraw");
						break;
					case "h":
						e.preventDefault();
						setActiveTool("pan");
						break;
				}
			}
		},
		[selectedShapeIds, deleteShapes, selectAllShapes, clearSelection, undo, redo, setActiveTool],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [handleKeyDown]);
};
