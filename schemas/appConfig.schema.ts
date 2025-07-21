import { z } from 'zod';
import { ProviderSchema } from '@schemas/provider.schema';

/**
 * Zod schema for the main application configuration file (`config.json`).
 * Defines the overall structure of the config.
 */
export const AppConfigSchema = z.object({
    /** A list of all configured LLM providers. */
    providers: z.array(ProviderSchema).default([]),

    // This structure allows for easy addition of other top-level keys in the future.
});

/**
 * TypeScript type for the main application configuration.
 * Inferred from the Zod schema.
 */
export type AppConfig = z.infer<typeof AppConfigSchema>;