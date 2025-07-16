import { z } from "zod";

export const UsageRecordSchema = z.object({
  timestamp: z.string().datetime(),
  providerId: z.string(),
  model: z.string(),
  promptTokens: z.number().int().nonnegative().default(0),
  completionTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
  cost: z.number().nonnegative().default(0),
});

export const UsageDatabaseSchema = z.object({
  records: z.array(UsageRecordSchema),
});

export type UsageRecord = z.infer<typeof UsageRecordSchema>;
export type UsageDatabase = z.infer<typeof UsageDatabaseSchema>;