// Follows the board's 3D view (the shared `view3dService`, provided by e.g. the Mode 7
// plugin) without depending on it. The provider may set up after this plugin, so the
// service is looked up after setup and again whenever a 3D stage starts / stops, and
// subscribed to once found. Absent provider = always flat.
import { type EventBus, type ServiceRegistry, view3dService } from "@edv4h/usketch-shared";

/** Emitted with `{ active }` by a 3D view when it starts / stops showing the board. */
export const STAGE_3D_EVENT = "usketch:stage-3d";

export interface View3dSnapshot {
	/** 0 (flat) … 1 (3D). */
	amount: number;
	/** The camera's FULL yaw (deg), not scaled by the transition. */
	yaw: number;
}

const FLAT: View3dSnapshot = { amount: 0, yaw: 0 };

export interface View3dTracker {
	/** The current state (a stable object until it changes). */
	get(): View3dSnapshot;
	subscribe(listener: () => void): () => void;
	dispose(): void;
}

export function createView3dTracker(services: ServiceRegistry, events: EventBus): View3dTracker {
	let snapshot = FLAT;
	let unsubscribeApi: (() => void) | null = null;
	let attached: unknown = null;
	const listeners = new Set<() => void>();

	const read = (): void => {
		const api = view3dService.get(services);
		let next = FLAT;
		if (api) {
			const amount = api.amount();
			const cam = api.camera();
			// The service hands out the drawn camera (yaw × amount); recover the full yaw
			// so a sign turns to face the camera as the view rises, not with it.
			const yaw = amount > 0 ? cam.yaw / amount : 0;
			next = { amount: Number.isFinite(amount) ? amount : 0, yaw: Number.isFinite(yaw) ? yaw : 0 };
		}
		if (next.amount === snapshot.amount && next.yaw === snapshot.yaw) return;
		snapshot = next;
		for (const l of [...listeners]) l();
	};

	let disposed = false;
	const attach = (): void => {
		if (disposed) return;
		const api = view3dService.get(services);
		if (api === attached) return;
		unsubscribeApi?.();
		unsubscribeApi = null;
		attached = api ?? null;
		if (api) unsubscribeApi = api.subscribe(read);
		read();
	};

	// The stage event may fire during the provider's own setup, before it provides the
	// service: look again once that setup has finished.
	const offStage = events.on(STAGE_3D_EVENT, () => {
		attach();
		queueMicrotask(attach);
	});
	queueMicrotask(attach);

	return {
		get: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		dispose() {
			disposed = true;
			offStage();
			unsubscribeApi?.();
			unsubscribeApi = null;
			listeners.clear();
		},
	};
}
