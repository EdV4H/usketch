import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";

export default defineConfig({
	site: "https://edv4h.github.io",
	base: "/usketch/",
	integrations: [react(), mdx()],
	markdown: {
		rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]],
	},
});
