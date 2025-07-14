import { z } from "zod";

/**
 * Zod schema for rate limits. All properties are optional.
 */
export const LimitSchema = z.object({
  requestsPerMinute: z.number().positive().optional(),
  requestsPerHour: z.number().positive().optional(),
  requestsPerDay: z.number().positive().optional(),
  tokensPerMinute: z.number().positive().optional(),
  tokensPerHour: z.number().positive().optional(),
  tokensPerDay: z.number().positive().optional(),
});

/**
 * TypeScript type representing a set of rate limits.
 * Inferred from the Zod schema.
 */
export type Limits = z.infer<typeof LimitSchema>;