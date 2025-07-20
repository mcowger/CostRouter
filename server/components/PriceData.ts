import { Pricing } from '../../schemas/pricing.schema.js';
import { ProviderTypeSchema, ProviderType } from '../../schemas/provider.schema.js';
import { Model } from '../../schemas/model.schema.js';
import { logger } from './Logger.js';
import { getErrorMessage } from './Utils.js';

/**
 * Interface for Helicone API model data
 */
interface HeliconeModel {
  provider: string;
  model: string;
  operator: 'equals' | 'startsWith' | 'includes';
  input_cost_per_1m: number;
  output_cost_per_1m: number;
  // Optional fields that might be present
  prompt_cache_write_per_1m?: number;
  prompt_cache_read_per_1m?: number;
  per_image?: number;
  per_call?: number;
  prompt_audio_per_1m?: number;
  completion_audio_per_1m?: number;
  show_in_playground?: boolean;
}

/**
 * Interface for Helicone API response
 */
interface HeliconeResponse {
  metadata: {
    total_models: number;
    note: string;
    operators_explained: Record<string, string>;
  };
  data: HeliconeModel[];
}

/**
 * Mapping from Helicone provider names to ProviderTypeSchema values
 */
const PROVIDER_MAPPING: Record<string, ProviderType> = {
  'ANTHROPIC': 'anthropic',
  'OPENAI': 'openai',
  'AZURE': 'azure',
  'GOOGLE': 'google',
  'GROQ': 'groq',
  'MISTRAL': 'mistral',
  'DEEPSEEK': 'deepseek',
  'X': 'xai',
  'PERPLEXITY': 'perplexity',
  'TOGETHER': 'togetherai',
  'OPENROUTER': 'openrouter',
  'AWS': 'bedrock',
  'COHERE': 'openai-compatible', // Fallback for unsupported providers
  'FIREWORKS': 'openai-compatible',
  'AVIAN': 'openai-compatible',
  'NEBIUS': 'openai-compatible',
  'NOVITA': 'openai-compatible',
  'QSTASH': 'openai-compatible',
};

/**
 * Singleton component for collecting and serving LLM pricing data from Helicone API.
 * Fetches pricing data once during application startup and provides methods to query pricing information.
 */
export class PriceData {
  private static instance: PriceData;
  private pricingData: Map<ProviderType, HeliconeModel[]> = new Map();
  private isInitialized: boolean = false;

  // Private constructor to enforce singleton pattern
  private constructor() { }

  /**
   * Initializes the singleton PriceData by fetching pricing data from Helicone API.
   * This should be called once at application startup.
   */
  public static async initialize(): Promise<void> {
    if (PriceData.instance) {
      logger.warn("PriceData has already been initialized.");
      return;
    }

    PriceData.instance = new PriceData();
    await PriceData.instance.fetchPricingData();
    logger.info("PriceData initialized successfully.");
    logger.debug(`PriceData initialized with ${PriceData.instance.getProviderCount()} providers and ${PriceData.instance.getModelCount()} models`);
  }

  /**
   * Returns the singleton instance of PriceData.
   * Throws an error if it hasn't been initialized.
   */
  public static getInstance(): PriceData {
    if (!PriceData.instance) {
      throw new Error("PriceData must be initialized before use.");
    }
    return PriceData.instance;
  }

  /**
   * Gets pricing information for a specific provider and model.
   *
   * @param providerType - The provider type (must conform to ProviderTypeSchema)
   * @param modelName - The model name (should match ModelSchema.name, NOT mappedName)
   * @returns Pricing information if found, undefined otherwise
   */
  public getPrice(providerType: string, modelName: string): Pricing | undefined {
    try {
      // Validate providerType against schema
      const validatedProviderType = ProviderTypeSchema.parse(providerType);

      // Get models for this provider
      const models = this.pricingData.get(validatedProviderType);
      if (!models || models.length === 0) {
        logger.debug(`No pricing data found for provider: ${validatedProviderType}`);
        return undefined;
      }

      // Find matching model using operator-based matching
      const matchingModel = this.findMatchingModel(models, modelName);
      if (!matchingModel) {
        logger.debug(`No pricing data found for model: ${modelName} in provider: ${validatedProviderType}`);
        return undefined;
      }

      // Convert to Pricing format
      return this.convertToPricing(matchingModel);
    } catch (error) {
      logger.error(`Error getting price for ${providerType}/${modelName}: ${getErrorMessage(error)}`);
      return undefined;
    }
  }

