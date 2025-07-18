import { z } from 'zod';
import { PricingSchema } from './pricing.schema';

/**
 * Zod schema for a single model configuration, including optional pricing.
 */
export const ModelSchema = z.object({
  /** The name of the model. */
  name: z.string(),

  /** Optional pricing info for this specific model. */
  pricing: PricingSchema.optional(),
});

/**
 * TypeScript type for a single model's configuration.
 */
export type Model = z.infer<typeof ModelSchema>;