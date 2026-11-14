import type { View3dOcclusionApi } from "@edv4h/usketch-shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CharacterLayer, type CharacterOcclusion } from "../character-layer.js";
import { createCharacterStore } from "../character-store.js";
import type { CharacterRenderProps } from "../character-types.js";

function occlusionOf(api: View3dOcclusionApi | null): CharacterOcclusion {
	return { api: () => api, version: () => 0, subscribe: () => () => {} };
}

function draw(api: View3dOcclusionApi | null) {
	const seen: CharacterRenderProps[] = [];
	const store = createCharacterStore({
		enabled: true,
		renderer: (props) => {
			seen.push(props);
			return <i data-body="" />;
		},
		shadowRenderer: () => <i data-shadow="" />,
	});
	store.setPosition({ x: 100, y: 50 });
	const html = renderToStaticMarkup(
		<CharacterLayer
			store={store}
			viewport={{ x: 0, y: 0, zoom: 2 }}
			heightAt={() => 10}
			occlusion={occlusionOf(api)}
		/>,
	);
	return { html, props: seen[0] };
}

describe("a character behind the ground", () => {
	it("asks at the middle of its body and passes the look to the renderer", () => {
		const asked: number[][] = [];
		const { html, props } = draw({
			hidden: (x, y, h) => {
				asked.push([x, y, h]);
				return true;
			},
			look: () => "fade",
			subscribe: () => () => {},
		});
		// Standing on ground 10 high; 36 px on screen at zoom 2 = 18 world units tall.
		expect(asked).toEqual([[100, 50, 19]]);
		expect(props.occluded).toBe("fade");
		// The body fades itself; only its flat shadow is faded here.
		expect(html).toMatch(/data-character-shadow="self"[^>]*opacity:0.3/);
		expect(html).not.toMatch(/data-character-id="self"[^>]*opacity/);
	});

	it("isn't shown when the look is hide, and is in view without a provider", () => {
		const hidden = draw({ hidden: () => true, look: () => "hide", subscribe: () => () => {} });
		expect(hidden.props.occluded).toBe("hide");
		expect(hidden.html).toMatch(/data-character-id="self"[^>]*visibility:hidden/);
		const free = draw(null);
		expect(free.props.occluded).toBeNull();
		expect(free.html).not.toContain("visibility");
	});
});
