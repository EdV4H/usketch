import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://edv4h.github.io",
	base: "/usketch/",
	integrations: [
		starlight({
			title: "uSketch Plugin SDK",
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/EdV4H/usketch",
				},
			],
			sidebar: [
				{
					label: "Getting Started",
					items: [
						{ label: "Introduction", slug: "getting-started/introduction" },
						{ label: "Quick Start", slug: "getting-started/quick-start" },
						{ label: "Dev Setup", slug: "getting-started/dev-setup" },
					],
				},
				{
					label: "Core Concepts",
					items: [
						{
							label: "Plugin Architecture",
							slug: "concepts/plugin-architecture",
						},
						{ label: "Shape System", slug: "concepts/shape-system" },
						{ label: "Tool System", slug: "concepts/tool-system" },
						{ label: "Layer System", slug: "concepts/layer-system" },
						{ label: "Command System", slug: "concepts/command-system" },
						{ label: "Event Bus", slug: "concepts/event-bus" },
					],
				},
				{
					label: "Guides",
					items: [
						{
							label: "Building a Shape Plugin",
							slug: "guides/shape-plugin",
						},
						{ label: "Building a Tool Plugin", slug: "guides/tool-plugin" },
					],
				},
				{
					label: "API Reference",
					items: [
						{ label: "Shared Types", slug: "reference/shared" },
						{ label: "Core API", slug: "reference/core" },
					],
				},
			],
		}),
	],
});
