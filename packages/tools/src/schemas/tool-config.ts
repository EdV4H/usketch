import type { AnyStateMachine } from "xstate";
import { z } from "zod";
import type { ToolBehaviors } from "./tool-behaviors";

// Tool configuration schema
export const ToolConfigSchema = z.object({
	id: z.string().min(1, "Tool ID is required"),
	machine: z.custom<AnyStateMachine>((val) => val && typeof val === "object", {
		message: "Invalid XState machine",
	}),
	displayName: z.string().optional(),
	icon: z.string().optional(),
	shortcut: z.string().max(1, "Shortcut must be a single character").optional(),
	enabled: z.boolean().default(true),
	metadata: z
		.object({
			author: z.string().optional(),
			version: z.string().optional(),
			description: z.string().optional(),
			category: z.string().optional(), // e.g., "drawing", "selection", "annotation"
		})
		.optional(),
	// Use any type for behaviors since function validation is limited in Zod
	behaviors: z.custom<ToolBehaviors>().optional(),
});

// Tool manager options schema
export const ToolManagerOptionsSchema = z.object({
	tools: z.array(ToolConfigSchema).min(1, "At least one tool is required"),
	defaultToolId: z.string().optional(),
	onToolChange: z.function().optional(),
	validateOnAdd: z.boolean().default(true),
	allowDuplicates: z.boolean().default(false),
});

// Type exports
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type ToolManagerOptions = z.infer<typeof ToolManagerOptionsSchema>;

// Re-export ToolBehaviors from the separate file
export type { ToolBehaviors } from "./tool-behaviors";

// Validation helpers
export const validateToolConfig = (data: unknown) => {
	return ToolConfigSchema.safeParse(data);
};

export const validateToolManagerOptions = (data: unknown) => {
	return ToolManagerOptionsSchema.safeParse(data);
};

// Error formatting helper
export function formatToolConfigError(error: z.ZodError): string {
	const errors = error.issues || [];
	return errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}