  /**
   * Gets pricing information with override logic: uses model.pricing if available,
   * otherwise falls back to PriceData lookup.
   *
   * @param providerType - The provider type (must conform to ProviderTypeSchema)
   * @param model - The model object which may contain explicit pricing
   * @returns Pricing information from model override or PriceData lookup, undefined if neither available
   */
  public getPriceWithOverride(providerType: string, model: Model): Pricing | undefined {
    // First, check if the model has explicit pricing defined
    if (model.pricing) {
      logger.debug(`Using explicit pricing for '${providerType}' @ '${model.name}'`);
      return model.pricing;
    }

    // Fall back to PriceData lookup
    logger.debug(`No explicit pricing for '${providerType}' @ '${model.name}', falling back to PriceData lookup`);
    return this.getPrice(providerType, model.name);
  }

  /**
   * Fetches pricing data from Helicone API and stores it in memory.
   * Handles network failures gracefully by logging errors and continuing with empty data.
   */
  private async fetchPricingData(): Promise<void> {
    try {
      logger.info("Fetching pricing data from Helicone API...");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch('https://www.helicone.ai/api/llm-costs', {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: HeliconeResponse = await response.json();

        if (!data.data || !Array.isArray(data.data)) {
          throw new Error("Invalid response format: missing or invalid data array");
        }

        // Process and organize the data by provider
        let processedCount = 0;
        let skippedCount = 0;

        for (const model of data.data) {
          const mappedProvider = this.mapHeliconeProviderToSchema(model.provider);
          if (mappedProvider) {
            if (!this.pricingData.has(mappedProvider)) {
              this.pricingData.set(mappedProvider, []);
            }
            this.pricingData.get(mappedProvider)!.push(model);
            processedCount++;
          } else {
            skippedCount++;
          }
        }

        logger.info(`Pricing data loaded: ${processedCount} models processed, ${skippedCount} skipped from unmapped providers`);
        this.isInitialized = true;

      } finally {
        // Always clear the timeout to prevent Jest from hanging
        clearTimeout(timeoutId);
      }

    } catch (error) {
      logger.error(`Failed to fetch pricing data from Helicone API: ${getErrorMessage(error)}`);
      logger.warn("PriceData will continue with empty pricing data");
      this.isInitialized = true; // Mark as initialized even if fetch failed
    }
  }

  /**
   * Maps Helicone provider names to ProviderTypeSchema values.
   */
  private mapHeliconeProviderToSchema(heliconeProvider: string): ProviderType | undefined {
    const mapped = PROVIDER_MAPPING[heliconeProvider];
    if (!mapped) {
      logger.debug(`No mapping found for Helicone provider: ${heliconeProvider}`);
    }
    return mapped;
  }

  /**
   * Finds a matching model using operator-based matching logic.
   */
  private findMatchingModel(models: HeliconeModel[], modelName: string): HeliconeModel | undefined {
    // Only match on exact model names for accuracy
    return models.find(model => model.model === modelName);
  }

  /**
   * Converts Helicone model data to Pricing schema format.
   */
  private convertToPricing(heliconeModel: HeliconeModel): Pricing {
    const pricing: Pricing = {};

    // Convert per-million-token costs
    if (heliconeModel.input_cost_per_1m > 0) {
      pricing.inputCostPerMillionTokens = heliconeModel.input_cost_per_1m;
    }

    if (heliconeModel.output_cost_per_1m > 0) {
      pricing.outputCostPerMillionTokens = heliconeModel.output_cost_per_1m;
    }

    // Convert per-request costs if present
    if (heliconeModel.per_call && heliconeModel.per_call > 0) {
      pricing.costPerRequest = heliconeModel.per_call;
    }

    return pricing;
  }

  /**
   * Returns whether the component has been successfully initialized.
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Returns the number of providers with pricing data.
   */
  public getProviderCount(): number {
    return this.pricingData.size;
  }

  /**
   * Returns the total number of models with pricing data.
   */
  public getModelCount(): number {
    let total = 0;
    for (const models of this.pricingData.values()) {
      total += models.length;
    }
    return total;
  }
}
