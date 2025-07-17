import { RateLimiterMemory, IRateLimiterOptions } from "rate-limiter-flexible";
import { ConfigManager } from "./ConfigManager.js";
import { Provider } from "../../schemas/provider.schema.js";
import { logger } from "./Logger.js";
import { Limits } from "../../schemas/limits.schema.js";
import { getErrorMessage, formatDuration } from "./Utils.js";
import { UsageDatabaseManager } from "./UsageDatabaseManager.js";

type LimitType = keyof Limits;

// A multiplier to convert decimal currency into integer points for the limiter.
// Using 10000 points = $1.00, so 1 point = $0.0001 (1/100th of a cent).
const COST_MULTIPLIER = 10000;

export class UsageManager {
  private static instance: UsageManager;
  private limiters = new Map<string, RateLimiterMemory>();

  // Private constructor to enforce singleton pattern. Does not initialize.
  private constructor() {}

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
    UsageManager.instance.initializeLimiters();
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
  private initializeLimiters(): void {
    const providers = ConfigManager.getProviders();
    logger.info("Initializing rate limiters for all providers...");

    for (const provider of providers) {
      if (provider.limits) {
        this.createLimitersForProvider(provider);
      }
    }
    logger.info("Rate limiters initialized.");
  }

  /**
   * Creates individual rate limiters for a single provider's limits.
   */
  private createLimitersForProvider(provider: Provider): void {
    if (!provider.limits) return;

    // Defines the types and durations of rate limits the UsageManager is designed to track.
    // The actual limit values are read from the provider's configuration.
    const limitConfigs: [LimitType, number, 'requests' | 'tokens' | 'cost'][] = [
      ["requestsPerMinute", 60, "requests"], ["requestsPerHour", 3600, "requests"], ["requestsPerDay", 86400, "requests"],
      ["tokensPerMinute", 60, "tokens"], ["tokensPerHour", 3600, "tokens"], ["tokensPerDay", 86400, "tokens"],
      ["costPerMinute", 60, "cost"], ["costPerHour", 3600, "cost"], ["costPerDay", 86400, "cost"],
    ];

    for (const [limitType, duration, type] of limitConfigs) {
      let points = provider.limits[limitType];

      if (points) {
        // Convert cost limits from dollars to integer points
        if (type === 'cost') {
          points = Math.floor(points * COST_MULTIPLIER);
        }

        const key = `${provider.id}/${limitType}`;
        const opts: IRateLimiterOptions = { points, duration };
        this.limiters.set(key, new RateLimiterMemory(opts));
        logger.debug(
          `Limiter: '${key}': ${points} ${type}/${formatDuration(duration)} (${duration}s).`,
        );
      }
    }
  }

  /**
   * Checks if a provider has available capacity.
   */
  public async isUnderLimit(providerId: string): Promise<boolean> {
    const providerLimitKeys = Array.from(this.limiters.keys()).filter(key => key.startsWith(providerId));
    if (providerLimitKeys.length === 0) {
      return true;
    }

    try {
      for (const key of providerLimitKeys) {
        const limiter = this.limiters.get(key);
        // Cost-based limits are checked on consumption, not pre-flight,
        // as the cost is unknown until the response is received.
        if (key.includes('cost')) {
          continue;
        }
        const res = await limiter?.get(providerId);
        if (res && res.consumedPoints >= (limiter?.points ?? Infinity)) {
          logger.warn(`Provider '${providerId}' has exceeded limit '${key}'.`);
          return false;
        }
      }
      return true;
    } catch (error) {
      logger.error(`Error checking limits for provider '${providerId}': ${getErrorMessage(error)}`);
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
      const key = `${providerId}/${limitType}`;
      const limiter = this.limiters.get(key);
      if (limiter && points > 0) {
        consumptionJobs.push(limiter.consume(providerId, points));
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
}