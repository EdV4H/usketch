import { describe, expect, it } from "vitest";
import { scopeSatoriIds } from "./exporter.js";

describe("scopeSatoriIds", () => {
	it("Satori の id と参照をシェイプごとの名前空間に分ける", () => {
		const markup =
			'<clipPath id="satori_cp-id"><rect/></clipPath><mask id="satori_om-id-0"/>' +
			'<g clip-path="url(#satori_cp-id)" mask="url(#satori_om-id-0)"><use href="#satori_s-id-0"/></g>';
		const scoped = scopeSatoriIds(markup, "note:1");
		expect(scoped).toBe(
			'<clipPath id="satori_note_1_cp-id"><rect/></clipPath><mask id="satori_note_1_om-id-0"/>' +
				'<g clip-path="url(#satori_note_1_cp-id)" mask="url(#satori_note_1_om-id-0)"><use href="#satori_note_1_s-id-0"/></g>',
		);
	});

	it("別シェイプの同じ id が衝突しない", () => {
		const markup = '<clipPath id="satori_cp-id"/>';
		expect(scopeSatoriIds(markup, "a")).not.toBe(scopeSatoriIds(markup, "b"));
	});

	it("satori_ で始まらない id や本文には触れない", () => {
		const markup = '<rect id="usketch-region"/><text>satori_cp-id</text>';
		expect(scopeSatoriIds(markup, "a")).toBe(markup);
	});
});
