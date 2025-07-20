import { Provider } from "../../schemas/provider.schema.js";
import { Model } from "../../schemas/model.schema.js";
import { UsageManager } from "./UsageManager.js";
import { logger } from "./Logger.js";
import { Request, Response } from "express";
import {
  GenerateTextResult,
  StreamTextResult,
  generateText,
  streamText
} from "ai";
import { getErrorMessage } from "./Utils.js";
// Import all AI SDK providers
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
//import { createAzure } from "@ai-sdk/azure"; // Commented out until wI figure out the resourceName
//import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"; // Commented out until we verify API
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createXai } from "@ai-sdk/xai";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// import { createOpenRouter } from '@openrouter/ai-sdk-provider'; Only supports v5, 
// which nothing else does.  For now, treat it as openai-compatible
import { createOllama } from "ollama-ai-provider";
import { createQwen } from "qwen-ai-provider";

/**
 * Unified executor that handles all AI SDK v5 providers.
 * Replaces the previous provider-specific executor classes.
 */
export class UnifiedExecutor {
  private usageManager: UsageManager;
  private providerInstances: Map<string, any> = new Map();

  // Map of provider types to their factory functions
  // Adding new providers is as simple as adding a new entry here!
  private static readonly PROVIDER_FACTORIES = new Map<string, (config: Provider) => any>([
    // Core AI SDK providers
    ["openai", (config) => createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL // Support custom OpenAI endpoints
    })],
    ["anthropic", (config) => createAnthropic({
      apiKey: config.apiKey
    })],
    ["google", (config) => createGoogleGenerativeAI({
      apiKey: config.apiKey
    })],
    ["google-vertex", (config) => createVertex({
      project: config.resourceName, // Use resourceName as project ID
      location: config.region || "us-central1" // Default location
    })],

    // Commented out until I can add this to the provider schema.
    // ["bedrock", (config) => createAmazonBedrock({
    //   accessKeyId: config.accessKeyId,
    //   secretAccessKey: config.secretAccessKey,
    //   region: config.region
    // })],
    ["groq", (config) => createGroq({
      apiKey: config.apiKey
    })],
    ["mistral", (config) => createMistral({
      apiKey: config.apiKey
    })],
    ["deepseek", (config) => createDeepSeek({
      apiKey: config.apiKey
    })],
    ["xai", (config) => createXai({
      apiKey: config.apiKey
    })],
    ["perplexity", (config) => createPerplexity({
      apiKey: config.apiKey
    })],
    ["togetherai", (config) => createTogetherAI({
      apiKey: config.apiKey
    })],


    // OpenAI-compatible providers
    ["qwen", (config) => createQwen({
      apiKey: config.apiKey!,
    })],

    // OpenAI-compatible providers
    ["ollama", (config) => createOllama({
      baseURL: config.baseURL || "http://localhost:11434",
    })],

    // OpenRouter - use compatible for now because their provider only supports v5.
    ["openrouter", (config) => createOpenAICompatible({
      name: config.id,
      apiKey: config.apiKey!,
      baseURL: config.baseURL || "https://api.openrouter.ai/api/v1",
    })],

