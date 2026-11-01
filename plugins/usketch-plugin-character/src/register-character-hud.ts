// HUD wiring — a declarative settings group + three actions, all delegating to the
// service (no plugin-owned UI; the character's LOOK is the host's renderer).
import type { PluginContext } from "@edv4h/usketch-shared";
import type { CameraMode } from "./character-camera.js";
import { type ControlScheme, DEFAULT_JUMP } from "./character-physics.js";
import type { CharacterApi } from "./character-service.js";

const CAMERA_MODES: readonly CameraMode[] = ["fixed", "rotate", "free"];
const SCHEMES: readonly ControlScheme[] = ["directional", "vehicle"];

const truthy = (v: unknown) => v === true || v === "true";

export function registerCharacterHud(ctx: PluginContext, api: CharacterApi): () => void {
	const offSettings = ctx.hud.registerSettings({
		id: "usketch-plugin-character:settings",
		label: "キャラクター",
		order: 15,
		fields: [
			{ name: "enabled", label: "操作キャラ", type: "boolean" },
			{
				name: "cameraMode",
				label: "カメラ",
				type: "enum",
				options: [
					{ value: "fixed", label: "追従（固定）" },
					{ value: "rotate", label: "追従（向きで回転）" },
					{ value: "free", label: "追従しない" },
				],
			},
			{
				name: "controlScheme",
				label: "操作方式",
				type: "enum",
				options: [
					{ value: "directional", label: "方向移動" },
					{ value: "vehicle", label: "車（前進＋旋回）" },
				],
			},
			{ name: "drift", label: "ドリフト（車・Space）", type: "boolean" },
			{ name: "jump", label: "ジャンプ（Space）", type: "boolean" },
			{ name: "jumpHeight", label: "ジャンプの高さ", type: "number", min: 8, max: 200, step: 4 },
			{ name: "moveSpeed", label: "速度", type: "number", min: 50, max: 3000, step: 50 },
			{ name: "turnRate", label: "旋回(°/秒)", type: "number", min: 30, max: 1080, step: 30 },
			{ name: "maxStep", label: "登れる段差", type: "number", min: 0, max: 400, step: 4 },
			{ name: "anchorX", label: "画面位置 横(%)", type: "number", min: 0, max: 100, step: 5 },
			{ name: "anchorY", label: "画面位置 縦(%)", type: "number", min: 0, max: 100, step: 5 },
			{ name: "smoothing", label: "カメラ遅れ(%)", type: "number", min: 0, max: 95, step: 5 },
		],
		get(name) {
			const motion = api.getMotion();
			const anchor = api.getAnchor();
			switch (name) {
				case "enabled":
					return api.isEnabled();
				case "cameraMode":
					return api.getCameraMode();
				case "controlScheme":
					return api.getControlScheme();
				case "drift":
					return api.getDrift() !== null;
				case "jump":
					return api.getJump() !== null;
				case "jumpHeight":
					return (api.getJump() ?? DEFAULT_JUMP).height;
				case "moveSpeed":
					return motion.moveSpeed;
				case "turnRate":
					return motion.turnRate;
				case "maxStep":
					return motion.maxStep;
				case "anchorX":
					return Math.round(anchor.x * 100);
				case "anchorY":
					return Math.round(anchor.y * 100);
				case "smoothing":
					return Math.round(api.getFollowSmoothing() * 100);
				default:
					return undefined;
			}
		},
		set(name, value) {
			switch (name) {
				case "enabled":
					if (truthy(value)) api.enable();
					else api.disable();
					return;
				case "cameraMode":
					if (CAMERA_MODES.includes(value as CameraMode)) api.setCameraMode(value as CameraMode);
					return;
				case "controlScheme":
					if (SCHEMES.includes(value as ControlScheme))
						api.setControlScheme(value as ControlScheme);
					return;
				case "drift":
					api.setDrift(truthy(value));
					return;
				case "jump":
					api.setJump(truthy(value));
					return;
			}
			const n = Number(value);
			if (!Number.isFinite(n)) return;
			switch (name) {
				case "moveSpeed":
					api.setMotion({ moveSpeed: n });
					break;
				case "turnRate":
					api.setMotion({ turnRate: n });
					break;
				case "maxStep":
					api.setMotion({ maxStep: n });
					break;
				case "jumpHeight":
					// Tuning while off keeps it off (applied when jumping is turned on).
					if (api.getJump()) api.setJump({ height: n });
					break;
				case "anchorX":
					api.setAnchor({ x: n / 100 });
					break;
				case "anchorY":
					api.setAnchor({ y: n / 100 });
					break;
				case "smoothing":
					api.setFollowSmoothing(n / 100);
					break;
			}
		},
		subscribe: (listener) => api.onChange(listener),
	});

	const offToggle = ctx.actions.register({
		id: "character:toggle",
		label: "操作キャラ ON/OFF",
		group: "キャラクター",
		order: 1,
		run: () => api.toggle(),
		isActive: () => api.isEnabled(),
	});
	const offPlace = ctx.actions.register({
		id: "character:place-at-anchor",
		label: "キャラを画面位置に配置",
		group: "キャラクター",
		order: 2,
		run: () => api.placeAtAnchor(),
		isEnabled: () => api.isEnabled(),
	});

	const offJump = ctx.actions.register({
		id: "character:jump",
		label: "ジャンプ",
		group: "キャラクター",
		order: 3,
		run: () => api.jump(),
		isEnabled: () => api.isEnabled() && api.getJump() !== null,
	});

	return () => {
		offJump();
		offPlace();
		offToggle();
		offSettings();
	};
}
