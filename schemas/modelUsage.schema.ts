import { z } from "zod";

export const LimitUsageSchema = z.object({
  consumed: z.number(),
  limit: z.number(),
  percentage: z.number(),
  msBeforeNext: z.number(),
  unit: z.enum(['requests', 'tokens', 'USD']),
});

export const ModelUsageSchema = z.object({
  name: z.string(),
  mappedName: z.string().optional(),
  limits: z.record(LimitUsageSchema),
});

export const ModelUsageResponseSchema = z.object({
  providerId: z.string(),
  model: ModelUsageSchema,
});