import { RateLimiterMemory, IRateLimiterOptions } from "rate-limiter-flexible";
import { ConfigManager } from "./ConfigManager.js";
import { Provider } from "../schemas/provider.schema.js";
import { logger } from "./Logger.js";
import { Limits } from "../schemas/limits.schema.js";
import { getErrorMessage, formatDuration } from "./Utils.js";
import { log } from "console";

type LimitType = keyof Limits;

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

    const limitConfigs: [LimitType, number][] = [
      ["requestsPerMinute", 60], ["requestsPerHour", 3600], ["requestsPerDay", 86400],
      ["tokensPerMinute", 60], ["tokensPerHour", 3600], ["tokensPerDay", 86400],
    ];

    for (const [limitType, duration] of limitConfigs) {
      const points = provider.limits[limitType];
      const requestLimitType = limitType.startsWith("requests") ? "requests" : "tokens";

      if (points) {
        const key = `${provider.id}/${limitType}`;
        const opts: IRateLimiterOptions = { points, duration };
        this.limiters.set(key, new RateLimiterMemory(opts));
        logger.debug(
          `Limiter: '${key}': ${points} ${requestLimitType}/${formatDuration(duration)} (${duration}s).`,
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
  public async consume(providerId: string, usage: { promptTokens?: number; completionTokens?: number }): Promise<void> {
    logger.debug(`Consuming usage for provider '${providerId}':`, usage);
    const totalTokens = (usage.promptTokens || 0) + (usage.completionTokens || 0);
    const consumptionJobs: Promise<any>[] = [];

    const checkAndConsume = async (limitType: LimitType, points: number) => {
      const key = `${providerId}/${limitType}`;
      const limiter = this.limiters.get(key);
      if (limiter && points > 0) {
        consumptionJobs.push(limiter.consume(providerId, points));
      }
    };

    checkAndConsume('requestsPerMinute', 1);
    checkAndConsume('requestsPerHour', 1);
    checkAndConsume('requestsPerDay', 1);
    checkAndConsume('tokensPerMinute', totalTokens);
    checkAndConsume('tokensPerHour', totalTokens);
    checkAndConsume('tokensPerDay', totalTokens);

    try {
      await Promise.all(consumptionJobs);
      logger.debug(`Consumed usage for provider '${providerId}': ${totalTokens} tokens, 1 request.`);
    } catch (error) {
      logger.warn(`Rate limit exceeded for provider '${providerId}' on consumption: ${getErrorMessage(error)}`);
    }
  }
}