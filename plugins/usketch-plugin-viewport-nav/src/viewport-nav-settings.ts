import type { WheelDevice } from "./wheel-device.js";

/** 値そのものか、イベントごとに読む getter。 */
export type Live<T> = T | (() => T);

/** どのデバイスの感度を使うか。`"auto"` はイベントごとに推定する。 */
export type WheelDeviceMode = "auto" | WheelDevice;

/** 1 デバイス分の感度。`1` が既定で従来相当。 */
export interface WheelSensitivity {
	/** スクロール（パン）の速さ。delta に掛ける倍率。 */
	pan: number;
	/** ズームの速さ。`exp(-deltaY × 0.001 × zoom)` の係数。 */
	zoom: number;
}

/** 実際に使われている設定（ホストの options と利用者の上書きを合わせ、範囲にクランプ済み）。 */
export interface ViewportNavSettings {
	deviceMode: WheelDeviceMode;
	mouse: WheelSensitivity;
	trackpad: WheelSensitivity;
}

/** 利用者による上書き（HUD / サービスから設定し、storage に保存される）。 */
export interface ViewportNavSettingsPatch {
	deviceMode?: WheelDeviceMode;
	mouse?: Partial<WheelSensitivity>;
	trackpad?: Partial<WheelSensitivity>;
}

export interface SensitivityRange {
	min: number;
	max: number;
}

/** デバイスごとの感度オプション。省略した項目は共通の `zoomSensitivity` / `panSensitivity` を使う。 */
export interface DeviceSensitivityOptions {
	zoomSensitivity?: Live<number>;
	panSensitivity?: Live<number>;
}

/** 上書き設定の保存先。 */
export interface ViewportNavStorage {
	/** 保存済みの上書き。無ければ `null` / `undefined`。中身は読み込み時に検証される。 */
	load(): unknown;
	save(patch: ViewportNavSettingsPatch): void;
}

export interface ViewportNavOptions {
	/**
	 * ズーム感度（マウス / トラックパッド共通）。`1` が既定で従来相当。
	 * 大きいほど 1 操作あたりの倍率変化が大きくなる（{@link ViewportNavOptions.zoomSensitivityRange} にクランプ）。
	 *
	 * 設定 UI からの即時反映のため、値だけでなく「ライブに読む getter」も渡せる。
	 * getter は wheel イベントごとに評価される。
	 */
	zoomSensitivity?: Live<number>;
	/**
	 * スクロール（パン）感度（マウス / トラックパッド共通）。`1` が既定で従来どおり delta そのまま。
	 * {@link ViewportNavOptions.panSensitivityRange} にクランプ。getter も渡せる。
	 */
	panSensitivity?: Live<number>;
	/** マウスホイールだけの感度。指定した項目は共通の値より優先する。 */
	mouse?: DeviceSensitivityOptions;
	/** トラックパッド（2 本指スクロール / ピンチ）だけの感度。指定した項目は共通の値より優先する。 */
	trackpad?: DeviceSensitivityOptions;
	/**
	 * どのデバイスの感度を使うか。既定 `"auto"`（イベントごとに推定）。
	 * 推定が外れる環境向けに `"mouse"` / `"trackpad"` で固定できる。
	 */
	deviceMode?: Live<WheelDeviceMode>;
	/**
	 * zoomSensitivity のクランプ範囲。既定 `{ min: 0.25, max: 6 }`。
	 * タッチ/トラックパッド主体のホストが可動域を広げる/狭める用途に使う。
	 * `min <= max` を満たさない/非有限な指定は無視して既定にフォールバックする。
	 */
	zoomSensitivityRange?: { min?: number; max?: number };
	/** panSensitivity のクランプ範囲。既定 `{ min: 0.1, max: 5 }`。 */
	panSensitivityRange?: { min?: number; max?: number };
	/**
	 * 利用者が HUD から感度を変えられるようにするか。既定 `true`。
	 * ホストが自前の設定 UI を持つ場合は `false` にして、サービス（`getViewportNavApi`）か options を使う。
	 */
	hud?: boolean;
	/**
	 * 利用者の上書きの保存先。既定は localStorage の `usketch:viewport-nav`。
	 * `false` で保存しない（リロードで元に戻る）。
	 */
	storage?: ViewportNavStorage | false;
}

export const DEFAULT_ZOOM_SENSITIVITY_RANGE: SensitivityRange = { min: 0.25, max: 6 };
export const DEFAULT_PAN_SENSITIVITY_RANGE: SensitivityRange = { min: 0.1, max: 5 };

/** オプションの範囲指定を検証済みの {min,max} に解決する（不正値は既定へフォールバック）。 */
export function resolveRange(
	range: { min?: number; max?: number } | undefined,
	fallback: SensitivityRange,
): SensitivityRange {
	const min =
		typeof range?.min === "number" && Number.isFinite(range.min) ? range.min : fallback.min;
	const max =
		typeof range?.max === "number" && Number.isFinite(range.max) ? range.max : fallback.max;
	// 破綻した範囲（min > max）は既定に戻す。
	if (min > max) return { ...fallback };
	return { min, max };
}

