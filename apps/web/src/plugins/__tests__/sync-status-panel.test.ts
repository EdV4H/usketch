import { describe, expect, it } from "vitest";
import { connectionStatusValue } from "../sync-status-panel.js";

describe("connectionStatusValue", () => {
	it("says something only while connecting or when the connection failed", () => {
		expect(connectionStatusValue("connecting")?.tone).toBe("warning");
		expect(connectionStatusValue("failed")?.tone).toBe("danger");
		expect(connectionStatusValue("connected")).toBeNull();
		expect(connectionStatusValue("disconnected")).toBeNull();
		expect(connectionStatusValue(null)).toBeNull();
	});

	it("returns the same object for the same state (a stable HUD snapshot)", () => {
		expect(connectionStatusValue("connecting")).toBe(connectionStatusValue("connecting"));
	});
});
