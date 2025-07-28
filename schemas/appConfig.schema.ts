import { z } from 'zod';
import { ProviderSchema } from '#schemas/provider.schema';

/**
 * Zod schema for the main application configuration file (`config.json`).
 * Defines the overall structure of the config.
 */
export const AppConfigSchema = z.object({
  /** A list of all configured LLM providers. */
  providers: z.array(ProviderSchema).default([]),

  /**
   * Stores the state of the rate limiters to persist usage data across restarts.
   * The key is the limiter's identifier (e.g., "providerId/modelName/limitType"),
   * and the value is an object containing the consumed points and the timestamp
   * of the first request in the current window.
   */
  limiterState: z.record(z.union([
    z.object({
      points: z.number().int().nonnegative(),
      ms: z.number().int().nonnegative(),
    }),
    z.object({}) // Allow empty objects for "no limit configured"
  ])).optional(),

  /** 
   * The logging level for the application.
   * Controls the verbosity of server logs.
   */
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info').optional(),
});

/**
 * TypeScript type for the main application configuration.
 * Inferred from the Zod schema.
 */
export type AppConfig = z.infer<typeof AppConfigSchema>;