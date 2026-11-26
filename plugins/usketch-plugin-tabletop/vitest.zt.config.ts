import { defineConfig } from "vitest/config";
export default defineConfig({
	resolve: {
		alias: [
			{
				find: "@repo/canvas-hud",
				replacement:
					"/tmp/claude-0/-home-user/036b26f9-553b-5d3f-8da5-ca59c66c3502/scratchpad/zt4/canvas-hud-stub.ts",
			},
			{
				find: "@repo/usketch-plugin-shape-we-note",
				replacement:
					"/tmp/claude-0/-home-user/036b26f9-553b-5d3f-8da5-ca59c66c3502/scratchpad/zt4/we-note-stub.ts",
			},
			{
				find: "@repo/usketch-plugin-shape-kimochi",
				replacement:
					"/tmp/claude-0/-home-user/036b26f9-553b-5d3f-8da5-ca59c66c3502/scratchpad/zt4/we-note-stub.ts",
			},
			{
				find: "@testing-library/react",
				replacement:
					"/tmp/claude-0/-home-user/036b26f9-553b-5d3f-8da5-ca59c66c3502/scratchpad/zt4/rtl-shim.tsx",
			},
			{
				find: "@atrae/wevox-ui/styled-system/css",
				replacement:
					"/tmp/claude-0/-home-user/036b26f9-553b-5d3f-8da5-ca59c66c3502/scratchpad/zt4/css-stub.ts",
			},
			{
				find: /^react-dom\/client$/,
				replacement:
					"/home/user/usketch/node_modules/.pnpm/react-dom@19.3.1_react@19.3.1/node_modules/react-dom/client.js",
			},
			{
				find: /^@atrae\/wevox-icons\/materials\/.*/,
				replacement:
					"/tmp/claude-0/-home-user/036b26f9-553b-5d3f-8da5-ca59c66c3502/scratchpad/zt4/icon-stub.ts",
			},
			{
				find: "@edv4h/usketch-plugin-tabletop",
				replacement: "/home/user/usketch/plugins/usketch-plugin-tabletop/src/index.ts",
			},
			{
				find: "@edv4h/usketch-plugin-mode7",
				replacement: "/home/user/usketch/plugins/usketch-plugin-mode7/src/index.ts",
			},
			{
				find: "@edv4h/usketch-shared",
				replacement: "/home/user/usketch/packages/shared/src/index.ts",
			},
			{
				find: "@edv4h/usketch-store",
				replacement: "/home/user/usketch/packages/store/src/index.ts",
			},
			{
				find: /^react$/,
				replacement:
					"/home/user/usketch/node_modules/.pnpm/react@19.3.1/node_modules/react/index.js",
			},
			{
				find: /^react\/jsx-dev-runtime$/,
				replacement:
					"/home/user/usketch/node_modules/.pnpm/react@19.3.1/node_modules/react/jsx-dev-runtime.js",
			},
			{
				find: /^react\/jsx-runtime$/,
				replacement:
					"/home/user/usketch/node_modules/.pnpm/react@19.3.1/node_modules/react/jsx-runtime.js",
			},
			{
				find: /^react-dom$/,
				replacement:
					"/home/user/usketch/node_modules/.pnpm/react-dom@19.3.1_react@19.3.1/node_modules/react-dom/index.js",
			},
		],
	},
	test: {
		root: "/tmp/claude-0/-home-user/036b26f9-553b-5d3f-8da5-ca59c66c3502/scratchpad/zt4",
		environment: "jsdom",
		include: ["*.test.ts", "*.test.tsx", "sub/*.test.ts"],
	},
});
