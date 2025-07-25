import { RateLimiterMemory, IRateLimiterOptions } from "rate-limiter-flexible";
import { ConfigManager } from "./ConfigManager.js";
import { Provider } from "../../schemas/provider.schema.js";
import { Model } from "../../schemas/model.schema.js";
import { AppConfig } from "../../schemas/appConfig.schema.js";
import { logger } from "./Logger.js";
import { Limits } from "../../schemas/limits.schema.js";
import { getErrorMessage, formatDuration } from "./Utils.js";
import { UsageDatabaseManager } from "./UsageDatabaseManager.js";

type LimitType = keyof Limits;

// Types for usage dashboard
export interface LimitUsage {
  consumed: number;
  limit: number;
  percentage: number;
  msBeforeNext: number;
  unit: 'requests' | 'tokens' | 'USD';
}

export interface ModelUsage {
  name: string;
  mappedName?: string;
  limits: {
    [key in LimitType]?: LimitUsage;
  };
}

export interface ProviderUsage {
  id: string;
  models: ModelUsage[];
}

export interface UsageDashboardData {
  providers: ProviderUsage[];
  timestamp: number;
}

// A multiplier to convert decimal currency into integer points for the limiter.
// Using 10000 points = $1.00, so 1 point = $0.0001 (1/100th of a cent).
const COST_MULTIPLIER = 10000;

export class UsageManager {
  private static instance: UsageManager;
  private limiters = new Map<string, RateLimiterMemory>();

  // Private constructor to enforce singleton pattern. Does not initialize.
  private constructor() { }

  /**
   * Initializes the singleton UsageManager by creating and configuring rate limiters.
   * This MUST be called after ConfigManager is initialized.
   */
  public static initialize(): void {
    if (UsageManager.instance) {
      logger.warn("UsageManager has already been initialized.");
      return;
    }
    UsageManager.instance = new UsageManager();
    UsageManager.instance.updateLimiters(); // Initial setup

    // Listen for config changes to dynamically update limiters
    ConfigManager.events.on('configUpdated', (newConfig: AppConfig) => {
      logger.info("Configuration has been updated. Checking for rate limiter changes...");
      UsageManager.getInstance().updateLimiters(newConfig);
    });
  }

  /**
   * Returns the singleton instance of the UsageManager.
   * Throws an error if it hasn't been initialized.
   */
  public static getInstance(): UsageManager {
    if (!UsageManager.instance) {
      throw new Error("UsageManager must be initialized before use.");
    }
    return UsageManager.instance;
  }

  /**
   * Creates and configures rate limiters for each provider.
   */
  /**
   * Updates rate limiters based on the provided configuration.
   * This function intelligently adds, removes, and updates limiters
   * without resetting the state of unchanged limiters.
   */
  public updateLimiters(config: AppConfig | null = null): void {
    const newProviders = config ? config.providers : ConfigManager.getProviders();
    const newProviderIds = new Set(newProviders.map(p => p.id));

    const currentProviderIds = new Set<string>();
    for (const key of this.limiters.keys()) {
      currentProviderIds.add(key.split('/')[0]);
    }

    // 1. Remove limiters for providers that are no longer in the config
    for (const providerId of currentProviderIds) {
      if (!newProviderIds.has(providerId)) {
        this.removeLimitersForProvider(providerId);
      }
    }

    // 2. Add or update limiters for current providers
    for (const provider of newProviders) {
      if (!currentProviderIds.has(provider.id)) {
        // New provider: add all its limiters
        logger.info(`Adding new provider '${provider.id}' to UsageManager.`);
        this.createLimitersForProvider(provider);
      } else {
        // Existing provider: check for model changes
        this.updateLimitersForExistingProvider(provider);
      }
    }
    logger.info("Rate limiter update check complete.");
  }

  /**
   * For an existing provider, adds limiters for new models and removes limiters for old ones.
   */
  private updateLimitersForExistingProvider(provider: Provider): void {
    const existingModelKeys = Array.from(this.limiters.keys()).filter(k => k.startsWith(`${provider.id}/`));
    const existingModelNames = new Set(existingModelKeys.map(k => k.split('/')[1]));
    const newModelNames = new Set(provider.models.map(m => m.name));

    // Add limiters for new models
    for (const model of provider.models) {
      if (!existingModelNames.has(model.name)) {
        logger.info(`Adding new model '${model.name}' to provider '${provider.id}'.`);
        this.createLimitersForModel(provider, model);
      }
    }

    // Remove limiters for deleted models
    for (const modelName of existingModelNames) {
      if (!newModelNames.has(modelName)) {
        logger.info(`Removing model '${modelName}' from provider '${provider.id}'.`);
        this.removeLimitersForModel(provider.id, modelName);
      }
    }
  }

