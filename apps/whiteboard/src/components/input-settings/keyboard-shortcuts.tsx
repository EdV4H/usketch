import { defaultKeymap } from "@usketch/input-presets";
import { useInput } from "@usketch/react-canvas";
import { useEffect, useState } from "react";

interface ShortcutItem {
	command: string;
	label: string;
	keys: string[];
	category: string;
}

const shortcutCategories = [
	{
		name: "ツール",
		items: [
			{ command: "select", label: "選択ツール", category: "ツール" },
			{ command: "rectangle", label: "矩形ツール", category: "ツール" },
			{ command: "ellipse", label: "楕円ツール", category: "ツール" },
			{ command: "freedraw", label: "フリードロー", category: "ツール" },
			{ command: "pan", label: "パンツール", category: "ツール" },
		],
	},
	{
		name: "基本操作",
		items: [
			{ command: "delete", label: "削除", category: "基本操作" },
			{ command: "selectAll", label: "すべて選択", category: "基本操作" },
			{ command: "undo", label: "元に戻す", category: "基本操作" },
			{ command: "redo", label: "やり直し", category: "基本操作" },
			{ command: "escape", label: "キャンセル", category: "基本操作" },
		],
	},
	{
		name: "整列",
		items: [
			{ command: "alignLeft", label: "左揃え", category: "整列" },
			{ command: "alignRight", label: "右揃え", category: "整列" },
			{ command: "alignTop", label: "上揃え", category: "整列" },
			{ command: "alignBottom", label: "下揃え", category: "整列" },
			{ command: "alignCenterH", label: "水平中央揃え", category: "整列" },
			{ command: "alignCenterV", label: "垂直中央揃え", category: "整列" },
		],
	},
	{
		name: "ズーム・カメラ",
		items: [
			{ command: "zoomIn", label: "ズームイン", category: "ズーム・カメラ" },
			{ command: "zoomOut", label: "ズームアウト", category: "ズーム・カメラ" },
			{ command: "zoomReset", label: "ズームリセット", category: "ズーム・カメラ" },
			{ command: "zoomToFit", label: "全体表示", category: "ズーム・カメラ" },
			{ command: "zoomToSelection", label: "選択部分にズーム", category: "ズーム・カメラ" },
			{ command: "panUp", label: "上にパン", category: "ズーム・カメラ" },
			{ command: "panDown", label: "下にパン", category: "ズーム・カメラ" },
			{ command: "panLeft", label: "左にパン", category: "ズーム・カメラ" },
			{ command: "panRight", label: "右にパン", category: "ズーム・カメラ" },
		],
	},
	{
		name: "スナップ",
		items: [
			{ command: "toggleGridSnap", label: "グリッドスナップ", category: "スナップ" },
			{ command: "toggleShapeSnap", label: "図形スナップ", category: "スナップ" },
		],
	},
	{
		name: "スタイル",
		items: [
			{ command: "copyStyle", label: "スタイルコピー", category: "スタイル" },
			{ command: "pasteStyle", label: "スタイルペースト", category: "スタイル" },
		],
	},
	{
		name: "UI",
		items: [
			{ command: "togglePropertyPanel", label: "プロパティパネル", category: "UI" },
			{ command: "toggleDebugPanel", label: "デバッグパネル", category: "UI" },
		],
	},
];

function getCommandCategory(command: string): string {
	// Find category for the command
	for (const category of shortcutCategories) {
		for (const item of category.items) {
			if (item.command === command) {
				return item.category;
			}
		}
	}
	// Default category for unknown commands
	return "Custom";
}

