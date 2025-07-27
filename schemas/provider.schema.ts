import { z } from 'zod';
import { ModelSchema } from '#schemas/model.schema';

/**
 * Supported AI SDK v5 provider types
 */
export const ProviderTypeSchema = z.enum([
  // Native AI SDK providers
  "openai",
  "anthropic",
  "google",
  "google-vertex",
  "azure",
  "bedrock",
  "groq",
  "mistral",
  "deepseek",
  "xai",
  "perplexity",
  "togetherai",

  // Third-party providers
  "openrouter",
  "ollama",
  "qwen",

  // OpenAI-compatible and custom providers
  "openai-compatible",
  "claude-code",
  "gemini-cli",
  "copilot",

  // Legacy types (for backward compatibility)
  "custom", // maps to openai-compatible
]);

/**
 * Zod schema for a single LLM provider configuration.
 * Supports all AI SDK v4 providers with provider-specific validation.
 */
export const ProviderSchema = z
  .object({
    /** A unique system identifier, 32 characters max. */
    id: z.string().max(32),

    /** The type of provider */
    type: ProviderTypeSchema,

    // Common authentication fields
    /** API key (required for most providers) */
    apiKey: z.string().optional(),

    /** GitHub OAuth token for Copilot */
    oauthToken: z.string().optional(),

    // OpenAI-compatible specific fields
    /** Base URL (required for openai-compatible, custom, and legacy openai types) */
    baseURL: z.string().url().optional(),

    // Azure specific fields
    /** Azure resource name (required for azure type) */
    resourceName: z.string().optional(),
    /** Azure deployment name (required for azure type) */
    deploymentName: z.string().optional(),

    // AWS Bedrock specific fields
    /** AWS access key ID (required for bedrock type) */
    accessKeyId: z.string().optional(),
    /** AWS secret access key (required for bedrock type) */
    secretAccessKey: z.string().optional(),
    /** AWS region (required for bedrock type) */
    region: z.string().optional(),

    /** Supported models, each with optional pricing and limits. */
    models: z.array(ModelSchema).min(1, "At least one model must be listed"),
  })
  .refine((data) => {
    // Validation for providers that require API key
    const apiKeyRequired: string[] = [
      "openai", "anthropic", "google", "google-vertex", "azure",
      "groq", "mistral", "deepseek", "xai", "perplexity", "togetherai",
      "openrouter", "qwen"
    ];
    return !apiKeyRequired.includes(data.type) || data.apiKey;
  }, {
    message: "API key is required for this provider type",
    path: ["apiKey"],
  })
  .refine((data) => {
    // Validation for OpenAI-compatible providers (baseURL + apiKey required)
    const openaiCompatible: string[] = ["openai-compatible", "custom"];
    return !openaiCompatible.includes(data.type) || (data.baseURL && data.apiKey);
  }, {
    message: "Both baseURL and apiKey are required for OpenAI-compatible providers",
    path: ["baseURL", "apiKey"],
  })
  .refine((data) => {
    // Validation for Azure (resourceName, deploymentName, apiKey required)
    return data.type !== "azure" || (data.resourceName && data.deploymentName && data.apiKey);
  }, {
    message: "resourceName, deploymentName, and apiKey are required for Azure providers",
    path: ["resourceName", "deploymentName", "apiKey"],
  })
  .refine((data) => {
    // Validation for AWS Bedrock (accessKeyId, secretAccessKey, region required)
    return data.type !== "bedrock" || (data.accessKeyId && data.secretAccessKey && data.region);
  }, {
    message: "accessKeyId, secretAccessKey, and region are required for Bedrock providers",
    path: ["accessKeyId", "secretAccessKey", "region"],
  })
  ;

/**
 * TypeScript type representing a single LLM provider's configuration.
 * Inferred from the Zod schema.
 */
export type Provider = z.infer<typeof ProviderSchema>;

/**
 * TypeScript type for provider types.
 */
export type ProviderType = z.infer<typeof ProviderTypeSchema>;