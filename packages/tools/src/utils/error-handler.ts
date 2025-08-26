import { z } from "zod";

/**
 * Custom error class for tool validation errors
 */
export class ToolValidationError extends Error {
	constructor(
		message: string,
		public zodError?: z.ZodError,
		public toolId?: string,
	) {
		super(message);
		this.name = "ToolValidationError";
	}
}

/**
 * Format Zod error into a readable string
 */
export function formatZodError(error: z.ZodError): string {
	const errors = error.issues || [];
	return errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}

/**
 * Get user-friendly error message from various error types
 */
export function getToolErrorMessage(error: unknown): string {
	if (error instanceof ToolValidationError) {
		if (error.zodError) {
			return `Invalid tool configuration: ${formatZodError(error.zodError)}`;
		}
		return error.message;
	}

	if (error instanceof z.ZodError) {
		return `Validation failed: ${formatZodError(error)}`;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return "An unexpected error occurred";
}