function readLive<T>(source: Live<T> | undefined): T | undefined {
	return typeof source === "function" ? (source as () => T)() : source;
}

/**
 * 候補を前から順に読み、最初に指定されているものを range へクランプして返す。
 * 指定はあるが不正（NaN など）なら 1（既定感度）。何も指定が無ければ 1。
 */
export function resolveSensitivity(
	sources: readonly (Live<number> | undefined)[],
	range: SensitivityRange,
): number {
	for (const source of sources) {
		if (source === undefined) continue;
		const raw = readLive(source);
		if (raw === undefined) continue;
		if (typeof raw !== "number" || !Number.isFinite(raw)) return clamp(1, range);
		return clamp(raw, range);
	}
	return clamp(1, range);
}

function clamp(value: number, range: SensitivityRange): number {
	return Math.min(range.max, Math.max(range.min, value));
}

function isDeviceMode(value: unknown): value is WheelDeviceMode {
	return value === "auto" || value === "mouse" || value === "trackpad";
}

function sanitizeSensitivity(value: unknown): Partial<WheelSensitivity> | undefined {
	if (!value || typeof value !== "object") return undefined;
	const v = value as Record<string, unknown>;
	const out: Partial<WheelSensitivity> = {};
	if (typeof v.pan === "number" && Number.isFinite(v.pan)) out.pan = v.pan;
	if (typeof v.zoom === "number" && Number.isFinite(v.zoom)) out.zoom = v.zoom;
	return Object.keys(out).length > 0 ? out : undefined;
}

/** 保存データや外部入力を検証し、正しい項目だけを残した上書きにする。 */
export function sanitizeSettingsPatch(value: unknown): ViewportNavSettingsPatch {
	if (!value || typeof value !== "object") return {};
	const v = value as Record<string, unknown>;
	const out: ViewportNavSettingsPatch = {};
	if (isDeviceMode(v.deviceMode)) out.deviceMode = v.deviceMode;
	const mouse = sanitizeSensitivity(v.mouse);
	if (mouse) out.mouse = mouse;
	const trackpad = sanitizeSensitivity(v.trackpad);
	if (trackpad) out.trackpad = trackpad;
	return out;
}

/** 上書き `base` に `patch` を重ねる（どちらも検証済みであること）。 */
export function mergeSettingsPatch(
	base: ViewportNavSettingsPatch,
	patch: ViewportNavSettingsPatch,
): ViewportNavSettingsPatch {
	const out: ViewportNavSettingsPatch = { ...base };
	if (patch.deviceMode) out.deviceMode = patch.deviceMode;
	if (patch.mouse) out.mouse = { ...base.mouse, ...patch.mouse };
	if (patch.trackpad) out.trackpad = { ...base.trackpad, ...patch.trackpad };
	return out;
}

/**
 * 実効設定を返す関数を作る。優先順位は「利用者の上書き > デバイス別 options > 共通 options > 1」。
 * 範囲は作成時に一度だけ解決する（感度の getter は呼ぶたびに評価）。
 */
export function createSettingsResolver(
	options: ViewportNavOptions | undefined,
	getOverrides: () => ViewportNavSettingsPatch,
): { resolve: () => ViewportNavSettings; zoomRange: SensitivityRange; panRange: SensitivityRange } {
	const zoomRange = resolveRange(options?.zoomSensitivityRange, DEFAULT_ZOOM_SENSITIVITY_RANGE);
	const panRange = resolveRange(options?.panSensitivityRange, DEFAULT_PAN_SENSITIVITY_RANGE);

	const device = (name: WheelDevice, overrides: ViewportNavSettingsPatch): WheelSensitivity => ({
		pan: resolveSensitivity(
			[overrides[name]?.pan, options?.[name]?.panSensitivity, options?.panSensitivity],
			panRange,
		),
		zoom: resolveSensitivity(
			[overrides[name]?.zoom, options?.[name]?.zoomSensitivity, options?.zoomSensitivity],
			zoomRange,
		),
	});

	const resolve = (): ViewportNavSettings => {
		const overrides = getOverrides();
		const optionMode = readLive(options?.deviceMode);
		return {
			deviceMode: overrides.deviceMode ?? (isDeviceMode(optionMode) ? optionMode : "auto"),
			mouse: device("mouse", overrides),
			trackpad: device("trackpad", overrides),
		};
	};

	return { resolve, zoomRange, panRange };
}

/** localStorage に上書きを保存する storage。使えない環境（SSR / プライベートモード等）では何もしない。 */
export function localStorageViewportNavStorage(key = "usketch:viewport-nav"): ViewportNavStorage {
	return {
		load() {
			try {
				const raw = globalThis.localStorage?.getItem(key);
				return raw ? JSON.parse(raw) : null;
			} catch {
				return null;
			}
		},
		save(patch) {
			try {
				globalThis.localStorage?.setItem(key, JSON.stringify(patch));
			} catch {
				// 保存できなくても操作は続けられる。
			}
		},
	};
}
