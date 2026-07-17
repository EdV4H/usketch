import { describe, expect, it, vi } from "vitest";
import { createServerClock, pickBestOffset } from "../server-clock.js";

describe("pickBestOffset", () => {
	it("returns null for no samples", () => {
		expect(pickBestOffset([])).toBeNull();
	});

	it("selects the offset of the smallest-RTT sample (Cristian's)", () => {
		// Sample A: RTT 100ms, offset = 5000 - (0+100)/2 = 4950
		// Sample B: RTT 20ms,  offset = 5000 - (200+220)/2 = 4790  ← smallest RTT wins
		const offset = pickBestOffset([
			{ t0: 0, t1: 100, tServer: 5000 },
			{ t0: 200, t1: 220, tServer: 5000 },
		]);
		expect(offset).toBe(4790);
	});
});

describe("createServerClock", () => {
	it("uses the local clock (offset 0) when baseUrl is null and never fetches", async () => {
		const fetchImpl = vi.fn();
		const clock = createServerClock({
			baseUrl: null,
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await clock.resync();
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(clock.offset).toBe(0);
		expect(Math.abs(clock.now() - Date.now())).toBeLessThan(50);
		clock.destroy();
	});

	it("measures an offset from the server time endpoint", async () => {
		// Server is ~10s ahead of local; respond immediately.
		const fetchImpl = vi.fn(
			async () =>
				({ ok: true, json: async () => ({ t: Date.now() + 10_000 }) }) as unknown as Response,
		);
		const clock = createServerClock({
			baseUrl: "https://example.test",
			sampleCount: 3,
			resyncMs: 0,
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await clock.resync();
		expect(fetchImpl).toHaveBeenCalled();
		expect(clock.offset).toBeGreaterThan(9_000);
		expect(clock.offset).toBeLessThan(11_000);
		clock.destroy();
	});

	it("keeps the previous offset when all samples fail", async () => {
		const fetchImpl = vi.fn(async () => ({ ok: false }) as unknown as Response);
		const clock = createServerClock({
			baseUrl: "https://example.test",
			sampleCount: 2,
			resyncMs: 0,
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await clock.resync();
		expect(clock.offset).toBe(0);
		clock.destroy();
	});
});
