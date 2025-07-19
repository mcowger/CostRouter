import { z } from 'zod';
import { PricingSchema } from './pricing.schema';
import { LimitSchema } from './limits.schema';

/**
 * Zod schema for a single model configuration, including optional pricing and limits.
 */
export const ModelSchema = z.object({
  /** The name of the model as used by the provider. */
  name: z.string(),

  /**
   * Optional mapped name for the model that clients will use in requests.
   * If not provided, the 'name' field will be used for both provider calls and client requests.
   * Example: name="google/gemini-2.5-flash", mappedName="gemini-2.5-flash"
   */
  mappedName: z.string().optional(),

  /** Optional pricing info for this specific model. */
  pricing: PricingSchema.optional(),

  /** Optional rate limits for this specific model. */
  limits: LimitSchema.optional(),
});

/**
 * TypeScript type for a single model's configuration.
 */
export type Model = z.infer<typeof ModelSchema>;