export function KeyboardShortcuts() {
	const { keyboard } = useInput();
	const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
	const [editingCommand, setEditingCommand] = useState<string | null>(null);
	const [recordingKeys, setRecordingKeys] = useState<string[]>([]);
	const [searchTerm, setSearchTerm] = useState("");

	useEffect(() => {
		if (!keyboard) return;

		// 現在のキーバインディングを取得
		const bindings = keyboard.getBindings() as Record<string, string[]>;
		const items: ShortcutItem[] = [];

		shortcutCategories.forEach((category) => {
			category.items.forEach((item) => {
				const keys = bindings[item.command] || [];
				items.push({
					...item,
					keys: Array.isArray(keys) ? keys : [keys],
				});
			});
		});

		setShortcuts(items);
	}, [keyboard]);

	const handleEdit = (command: string) => {
		setEditingCommand(command);
		setRecordingKeys([]);
	};

	const handleKeyRecord = (e: React.KeyboardEvent) => {
		if (editingCommand === null) return;
		e.preventDefault();

		const key = e.key;
		const modifiers: string[] = [];
		if (e.metaKey || e.ctrlKey) modifiers.push("mod");
		if (e.altKey) modifiers.push("alt");
		if (e.shiftKey) modifiers.push("shift");

		const keyCombo = [...modifiers, key].join("+");
		setRecordingKeys([keyCombo]);
	};

	const handleSave = () => {
		if (!keyboard || editingCommand === null || recordingKeys.length === 0) return;

		// Set new binding dynamically
		keyboard.setBinding(editingCommand, recordingKeys);

		// Save to LocalStorage
		const customBindings = JSON.parse(localStorage.getItem("customKeyboardBindings") || "{}");
		customBindings[editingCommand] = recordingKeys;
		localStorage.setItem("customKeyboardBindings", JSON.stringify(customBindings));

		// Update local state to reflect changes immediately
		const updatedBindings = keyboard.getBindings();
		const newShortcuts = Object.entries(updatedBindings).map(([command, keys]) => ({
			label: command.charAt(0).toUpperCase() + command.slice(1).replace(/([A-Z])/g, " $1"),
			keys: keys as string[],
			command,
			category: getCommandCategory(command),
		}));
		setShortcuts(newShortcuts);

		setEditingCommand(null);
		setRecordingKeys([]);
	};

	const handleCancel = () => {
		setEditingCommand(null);
		setRecordingKeys([]);
	};

	const handleReset = (command: string) => {
		if (!keyboard) return;

		// Remove custom binding
		const customBindings = JSON.parse(localStorage.getItem("customKeyboardBindings") || "{}");
		delete customBindings[command];
		localStorage.setItem("customKeyboardBindings", JSON.stringify(customBindings));

		// Reset to default binding from preset
		if (defaultKeymap?.bindings[command]) {
			keyboard.setBinding(command, defaultKeymap.bindings[command]);
		}

		// Update local state immediately
		const updatedBindings = keyboard.getBindings();
		const newShortcuts = Object.entries(updatedBindings).map(([cmd, keys]) => ({
			label: cmd.charAt(0).toUpperCase() + cmd.slice(1).replace(/([A-Z])/g, " $1"),
			keys: keys as string[],
			command: cmd,
			category: getCommandCategory(cmd),
		}));
		setShortcuts(newShortcuts);
	};

	const filteredShortcuts = shortcuts.filter(
		(shortcut) =>
			shortcut.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
			shortcut.keys.some((key) => key.toLowerCase().includes(searchTerm.toLowerCase())),
	);

	const formatKey = (key: string) => {
		return key
			.replace(/mod/g, "⌘/Ctrl")
			.replace(/shift/g, "Shift")
			.replace(/alt/g, "Alt")
			.replace(/\+/g, " + ");
	};

	return (
		<div className="keyboard-shortcuts">
			<div className="shortcuts-header">
				<input
					type="text"
					placeholder="ショートカットを検索..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className="search-input"
				/>
			</div>

			<div className="shortcuts-list">
				{shortcutCategories.map((category) => {
					const categoryShortcuts = filteredShortcuts.filter((s) => s.category === category.name);

					if (categoryShortcuts.length === 0) return null;

					return (
						<div key={category.name} className="shortcut-category">
							<h3>{category.name}</h3>
							<div className="shortcut-items">
								{categoryShortcuts.map((shortcut) => (
									<div key={shortcut.command} className="shortcut-item">
										<span className="shortcut-label">{shortcut.label}</span>
										<div className="shortcut-keys">
											{editingCommand === shortcut.command ? (
												<div className="key-recorder">
													<input
														type="text"
														value={recordingKeys.map(formatKey).join(", ")}
														onKeyDown={handleKeyRecord}
														placeholder="キーを押してください..."
													/>
													<button type="button" onClick={handleSave}>
														保存
													</button>
													<button type="button" onClick={handleCancel}>
														キャンセル
													</button>
												</div>
											) : (
												<>
													{shortcut.keys.map((key, index) => (
														<span key={index} className="key-badge">
															{formatKey(key)}
														</span>
													))}
													<button
														type="button"
														className="edit-button"
														onClick={() => handleEdit(shortcut.command)}
													>
														編集
													</button>
													<button
														type="button"
														className="reset-button"
														onClick={() => handleReset(shortcut.command)}
													>
														リセット
													</button>
												</>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
