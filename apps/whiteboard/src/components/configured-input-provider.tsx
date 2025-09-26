import {
	type KeyBindings,
	type KeyboardPreset,
	keyboardPresets,
	type MousePreset,
	mousePresets,
} from "@usketch/input-presets";
import { InputProvider } from "@usketch/react-canvas";
import { useEffect, useState } from "react";

interface ConfiguredInputProviderProps {
	children: React.ReactNode;
	debug?: boolean;
}

export function ConfiguredInputProvider({ children, debug = false }: ConfiguredInputProviderProps) {
	const [keyboardPreset, setKeyboardPreset] = useState<KeyboardPreset | undefined>();
	const [mousePreset, setMousePreset] = useState<MousePreset | undefined>();
	const [customKeyBindings, setCustomKeyBindings] = useState<KeyBindings>({});
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		// LocalStorageから設定を読み込み
		const loadSettings = () => {
			try {
				// キーボードプリセット
				const savedKeyboardPresetId = localStorage.getItem("keyboardPreset") || "default";
				const kbPreset = keyboardPresets[savedKeyboardPresetId] || keyboardPresets["default"];
				setKeyboardPreset(kbPreset);

				// マウスプリセット
				const savedMousePresetId = localStorage.getItem("mousePreset") || "default";
				const msPreset = mousePresets[savedMousePresetId] || mousePresets["default"];
				setMousePreset(msPreset);

				// カスタムキーバインディング
				const savedCustomBindings = localStorage.getItem("customKeyboardBindings");
				if (savedCustomBindings) {
					const bindings = JSON.parse(savedCustomBindings);
					setCustomKeyBindings(bindings);
				}
			} catch (error) {
				console.error("Failed to load input settings:", error);
				// フォールバックとしてデフォルトを使用
				setKeyboardPreset(keyboardPresets["default"]);
				setMousePreset(mousePresets["default"]);
			} finally {
				setIsLoading(false);
			}
		};

		loadSettings();
	}, []);

	// ローディング中は何も表示しない
	if (isLoading || !keyboardPreset || !mousePreset) {
		return null;
	}

	return (
		<InputProvider
			keyboardPreset={keyboardPreset}
			mousePreset={mousePreset}
			customKeyBindings={customKeyBindings}
			debug={debug}
		>
			{children}
		</InputProvider>
	);
}
