import { Provider } from "../../schemas/provider.schema.js";
import { Model } from "../../schemas/model.schema.js";
import { UsageManager } from "./UsageManager.js";
import { PriceData } from "./PriceData.js";
import { logger } from "./Logger.js";
import { Request, Response } from "express";
import {
  GenerateTextResult,
  StreamTextResult,
  generateText,
  streamText
} from "ai";
import { getErrorMessage } from "./Utils.js";
// Import OpenAI types for proper response formatting
import type { ChatCompletion, ChatCompletionChunk } from "openai/resources/chat/completions";
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
import { createGeminiProvider } from "ai-sdk-provider-gemini-cli"
import {  createClaudeCode } from "ai-sdk-provider-claude-code"

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
    ["gemini-cli", (config) => createGeminiProvider({ 
      authType: "oauth-personal"
    })],
    ["claude-code", (config) => createClaudeCode({

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
   * Uses PriceData override logic: model.pricing if available, otherwise PriceData lookup.
   * Handles both old and new usage formats.
   * @returns The calculated cost in USD, or undefined if pricing data is not available
   */
  private calculateCost(provider: Provider, model: Model, usage: any): number | undefined {
    if (!usage) {
      logger.debug(`No usage data for model '${model.name}'. Cannot calculate cost.`);
      return undefined;
    }

    // Get pricing using override logic: model.pricing first, then PriceData lookup
    try {
      const priceData = PriceData.getInstance();
      const pricing = priceData.getPriceWithOverride(provider.type, model);

      if (!pricing) {
        logger.debug(`No pricing data available for model '${model.name}' in provider '${provider.type}'. Cannot calculate cost.`);
        return undefined;
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
    } catch (error) {
      logger.debug(`Error calculating cost for model '${model.name}': ${getErrorMessage(error)}. Using fallback.`);
      return undefined;
    }
  }

  /**
   * Handles streaming responses and usage tracking.
   * Converts AI SDK stream to OpenAI API format.
   */
  private async handleStreamingResponse(
    res: Response,
    provider: Provider,
    model: Model,
    result: StreamTextResult<any, any>,
  ): Promise<void> {
    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const streamId = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    const modelName = model.mappedName || model.name;

    // Send initial chunk with role
    const initialChunk: ChatCompletionChunk = {
      id: streamId,
      object: 'chat.completion.chunk',
      created,
      model: modelName,
      choices: [{
        index: 0,
        delta: { role: 'assistant' },
        finish_reason: null,
        logprobs: null
      }]
    };
    res.write(`data: ${JSON.stringify(initialChunk)}\n\n`);

    try {
      // Stream the text content
      for await (const textDelta of result.textStream) {
        const chunk: ChatCompletionChunk = {
          id: streamId,
          object: 'chat.completion.chunk',
          created,
          model: modelName,
          choices: [{
            index: 0,
            delta: { content: textDelta },
            finish_reason: null,
            logprobs: null
          }]
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      // Wait for the stream to complete and get the finish reason
      const finishReason = await result.finishReason;

      // Send final chunk with finish_reason
      const finalChunk: ChatCompletionChunk = {
        id: streamId,
        object: 'chat.completion.chunk',
        created,
        model: modelName,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: finishReason as ChatCompletionChunk.Choice['finish_reason'],
          logprobs: null
        }]
      };
      res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();

      // Handle usage tracking
      result.usage
        .then((usage: any) => {
          const cost = this.calculateCost(provider, model, usage);
          // Convert usage format for UsageManager compatibility
          const usageForManager = {
            promptTokens: usage.promptTokens ?? usage.inputTokens ?? 0,
            completionTokens: usage.completionTokens ?? usage.outputTokens ?? 0,
          };
          // Use the real model name for usage tracking
          // Use 0 as fallback if cost is undefined (pricing data not available)
          this.usageManager.consume(provider.id, model.name, usageForManager, cost ?? 0);
        })
        .catch((error: any) => {
          logger.error(`Failed to consume usage for streaming request: ${getErrorMessage(error)}`);
        });

    } catch (error) {
      logger.error(`Streaming error: ${getErrorMessage(error)}`);
      res.write(`data: {"error": "Streaming failed"}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
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
    const cost = this.calculateCost(provider, model, result.usage);
    // Convert usage format for UsageManager compatibility
    const usageForManager = {
      promptTokens: (result.usage as any).promptTokens ?? (result.usage as any).inputTokens ?? 0,
      completionTokens: (result.usage as any).completionTokens ?? (result.usage as any).outputTokens ?? 0,
    };
    // Use the real model name for usage tracking
    // Use 0 as fallback if cost is undefined (pricing data not available)
    this.usageManager.consume(provider.id, model.name, usageForManager, cost ?? 0);

    // Format response to match OpenAI API format using official types
    const openAIResponse: ChatCompletion = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model.mappedName || model.name, // Use the mapped name that the client requested
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: result.text,
          refusal: null
        },
        finish_reason: result.finishReason as ChatCompletion.Choice['finish_reason'],
        logprobs: null
      }],
      usage: {
        prompt_tokens: usageForManager.promptTokens,
        completion_tokens: usageForManager.completionTokens,
        total_tokens: usageForManager.promptTokens + usageForManager.completionTokens
      }
    };

    res.json(openAIResponse);
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
