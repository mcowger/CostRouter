import { Provider } from "../../schemas/provider.schema.js";
import { Model } from "../../schemas/model.schema.js";
import { ConfigManager } from "./config/ConfigManager.js";
import { logger } from "./Logger.js";
import { Request, Response, NextFunction } from "express";
import { UsageManager } from "./UsageManager.js";
import { PriceData } from "./PriceData.js";

export class Router {
  private static instance: Router;
  private usageManager: UsageManager;

  // Private constructor now accepts dependencies.
  private constructor(usageManager: UsageManager) {
    this.usageManager = usageManager;
  }

  /**
   * Initializes the singleton Router.
   * This MUST be called after UsageManager is initialized.
   */
  public static initialize(): void {
    if (Router.instance) {
      logger.warn("Router has already been initialized.");
      return;
    }
    const usageManager = UsageManager.getInstance();
    Router.instance = new Router(usageManager);
  }

  /**
   * Returns the singleton instance of the Router.
   * Throws an error if it hasn't been initialized.
   */
  public static getInstance(): Router {
    if (!Router.instance) {
      throw new Error("Router must be initialized before use.");
    }
    return Router.instance;
  }


  private getProvidersForModel(modelname: string): { provider: Provider; model: Model }[] | undefined {
    logger.debug(`Searching for providers for model: ${modelname}`);
    const providers: Provider[] = ConfigManager.getInstance().getProviders();
    const matches: { provider: Provider; model: Model }[] = [];

    for (const provider of providers) {
      for (const model of provider.models) {
        // Check if the requested model name matches either the mappedName or the real name
        const modelIdentifier = model.mappedName || model.name;
        if (modelIdentifier === modelname) {
          matches.push({ provider, model });
        }
      }
    }

    return matches.length > 0 ? matches : undefined;
  }

  /**
   * Determines if a provider/model combination has zero cost.
   * A model is considered zero-cost only if pricing data exists and all pricing fields are explicitly 0.
   * Unknown/undefined pricing is not considered zero cost.
   */
  private isZeroCost(provider: Provider, model: Model): boolean {
    try {
      const priceData = PriceData.getInstance();
      const pricing = priceData.getPriceWithOverride(provider.type, model);

      if (!pricing) {
        // No pricing data available - not considered zero cost
        return false;
      }

      // For a model to be considered zero cost, we need at least one pricing field
      // to be explicitly defined (not undefined) and all defined fields must be 0
      const hasInputCost = pricing.inputCostPerMillionTokens !== undefined;
      const hasOutputCost = pricing.outputCostPerMillionTokens !== undefined;
      const hasRequestCost = pricing.costPerRequest !== undefined;

      // Must have at least one pricing field defined
      if (!hasInputCost && !hasOutputCost && !hasRequestCost) {
        return false;
      }

      // All defined pricing fields must be exactly 0
      const inputIsZero = !hasInputCost || pricing.inputCostPerMillionTokens === 0;
      const outputIsZero = !hasOutputCost || pricing.outputCostPerMillionTokens === 0;
      const requestIsZero = !hasRequestCost || pricing.costPerRequest === 0;

      return inputIsZero && outputIsZero && requestIsZero;
    } catch (error) {
      logger.debug(`Error checking zero cost for ${provider.id}/${model.name}: ${error}`);
      return false;
    }
  }

  /**
   * Randomly selects one item from an array.
   */
  private randomSelect<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot select from empty array");
    }
    const randomIndex = Math.floor(Math.random() * items.length);
    return items[randomIndex];
  }

  public async chooseProvider(req: Request, res: Response, next: NextFunction) {
    const modelname = req.body.model;
    logger.debug(`Finding a provider for model: ${modelname}`);

    const candidates = this.getProvidersForModel(modelname);
    if (!candidates || candidates.length === 0) {
      logger.warn(`No configured provider found for model: ${modelname}`);
      return res
        .status(404)
        .json({ error: `No configured provider found for model: ${modelname}` });
    }
    logger.debug(
      `Identified candidate providers: ${candidates.map((c) => c.provider.id).join(", ")}`,
    );

    // Filter candidates to only those under rate limits
    const availableCandidates = [];
    for (const candidate of candidates) {
      const { provider, model } = candidate;
      // Use the real model name for rate limiting checks
      if (await this.usageManager.isUnderLimit(provider.id, model.name)) {
        availableCandidates.push(candidate);
      } else {
        logger.debug(
          `Skipping provider '${provider.id}' for model '${modelname}' (real name: '${model.name}') due to rate limits.`,
        );
      }
    }

    if (availableCandidates.length === 0) {
      logger.error(
        `All providers for model '${modelname}' are at their rate limits.`
      );
      return res.status(503).json({
        error: `All providers for model '${modelname}' are currently at their rate limit. Please try again later.`,
      });
    }

    // Step 1: Check for zero-cost providers
    const zeroCostCandidates = availableCandidates.filter(candidate =>
      this.isZeroCost(candidate.provider, candidate.model)
    );

    let selectedCandidate;
    if (zeroCostCandidates.length > 0) {
      // If we have zero-cost providers, select randomly from them
      logger.debug(`Found ${zeroCostCandidates.length} zero-cost providers, selecting randomly`);
      selectedCandidate = this.randomSelect(zeroCostCandidates);
    } else {
      // No zero-cost providers, select randomly from all available candidates
      logger.debug(`No zero-cost providers found, selecting randomly from ${availableCandidates.length} available providers`);
      selectedCandidate = this.randomSelect(availableCandidates);
    }

    const { provider, model } = selectedCandidate;
    logger.debug(`Selected provider '${provider.id}' for model '${modelname}' (real name: '${model.name}').`);
    res.locals.chosenProvider = provider;
    res.locals.chosenModel = model;
    return next();
  }
}
