import { defineCollection, z } from "astro:content";
import { file, glob } from "astro/loaders";

const docs = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/docs" }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		order: z.number().default(999),
		jpTitle: z.string().optional(),
		jpDescription: z.string().optional(),
	}),
});

const plugins = defineCollection({
	loader: file("./src/content/plugins/plugins.json"),
	schema: z.object({
		id: z.string(),
		name: z.string(),
		category: z.enum(["shape", "tool", "bg", "ai", "presence", "server", "effect", "ui"]),
		glyph: z.string().optional(),
		summary: z.string(),
		tags: z.array(z.string()).optional(),
		version: z.string().optional(),
		install: z.string().optional(),
		featured: z.boolean().optional(),
	}),
});

const examples = defineCollection({
	loader: file("./src/content/examples/examples.json"),
	schema: z.object({
		id: z.string(),
		title: z.string(),
		jpTitle: z.string().optional(),
		kind: z.string(),
		tags: z.array(z.string()).default([]),
		href: z.string().optional(),
	}),
});

const releases = defineCollection({
	loader: file("./src/content/releases/releases.json"),
	schema: z.object({
		id: z.string(),
		version: z.string(),
		date: z.string(),
		level: z.enum(["major", "minor", "patch"]).default("minor"),
		highlights: z.array(z.string()).default([]),
	}),
});

const roadmap = defineCollection({
	loader: file("./src/content/roadmap/roadmap.json"),
	schema: z.object({
		id: z.string(),
		phase: z.string(),
		title: z.string(),
		items: z.array(z.string()).default([]),
	}),
});

export const collections = { docs, plugins, examples, releases, roadmap };
