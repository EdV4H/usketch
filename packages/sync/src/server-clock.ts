/**
 * Server-time clock for features that must agree on "now" across users
 * (e.g. a shared timer). Estimates the offset between the local wall clock and
 * the server's using Cristian's algorithm — sample `GET {baseUrl}{path}` a few
 * times, and for each round trip take `offset = tServer - (t0 + t1) / 2`,
 * keeping the sample with the smallest round-trip time (its symmetric-latency
 * assumption holds best, error ≈ RTT/2). `now()` then returns server-epoch ms.
 *
 * With `baseUrl: null` (solo / offline) it degrades to the local clock
 * (offset 0) and never fetches, so callers can use one code path everywhere.
 */

export interface ServerClock {
	/** Best estimate of the server's epoch time in ms. */
	now(): number;
	/** Current local→server offset in ms (`now() === Date.now() + offset`). */
	readonly offset: number;
	/** Re-measure the offset now. Resolves once (best-effort; keeps the previous offset on failure). */
	resync(): Promise<void>;
	/** Stop periodic re-sync. */
	destroy(): void;
}

export interface ServerClockOptions {
	/** Base URL of the time endpoint, or `null` to use the local clock (offset 0). */
	baseUrl: string | null;
	/** Path appended to `baseUrl`. Default `/time` (a public, unauthenticated endpoint). */
	path?: string;
	/** Round-trip samples per `resync`. Default 5. */
	sampleCount?: number;
	/** Periodic re-sync interval in ms (0 disables). Default 60000. */
	resyncMs?: number;
	/** Injectable fetch (for tests). Defaults to global `fetch`. */
	fetchImpl?: typeof fetch;
}

interface RttSample {
	t0: number;
	t1: number;
	tServer: number;
}

/** Offset of the smallest-RTT sample (Cristian's), or null if there are none. */
export function pickBestOffset(samples: readonly RttSample[]): number | null {
	let best: { rtt: number; offset: number } | null = null;
	for (const s of samples) {
		const rtt = s.t1 - s.t0;
		const offset = s.tServer - (s.t0 + s.t1) / 2;
		if (best === null || rtt < best.rtt) best = { rtt, offset };
	}
	return best ? best.offset : null;
}

export function createServerClock(options: ServerClockOptions): ServerClock {
	const {
		baseUrl,
		path = "/time",
		sampleCount = 5,
		resyncMs = 60_000,
		fetchImpl = typeof fetch !== "undefined" ? fetch : undefined,
	} = options;

	let offset = 0;
	let interval: ReturnType<typeof setInterval> | null = null;
	const url = baseUrl != null ? `${baseUrl.replace(/\/$/, "")}${path}` : null;

	async function sampleOnce(doFetch: typeof fetch): Promise<RttSample | null> {
		const t0 = Date.now();
		try {
			const res = await doFetch(url as string, { method: "GET" });
			const t1 = Date.now();
			if (!res.ok) return null;
			const body = (await res.json()) as { t?: unknown };
			if (typeof body.t !== "number") return null;
			return { t0, t1, tServer: body.t };
		} catch {
			return null;
		}
	}

	async function resync(): Promise<void> {
		if (url == null || !fetchImpl) return; // local clock: nothing to measure
		const samples: RttSample[] = [];
		for (let i = 0; i < Math.max(1, sampleCount); i++) {
			const s = await sampleOnce(fetchImpl);
			if (s) samples.push(s);
		}
		const best = pickBestOffset(samples);
		if (best !== null) offset = best; // keep previous offset on total failure
	}

	// Kick off an initial measurement (best-effort) and periodic re-sync.
	if (url != null && fetchImpl) {
		void resync();
		if (resyncMs > 0) interval = setInterval(() => void resync(), resyncMs);
	}

	return {
		now: () => Date.now() + offset,
		get offset() {
			return offset;
		},
		resync,
		destroy() {
			if (interval != null) {
				clearInterval(interval);
				interval = null;
			}
		},
	};
}