  /**
   * Creates individual rate limiters for all models in a provider.
   */
  private createLimitersForProvider(provider: Provider): void {
    for (const model of provider.models) {
      this.createLimitersForModel(provider, model);
    }
  }

  private createLimitersForModel(provider: Provider, model: Model): void {
    const limitConfigs: [LimitType, number, 'requests' | 'tokens' | 'cost'][] = [
      ["requestsPerMinute", 60, "requests"], ["requestsPerHour", 3600, "requests"], ["requestsPerDay", 86400, "requests"],
      ["tokensPerMinute", 60, "tokens"], ["tokensPerHour", 3600, "tokens"], ["tokensPerDay", 86400, "tokens"],
      ["costPerMinute", 60, "cost"], ["costPerHour", 3600, "cost"], ["costPerDay", 86400, "cost"],
    ];
    const MAX_TRACKING_POINTS = 2147483647;

    for (const [limitType, duration, type] of limitConfigs) {
      let points: number;
      if (model.limits && model.limits[limitType] !== undefined && model.limits[limitType]! > 0) {
        points = model.limits[limitType]!;
        if (type === 'cost') points = Math.floor(points * COST_MULTIPLIER);
      } else {
        points = MAX_TRACKING_POINTS;
      }

      const key = `${provider.id}/${model.name}/${limitType}`;
      const opts: IRateLimiterOptions = { points, duration };
      this.limiters.set(key, new RateLimiterMemory(opts));

      if (points === MAX_TRACKING_POINTS) {
        logger.debug(`Limiter: '${key}': unlimited tracking for ${type}/${formatDuration(duration)} (${duration}s).`);
      } else {
        logger.debug(`Limiter: '${key}': ${points} ${type}/${formatDuration(duration)} (${duration}s).`);
      }
    }
  }

  private removeLimitersForProvider(providerId: string): void {
    logger.info(`Removing all limiters for provider '${providerId}'.`);
    for (const key of this.limiters.keys()) {
      if (key.startsWith(`${providerId}/`)) {
        this.limiters.delete(key);
      }
    }
  }

  private removeLimitersForModel(providerId: string, modelName: string): void {
    logger.warn(`Removing limiters for model '${modelName}' from provider '${providerId}'.`);
    for (const key of this.limiters.keys()) {
      if (key.startsWith(`${providerId}/${modelName}/`)) {
        this.limiters.delete(key);
      }
    }
  }

  /**
   * Checks if a specific model has available capacity.
   */
  public async isUnderLimit(providerId: string, modelName: string): Promise<boolean> {
    const modelLimitKeys = Array.from(this.limiters.keys()).filter(key =>
      key.startsWith(`${providerId}/${modelName}/`)
    );
    if (modelLimitKeys.length === 0) {
      return true; // No limits configured for this model
    }

    try {
      for (const key of modelLimitKeys) {
        const limiter = this.limiters.get(key);
        // Cost-based limits are checked on consumption, not pre-flight,
        // as the cost is unknown until the response is received.
        if (key.includes('cost')) {
          continue;
        }
        const res = await limiter?.get(`${providerId}/${modelName}`);
        if (res && res.consumedPoints >= (limiter?.points ?? Infinity)) {
          logger.warn(`Model '${modelName}' on provider '${providerId}' has exceeded limit '${key}'.`);
          return false;
        }
      }
      return true;
    } catch (error) {
      logger.error(`Error checking limits for model '${modelName}' on provider '${providerId}': ${getErrorMessage(error)}`);
      return false; // Fail closed
    }
  }

