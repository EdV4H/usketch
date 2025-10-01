import type { MouseBinding } from "@usketch/input-presets";
import { useInput } from "@usketch/react-canvas";
import { useEffect, useState } from "react";

interface MouseBindingItem {
	command: string;
	label: string;
	binding: {
		button?: number | undefined;
		wheel?: boolean | "up" | "down" | undefined;
		action?: string | undefined;
		modifiers?: string[] | undefined;
		gesture?: string | undefined;
	};
}

const mouseBindingCategories = [
	{
		name: "基本操作",
		items: [
			{ command: "select", label: "選択" },
			{ command: "contextMenu", label: "コンテキストメニュー" },
			{ command: "pan", label: "画面移動" },
		],
	},
	{
		name: "修飾キー操作",
		items: [
			{ command: "multiSelect", label: "複数選択" },
			{ command: "duplicateDrag", label: "複製ドラッグ" },
			{ command: "constrainedMove", label: "制限付き移動" },
		],
	},
	{
		name: "ホイール操作",
		items: [
			{ command: "zoom", label: "ズーム" },
			{ command: "zoomPrecise", label: "精密ズーム" },
			{ command: "horizontalScroll", label: "水平スクロール" },
		],
	},
	{
		name: "ジェスチャー",
		items: [
			{ command: "rotate", label: "回転" },
			{ command: "pinchZoom", label: "ピンチズーム" },
		],
	},
];

export function MouseBindings() {
	const { mouse } = useInput();
	const [bindings, setBindings] = useState<MouseBindingItem[]>([]);

	useEffect(() => {
		if (!mouse) return;

		// 現在のマウスバインディングを取得
		const mouseBindings = mouse.getBindings() as Record<string, MouseBinding>;
		const items: MouseBindingItem[] = [];

		mouseBindingCategories.forEach((category) => {
			category.items.forEach((item) => {
				const binding = mouseBindings[item.command];
				if (binding) {
					items.push({
						command: item.command,
						label: item.label,
						binding,
					});
				}
			});
		});

		setBindings(items);
	}, [mouse]);

	const formatButton = (button?: number) => {
		switch (button) {
			case 0:
				return "左クリック";
			case 1:
				return "中クリック";
			case 2:
				return "右クリック";
			default:
				return `ボタン${button}`;
		}
	};

	const formatModifiers = (modifiers?: string[]) => {
		if (!modifiers || modifiers.length === 0) return "";
		return `${modifiers
			.map((mod) => {
				switch (mod) {
					case "mod":
						return "⌘/Ctrl";
					case "shift":
						return "Shift";
					case "alt":
						return "Alt";
					default:
						return mod;
				}
			})
			.join(" + ")} + `;
	};

	const formatBinding = (binding: MouseBindingItem["binding"]) => {
		if (binding.wheel) {
			return `${formatModifiers(binding.modifiers)}マウスホイール`;
		}

		if (binding.gesture) {
			switch (binding.gesture) {
				case "pinch":
					return "ピンチジェスチャー";
				case "rotate":
					return "回転ジェスチャー";
				default:
					return binding.gesture;
			}
		}

		let result = formatModifiers(binding.modifiers);
		result += formatButton(binding.button);

		if (binding.action === "drag") {
			result += " + ドラッグ";
		}

		return result;
	};

	return (
		<div className="mouse-bindings">
			<div className="bindings-info">
				<p>マウスバインディングは現在のプリセットに基づいています。</p>
				<p>カスタマイズするには、プリセットタブから別のプリセットを選択してください。</p>
			</div>

			<div className="bindings-list">
				{mouseBindingCategories.map((category) => {
					const categoryBindings = bindings.filter((b) =>
						category.items.some((item) => item.command === b.command),
					);

					if (categoryBindings.length === 0) return null;

					return (
						<div key={category.name} className="binding-category">
							<h3>{category.name}</h3>
							<div className="binding-items">
								{categoryBindings.map((binding) => (
									<div key={binding.command} className="binding-item">
										<span className="binding-label">{binding.label}</span>
										<span className="binding-value">{formatBinding(binding.binding)}</span>
									</div>
								))}
							</div>
						</div>
					);
				})}
			</div>

			<div className="gesture-settings">
				<h3>ジェスチャー設定</h3>
				<div className="setting-item">
					<label>
						<span>ピンチ感度</span>
						<input
							type="range"
							min="0.5"
							max="2"
							step="0.1"
							defaultValue="1"
							onChange={(e) => {
								// 感度設定をLocalStorageに保存
								localStorage.setItem("pinchSensitivity", e.target.value);
							}}
						/>
					</label>
				</div>
				<div className="setting-item">
					<label>
						<span>回転感度</span>
						<input
							type="range"
							min="0.5"
							max="2"
							step="0.1"
							defaultValue="1"
							onChange={(e) => {
								// 感度設定をLocalStorageに保存
								localStorage.setItem("rotateSensitivity", e.target.value);
							}}
						/>
					</label>
				</div>
			</div>
		</div>
	);
}
