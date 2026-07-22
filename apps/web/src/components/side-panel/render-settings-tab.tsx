import type { AppInstance } from "@edv4h/usketch-core";
import { SET_VIEWPORT_LOD_EVENT } from "@edv4h/usketch-dom-renderer";
import { useState } from "react";
import {
	loadViewportLod,
	saveViewportLod,
	VIEWPORT_LOD_RATIO_MAX,
	VIEWPORT_LOD_RATIO_MIN,
} from "../../lib/render-settings.js";

interface Props {
	app: AppInstance;
}

/**
 * Render/performance settings. Currently the viewport-LOD control: toggle + a
 * ratio slider (% of the viewport kept at full detail). Changes apply live via
 * {@link SET_VIEWPORT_LOD_EVENT} and persist to localStorage.
 */
export function RenderSettingsTab({ app }: Props) {
	const [settings, setSettings] = useState(loadViewportLod);

	const apply = (next: { enabled?: boolean; ratio?: number }) => {
		const merged = { ...settings, ...next };
		setSettings(merged);
		saveViewportLod(merged);
		app.events.emit(SET_VIEWPORT_LOD_EVENT, merged);
	};

	const pct = Math.round(settings.ratio * 100);

	return (
		<div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 16 }}>
			<div>
				<label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
					<input
						type="checkbox"
						checked={settings.enabled}
						onChange={(e) => apply({ enabled: e.target.checked })}
					/>
					<span style={{ fontSize: 13, fontWeight: 600 }}>画角外を LOD 表示</span>
				</label>
				<p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
					カメラの画角外にあるシェイプを簡略描画してパフォーマンスを改善します。
				</p>
			</div>

			<div style={{ opacity: settings.enabled ? 1 : 0.4 }}>
				<div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
					<span style={{ fontWeight: 600 }}>本描画の範囲</span>
					<span style={{ fontVariantNumeric: "tabular-nums", color: "#334155" }}>{pct}%</span>
				</div>
				<input
					type="range"
					min={VIEWPORT_LOD_RATIO_MIN * 100}
					max={VIEWPORT_LOD_RATIO_MAX * 100}
					step={5}
					value={pct}
					disabled={!settings.enabled}
					onChange={(e) => apply({ ratio: Number(e.target.value) / 100 })}
					style={{ width: "100%", marginTop: 6 }}
				/>
				<p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
					画角に対する本描画領域の割合。100%＝画角ちょうど、120%＝少し外まで本描画（パン時の
					ちらつき低減）、50%＝画角内でも端は LOD。
				</p>
			</div>
		</div>
	);
}
