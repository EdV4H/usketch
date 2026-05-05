import { describe, expect, it } from "vitest";
import { SyncStatusTracker } from "../sync-status-tracker.js";

describe("SyncStatusTracker — divergence tracking", () => {
	it("starts with empty unconfirmedShapeIds", () => {
		const t = new SyncStatusTracker();
		expect(t.getSnapshot().unconfirmedShapeIds).toEqual([]);
	});

	it("treats locally-added shapes as unconfirmed until a server sync", () => {
		const t = new SyncStatusTracker();
		t.noteShapeAdded("a", "local");
		t.noteShapeAdded("b", "local");
		expect(t.getSnapshot().unconfirmedShapeIds).toEqual(["a", "b"]);
	});

	it("treats remote-added shapes as already confirmed", () => {
		const t = new SyncStatusTracker();
		t.noteShapeAdded("a", "remote");
		expect(t.getSnapshot().unconfirmedShapeIds).toEqual([]);
	});

	it("setConfirmedFromServer promotes all current shapes to confirmed", () => {
		const t = new SyncStatusTracker();
		t.noteShapeAdded("a", "local");
		t.noteShapeAdded("b", "local");
		expect(t.getSnapshot().unconfirmedShapeIds).toHaveLength(2);

		// Sync with server: server's view contains both shapes.
		t.setConfirmedFromServer(["a", "b"]);
		expect(t.getSnapshot().unconfirmedShapeIds).toEqual([]);

		// New local add after sync diverges again until next sync.
		t.noteShapeAdded("c", "local");
		expect(t.getSnapshot().unconfirmedShapeIds).toEqual(["c"]);
	});

	it("setConfirmedFromServer with subset leaves extras unconfirmed", () => {
		// This is the "phantom shape" scenario: client has shapes the server
		// has never seen (or the server cleared them). After sync, the server's
		// view (`["a"]`) does NOT include "ghost" — so "ghost" is flagged.
		const t = new SyncStatusTracker();
		t.noteShapeAdded("a", "local");
		t.noteShapeAdded("ghost", "local");
		t.setConfirmedFromServer(["a"]);
		expect(t.getSnapshot().unconfirmedShapeIds).toEqual(["ghost"]);
	});

	it("noteShapeRemoved drops the id from both maps", () => {
		const t = new SyncStatusTracker();
		t.noteShapeAdded("a", "local");
		t.noteShapeRemoved("a");
		expect(t.getSnapshot().unconfirmedShapeIds).toEqual([]);
		expect(t.getSnapshot().shapeCount).toBe(0);
	});

	it("notifies subscribers on each mutation", () => {
		const t = new SyncStatusTracker();
		let calls = 0;
		const unsubscribe = t.subscribe(() => {
			calls++;
		});
		t.noteShapeAdded("a", "local");
		t.noteShapeAdded("b", "remote");
		t.setConfirmedFromServer(["a", "b"]);
		t.noteShapeRemoved("a");
		expect(calls).toBeGreaterThanOrEqual(4);
		unsubscribe();
	});

	it("update() (legacy state-only mutator) leaves unconfirmedShapeIds untouched", () => {
		const t = new SyncStatusTracker();
		t.noteShapeAdded("a", "local");
		t.update({ state: "synced", lastSyncedAt: 123 });
		const snap = t.getSnapshot();
		expect(snap.state).toBe("synced");
		expect(snap.lastSyncedAt).toBe(123);
		expect(snap.unconfirmedShapeIds).toEqual(["a"]);
	});
});
