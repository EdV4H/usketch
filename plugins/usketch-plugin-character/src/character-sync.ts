// Multiplayer via Yjs awareness (same model as the avatar plugin): each client
// publishes its own character under the `character` field; everyone reads the
// others' fields. Awareness is ephemeral — a client's character disappears when it
// disconnects — which is exactly the "coexisting live characters" semantics.
// Typed structurally so the plugin doesn't depend on @edv4h/usketch-sync.
import { wrapDeg } from "@edv4h/usketch-shared";
import type { CharacterStore } from "./character-store.js";
import type { CharacterAppearance, RemoteCharacter } from "./character-types.js";

/** The slice of a y-protocols `Awareness` this plugin uses. */
export interface CharacterAwareness {
	clientID: number;
	setLocalStateField(field: string, value: unknown): void;
	getStates(): Map<number, Record<string, unknown>>;
	on(event: "change", handler: () => void): void;
	off(event: "change", handler: () => void): void;
}

export const AWARENESS_FIELD = "character";

/** The wire shape published under the `character` awareness field. */
export interface CharacterWireState {
	x: number;
	y: number;
	heading: number;
	speed: number;
	moving: boolean;
	appearance: CharacterAppearance;
	name?: string;
}

/** Validate an untrusted awareness payload (other clients can send anything). */
export function parseWireState(v: unknown): CharacterWireState | null {
	if (!v || typeof v !== "object") return null;
	const o = v as Record<string, unknown>;
	const num = (k: string) =>
		typeof o[k] === "number" && Number.isFinite(o[k]) ? (o[k] as number) : null;
	const x = num("x");
	const y = num("y");
	const heading = num("heading");
	if (x === null || y === null || heading === null) return null;
	const appearance =
		o.appearance && typeof o.appearance === "object" && !Array.isArray(o.appearance)
			? (o.appearance as CharacterAppearance)
			: {};
	return {
		x,
		y,
		heading: wrapDeg(heading),
		speed: num("speed") ?? 0,
		moving: o.moving === true,
		appearance,
		name: typeof o.name === "string" ? o.name : undefined,
	};
}

/** Minimum interval between broadcasts (≈20 Hz) — remote views interpolate between. */
export const BROADCAST_INTERVAL_MS = 50;

export interface CharacterSync {
	/** Publish the local character now if due (throttled) or `force`d. */
	publish(force?: boolean): void;
	/** Latest received remote targets (raw, not smoothed). */
	targets(): ReadonlyMap<string, RemoteCharacter>;
	dispose(): void;
}

export function createCharacterSync(
	awareness: CharacterAwareness,
	store: CharacterStore,
	onTargetsChanged: () => void,
	now: () => number = () => Date.now(),
): CharacterSync {
	let lastSent = Number.NEGATIVE_INFINITY;
	let lastPayload: string | null = null;
	let targets: ReadonlyMap<string, RemoteCharacter> = new Map();

	const publish = (force = false): void => {
		const s = store.getState();
		const t = now();
		if (!force && t - lastSent < BROADCAST_INTERVAL_MS) return;
		const wire: CharacterWireState | null = s.enabled
			? {
					x: s.pose.x,
					y: s.pose.y,
					heading: s.pose.heading,
					speed: s.pose.speed,
					moving: s.pose.moving,
					appearance: s.appearance,
					name: s.name,
				}
			: null;
		const payload = JSON.stringify(wire);
		if (payload === lastPayload) return; // idle: don't spam awareness
		lastPayload = payload;
		lastSent = t;
		awareness.setLocalStateField(AWARENESS_FIELD, wire);
	};

	const read = (): void => {
		const next = new Map<string, RemoteCharacter>();
		for (const [clientId, st] of awareness.getStates()) {
			if (clientId === awareness.clientID) continue;
			const w = parseWireState(st?.[AWARENESS_FIELD]);
			if (!w) continue;
			const id = String(clientId);
			next.set(id, { id, ...w });
		}
		targets = next;
		onTargetsChanged();
	};

	awareness.on("change", read);
	read();

	return {
		publish,
		targets: () => targets,
		dispose() {
			awareness.off("change", read);
			// Withdraw our character so it vanishes for others right away.
			awareness.setLocalStateField(AWARENESS_FIELD, null);
		},
	};
}

/**
 * Ease displayed remote poses toward their latest targets (hides the ~20 Hz
 * update steps). Returns the next display map and whether anything is still moving.
 */
export function easeRemotes(
	display: ReadonlyMap<string, RemoteCharacter>,
	targets: ReadonlyMap<string, RemoteCharacter>,
	alpha: number,
): { next: Map<string, RemoteCharacter>; settling: boolean } {
	const next = new Map<string, RemoteCharacter>();
	let settling = false;
	for (const [id, t] of targets) {
		const d = display.get(id);
		if (!d) {
			next.set(id, t);
			continue;
		}
		const dx = t.x - d.x;
		const dy = t.y - d.y;
		const dh = wrapDeg(t.heading - d.heading);
		if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && Math.abs(dh) < 0.05) {
			next.set(id, t);
			continue;
		}
		settling = true;
		next.set(id, {
			...t,
			x: d.x + dx * alpha,
			y: d.y + dy * alpha,
			heading: wrapDeg(d.heading + dh * alpha),
		});
	}
	return { next, settling };
}