    // OpenAI-compatible providers
    ["openai-compatible", (config) => createOpenAICompatible({
      name: config.id,
      baseURL: config.baseURL!,
      apiKey: config.apiKey!,
    })],
    ["custom", (config) => createOpenAICompatible({ // Legacy support
      name: config.id,
      baseURL: config.baseURL!,
      apiKey: config.apiKey!,
    })],
  ]);

  constructor(usageManager: UsageManager) {
    this.usageManager = usageManager;
  }

  /**
   * Register a new provider factory function.
   * Useful for adding custom providers without modifying the core code.
   */
  public static registerProvider(type: string, factory: (config: Provider) => any): void {
    UnifiedExecutor.PROVIDER_FACTORIES.set(type, factory);
  }

  /**
   * Get all supported provider types.
   */
  public static getSupportedProviders(): string[] {
    return Array.from(UnifiedExecutor.PROVIDER_FACTORIES.keys());
  }

  /**
   * Creates an AI SDK provider instance based on the provider configuration.
   */
  private createProviderInstance(config: Provider): any {
    const factory = UnifiedExecutor.PROVIDER_FACTORIES.get(config.type);

    if (!factory) {
      const supportedTypes = UnifiedExecutor.getSupportedProviders().join(', ');
      throw new Error(
        `Unsupported provider type: ${config.type}. Supported types: ${supportedTypes}`
      );
    }

    return factory(config);
  }

  /**
   * Gets or creates a provider instance, with caching.
   */
  private getOrCreateProvider(config: Provider): any {
    const cacheKey = `${config.type}-${config.id}`;

    if (!this.providerInstances.has(cacheKey)) {
      logger.debug(`Creating new provider instance for ${config.type}:${config.id}`);
      const instance = this.createProviderInstance(config);
      this.providerInstances.set(cacheKey, instance);
    }

    return this.providerInstances.get(cacheKey);
  }

  /**
   * Main execution method that handles requests for any provider type.
   */
  public async execute(req: Request, res: Response): Promise<void> {
    const chosenProvider = res.locals.chosenProvider as Provider;
    const chosenModel = res.locals.chosenModel as Model;

    logger.debug(
      { provider: chosenProvider, model: chosenModel },
      `Executing request with ${chosenProvider.type} provider`
    );

    try {
      // Get or create the AI SDK provider instance
      const providerInstance = this.getOrCreateProvider(chosenProvider);

      // Create the model using the provider
      const model = providerInstance(chosenModel.name);

      // Extract request data
      const { messages, stream = false } = req.body;

      // Execute the request using AI SDK
      if (stream) {
        const result = streamText({ model: model as any, messages });
        this.handleStreamingResponse(res, chosenProvider, chosenModel, result);
      } else {
        const result = await generateText({ model: model as any, messages });
        this.handleNonStreamingResponse(res, chosenProvider, chosenModel, result);
      }
    } catch (error) {
      logger.error(
        `AI request failed for provider ${chosenProvider.id}: ${getErrorMessage(error)}`
      );
      res.status(500).json({ error: "AI request failed" });
    }
  }

  /**
   * Calculates the cost of a request based on model pricing and usage.
   * Preserved from BaseExecutor. Handles both old and new usage formats.
   */
  private calculateCost(model: Model, usage: any): number {
    const pricing = model.pricing;
    if (!pricing || !usage) {
      logger.debug(`No pricing or usage data for model '${model.name}'. Cost is 0.`);
      return 0;
    }

    // If a flat request cost is defined, it overrides token-based pricing.
    if (pricing.costPerRequest) {
      return pricing.costPerRequest;
    }

    // Handle both v1 and v2 usage formats
    const inputTokens = usage.promptTokens ?? usage.inputTokens ?? 0;
    const outputTokens = usage.completionTokens ?? usage.outputTokens ?? 0;

    const inputCost = (inputTokens / 1_000_000) * (pricing.inputCostPerMillionTokens ?? 0);
    const outputCost = (outputTokens / 1_000_000) * (pricing.outputCostPerMillionTokens ?? 0);

    const totalCost = inputCost + outputCost;
    logger.debug(`Calculated cost for model '${model.name}': $${totalCost.toFixed(6)}`);
    return totalCost;
  }

  /**
   * Handles streaming responses and usage tracking.
   * Preserved from BaseExecutor.
   */
  private handleStreamingResponse(
    res: Response,
    provider: Provider,
    model: Model,
    result: StreamTextResult<any, any>,
  ): void {
    result.pipeTextStreamToResponse(res);

    result.usage
      .then((usage: any) => {
        const cost = this.calculateCost(model, usage);
        // Convert usage format for UsageManager compatibility
        const usageForManager = {
          promptTokens: usage.promptTokens ?? usage.inputTokens ?? 0,
          completionTokens: usage.completionTokens ?? usage.outputTokens ?? 0,
        };
        // Use the real model name for usage tracking
        this.usageManager.consume(provider.id, model.name, usageForManager, cost);
      })
      .catch((error: any) => {
        logger.error(`Failed to consume usage for streaming request: ${getErrorMessage(error)}`);
      });
  }

  /**
   * Handles non-streaming responses and usage tracking.
   * Preserved from BaseExecutor.
   */
  private handleNonStreamingResponse(
    res: Response,
    provider: Provider,
    model: Model,
    result: GenerateTextResult<any, any>,
  ): void {
    const cost = this.calculateCost(model, result.usage);
    // Convert usage format for UsageManager compatibility
    const usageForManager = {
      promptTokens: (result.usage as any).promptTokens ?? (result.usage as any).inputTokens ?? 0,
      completionTokens: (result.usage as any).completionTokens ?? (result.usage as any).outputTokens ?? 0,
    };
    // Use the real model name for usage tracking
    this.usageManager.consume(provider.id, model.name, usageForManager, cost);
    res.json(result);
  }

  /**
   * Clears the provider instance cache.
   * Useful for testing or when provider configurations change.
   */
  public clearCache(): void {
    this.providerInstances.clear();
    logger.debug("Provider instance cache cleared");
  }
}
