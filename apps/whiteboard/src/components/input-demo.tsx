import { useInputManager } from "@usketch/input-manager";
import { defaultKeyboardPreset, vimKeyboardPreset } from "@usketch/input-presets/keyboard";
import {
	defaultMousePreset,
	gamingMousePreset,
	trackpadMousePreset,
} from "@usketch/input-presets/mouse";
import { useEffect, useState } from "react";
import "./input-demo.css";

/**
 * 入力システムデモコンポーネント
 */
export function InputDemo() {
	const [events, setEvents] = useState<string[]>([]);
	const [keyboardPreset, setKeyboardPreset] = useState("default");
	const [mousePreset, setMousePreset] = useState("default");
	const [gestureEnabled, setGestureEnabled] = useState(true);

	// 入力マネージャーを初期化
	const inputManager = useInputManager({
		keyboardConfig: {
			preset: defaultKeyboardPreset,
			debug: true,
		},
		mouseConfig: {
			preset: defaultMousePreset,
			debug: true,
		},
		gestureConfig: {
			debug: true,
		},
		enabled: true,
	});

	// イベントログを追加
	const addEvent = (event: string) => {
		setEvents((prev) => [...prev.slice(-19), event]);
	};

	// コマンドハンドラーを登録
	useEffect(() => {
		// ツール切り替えコマンド
		inputManager.registerCommand("tool.select", () => {
			addEvent("🔧 Tool: Select");
			return true;
		});

		inputManager.registerCommand("tool.rectangle", () => {
			addEvent("⬜ Tool: Rectangle");
			return true;
		});

		inputManager.registerCommand("tool.ellipse", () => {
			addEvent("⭕ Tool: Ellipse");
			return true;
		});

		inputManager.registerCommand("tool.freedraw", () => {
			addEvent("✏️ Tool: Free Draw");
			return true;
		});

		// カメラ操作コマンド
		inputManager.registerCommand("camera.zoomIn", () => {
			addEvent("🔍 Camera: Zoom In");
			return true;
		});

		inputManager.registerCommand("camera.zoomOut", () => {
			addEvent("🔍 Camera: Zoom Out");
			return true;
		});

		inputManager.registerCommand("camera.reset", () => {
			addEvent("🎯 Camera: Reset");
			return true;
		});

		inputManager.registerCommand("camera.pan", () => {
			addEvent("🖐️ Camera: Pan");
			return true;
		});

		// 編集コマンド
		inputManager.registerCommand("edit.undo", () => {
			addEvent("↩️ Edit: Undo");
			return true;
		});

		inputManager.registerCommand("edit.redo", () => {
			addEvent("↪️ Edit: Redo");
			return true;
		});

		inputManager.registerCommand("edit.delete", () => {
			addEvent("🗑️ Edit: Delete");
			return true;
		});

		// マウスコマンド
		inputManager.registerCommand("select", () => {
			addEvent("🖱️ Mouse: Select");
			return true;
		});

		inputManager.registerCommand("contextMenu", () => {
			addEvent("📋 Mouse: Context Menu");
			return true;
		});

		inputManager.registerCommand("camera.zoom", () => {
			addEvent("🎚️ Mouse: Zoom");
			return true;
		});

		// ジェスチャーイベントのリスナー
		inputManager.gesture.on("gesture:pinch", (event: any) => {
			addEvent(`🤏 Gesture: Pinch (scale: ${event.scale?.toFixed(2)})`);
		});

		inputManager.gesture.on("gesture:rotate", (event: any) => {
			addEvent(`🔄 Gesture: Rotate (${event.rotation?.toFixed(2)}rad)`);
		});

		inputManager.gesture.on("gesture:swipe", (event: any) => {
			addEvent(`👆 Gesture: Swipe ${event.direction}`);
		});

		inputManager.gesture.on("gesture:doubleTap", () => {
			addEvent("👆👆 Gesture: Double Tap");
		});

		inputManager.gesture.on("gesture:longPress", () => {
			addEvent("👆⏳ Gesture: Long Press");
		});

		// パンイベントのリスナー
		inputManager.mouse.on("camera.pan:move", (event: any) => {
			addEvent(`🖐️ Pan: dx:${event.deltaX.toFixed(0)}, dy:${event.deltaY.toFixed(0)}`);
		});
	}, [inputManager]);

	// プリセット変更
	useEffect(() => {
		const preset = keyboardPreset === "vim" ? vimKeyboardPreset : defaultKeyboardPreset;
		inputManager.loadKeyboardPreset(preset);
	}, [keyboardPreset, inputManager]);

	useEffect(() => {
		const preset =
			mousePreset === "trackpad"
				? trackpadMousePreset
				: mousePreset === "gaming"
					? gamingMousePreset
					: defaultMousePreset;
		inputManager.loadMousePreset(preset);
	}, [mousePreset, inputManager]);

	// ジェスチャー有効/無効
	useEffect(() => {
		if (gestureEnabled) {
			inputManager.gesture.enable();
		} else {
			inputManager.gesture.disable();
		}
	}, [gestureEnabled, inputManager]);

	return (
		<div className="input-demo">
			<div className="input-demo-header">
				<h2>🎮 Input System Demo</h2>
				<p>Try keyboard shortcuts, mouse actions, and touch gestures!</p>
			</div>

			<div className="input-demo-controls">
				<div className="control-group">
					<label>
						Keyboard Preset:
						<select value={keyboardPreset} onChange={(e) => setKeyboardPreset(e.target.value)}>
							<option value="default">Default</option>
							<option value="vim">Vim</option>
						</select>
					</label>
				</div>

				<div className="control-group">
					<label>
						Mouse Preset:
						<select value={mousePreset} onChange={(e) => setMousePreset(e.target.value)}>
							<option value="default">Standard</option>
							<option value="trackpad">Trackpad</option>
							<option value="gaming">Gaming</option>
						</select>
					</label>
				</div>

				<div className="control-group">
					<label>
						<input
							type="checkbox"
							checked={gestureEnabled}
							onChange={(e) => setGestureEnabled(e.target.checked)}
						/>
						Enable Gestures
					</label>
				</div>
			</div>

			<div className="input-demo-shortcuts">
				<h3>Keyboard Shortcuts</h3>
				<div className="shortcuts-grid">
					<div>
						<strong>Tools:</strong>
						<ul>
							<li>V/S - Select Tool</li>
							<li>R - Rectangle</li>
							<li>E - Ellipse</li>
							<li>P - Free Draw</li>
						</ul>
					</div>
					<div>
						<strong>Camera:</strong>
						<ul>
							<li>Cmd/Ctrl + = - Zoom In</li>
							<li>Cmd/Ctrl + - - Zoom Out</li>
							<li>Cmd/Ctrl + 0 - Reset</li>
							<li>Space + Drag - Pan</li>
						</ul>
					</div>
					<div>
						<strong>Edit:</strong>
						<ul>
							<li>Cmd/Ctrl + Z - Undo</li>
							<li>Cmd/Ctrl + Shift + Z - Redo</li>
							<li>Delete/Backspace - Delete</li>
						</ul>
					</div>
				</div>
			</div>

			<div className="input-demo-events">
				<h3>Event Log</h3>
				<div className="events-list">
					{events.length === 0 ? (
						<div className="empty-state">No events yet. Try some inputs!</div>
					) : (
						events.map((event, index) => (
							<div key={index} className="event-item">
								{event}
							</div>
						))
					)}
				</div>
				{events.length > 0 && (
					<button type="button" onClick={() => setEvents([])} className="clear-button">
						Clear Log
					</button>
				)}
			</div>
		</div>
	);
}
