import { z } from 'zod';
import { LimitSchema } from './limits.schema.js';
import { PricingSchema } from './pricing.schema.js';

/**
 * Zod schema for a single LLM provider configuration.
 */
export const ProviderSchema = z
  .object({
    /** A unique system identifier, 32 characters max. */
    id: z.string().max(32),

    /** The type of provider ('openai' requires baseURL and apiKey) */
    type: z.enum(["openai", "custom", "copilot"]),

    /** The base URL (required if type is 'openai') */
    baseURL: z.string().url().optional(),

    /** The API key (required if type is 'openai') */
    apiKey: z.string().optional(),

    /** Optional rate limits */
    limits: LimitSchema.optional(),

    /** Optional pricing info */
    pricing: PricingSchema.optional(),

    /** Supported models (always required) */
    models: z.array(z.string()).min(1, "At least one model must be listed"),
  })
  .refine((data) => data.type !== "openai" || (data.baseURL && data.apiKey), {
    message: "Both baseURL and apiKey are required when type is 'openai'",
    path: ["baseURL", "apiKey"], 
  });

/**
 * TypeScript type representing a single LLM provider's configuration.
 * Inferred from the Zod schema.
 */
export type Provider = z.infer<typeof ProviderSchema>;