  /**
   * Consumes resources for a given provider.
   */
  public async consume(
    providerId: string,
    model: string,
    usage: { promptTokens?: number; completionTokens?: number },
    costInUSD: number = 0,
  ): Promise<void> {
    logger.debug(`Consuming usage for provider '${providerId}':`, { model, usage, costInUSD });

    try {
      const dbManager = UsageDatabaseManager.getInstance();
      await dbManager.recordUsage({
        providerId,
        model,
        promptTokens: usage.promptTokens ?? 0,
        completionTokens: usage.completionTokens ?? 0,
        cost: costInUSD,
      });
    } catch (error) {
      // Non-fatal error, as this is for optional reporting.
      // The error is logged by the singleton's initialization check.
    }

    const totalTokens = (usage.promptTokens || 0) + (usage.completionTokens || 0);
    const costInPoints = Math.floor(costInUSD * COST_MULTIPLIER);
    const consumptionJobs: Promise<any>[] = [];

    const checkAndConsume = (limitType: LimitType, points: number) => {
      const key = `${providerId}/${model}/${limitType}`;
      const limiter = this.limiters.get(key);
      if (limiter && points > 0) {
        consumptionJobs.push(limiter.consume(`${providerId}/${model}`, points));
      }
    };

    // Requests
    checkAndConsume('requestsPerMinute', 1);
    checkAndConsume('requestsPerHour', 1);
    checkAndConsume('requestsPerDay', 1);

    // Tokens
    checkAndConsume('tokensPerMinute', totalTokens);
    checkAndConsume('tokensPerHour', totalTokens);
    checkAndConsume('tokensPerDay', totalTokens);

    // Cost
    checkAndConsume('costPerMinute', costInPoints);
    checkAndConsume('costPerHour', costInPoints);
    checkAndConsume('costPerDay', costInPoints);

    try {
      await Promise.all(consumptionJobs);
      logger.info(`Consumed usage for provider '${providerId}': ${totalTokens} tokens, 1 request, $${costInUSD.toFixed(4)}.`);
    } catch (error) {
      // This catch will trigger if a limit is exceeded upon consumption.
      logger.warn(`Rate limit exceeded for provider '${providerId}' on consumption: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Gets current usage data for all providers and models for the dashboard.
   */
  public async getCurrentUsageData(): Promise<UsageDashboardData> {
    const providers = ConfigManager.getProviders();
    const providerUsages: ProviderUsage[] = [];

    // Define limit configurations with their units
    const limitConfigs: [LimitType, 'requests' | 'tokens' | 'USD'][] = [
      ["requestsPerMinute", "requests"], ["requestsPerHour", "requests"], ["requestsPerDay", "requests"],
      ["tokensPerMinute", "tokens"], ["tokensPerHour", "tokens"], ["tokensPerDay", "tokens"],
      ["costPerMinute", "USD"], ["costPerHour", "USD"], ["costPerDay", "USD"],
    ];

    // Maximum value for tracking without limits (2^31 - 1)
    const MAX_TRACKING_POINTS = 2147483647;

    for (const provider of providers) {
      const modelUsages: ModelUsage[] = [];

      // Process each model in the provider
      for (const model of provider.models) {
        const modelUsage: ModelUsage = {
          name: model.name,
          mappedName: model.mappedName,
          limits: {}
        };

        // Process all limit types for this model (we now track everything)
        for (const [limitType, unit] of limitConfigs) {
          const key = `${provider.id}/${model.name}/${limitType}`;
          const limiter = this.limiters.get(key);

          if (limiter) {
            try {
              const res = await limiter.get(`${provider.id}/${model.name}`);
              let consumed = 0;
              let limit: number;
              let msBeforeNext = 0;
              let isInfinite = false;

              if (res) {
                consumed = res.consumedPoints;
                msBeforeNext = res.msBeforeNext;
              }

              // Determine the actual limit value
              if (model.limits && model.limits[limitType] !== undefined && model.limits[limitType]! > 0) {
                // Model has explicit limit configured
                limit = model.limits[limitType]!;
              } else {
                // Model has no explicit limit - mark as infinite
                limit = MAX_TRACKING_POINTS;
                isInfinite = true;
              }

              // Convert cost points back to USD for display
              if (unit === 'USD') {
                consumed = consumed / COST_MULTIPLIER;
                if (!isInfinite) {
                  // limit is already in USD from config for explicit limits
                } else {
                  // For infinite limits, keep the large number for percentage calculation
                  limit = MAX_TRACKING_POINTS / COST_MULTIPLIER;
                }
              }

              const percentage = limit > 0 ? Math.round((consumed / limit) * 100) : 0;

              modelUsage.limits[limitType] = {
                consumed,
                limit: isInfinite ? -1 : limit, // Use -1 to indicate infinite limit
                percentage,
                msBeforeNext,
                unit
              };
            } catch (error) {
              logger.warn(`Error getting usage data for ${key}: ${getErrorMessage(error)}`);
              // Continue with other limiters even if one fails
            }
          }
        }

        // Add all models to show in dashboard, even if they have no active limits
        // This allows the UI to show "No rate limits configured" message properly
        modelUsages.push(modelUsage);
      }

      const providerUsage: ProviderUsage = {
        id: provider.id,
        models: modelUsages
      };

      providerUsages.push(providerUsage);
    }

    return {
      providers: providerUsages,
      timestamp: Date.now()
    };
  }
}