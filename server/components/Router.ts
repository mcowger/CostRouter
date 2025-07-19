import { Provider } from "../../schemas/provider.schema.js";
import { Model } from "../../schemas/model.schema.js";
import { ConfigManager } from "./ConfigManager.js";
import { logger } from "./Logger.js";
import { Request, Response, NextFunction } from "express";
import { UsageManager } from "./UsageManager.js";

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
    const providers: Provider[] = ConfigManager.getProviders();
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

    for (const candidate of candidates) {
      const { provider, model } = candidate;
      // Use the real model name for rate limiting checks
      if (await this.usageManager.isUnderLimit(provider.id, model.name)) {
        logger.debug(`Selected provider '${provider.id}' for model '${modelname}' (real name: '${model.name}') as it has available capacity.`);
        res.locals.chosenProvider = provider;
        res.locals.chosenModel = model;
        return next();
      }
      logger.debug(
        `Skipping provider '${provider.id}' for model '${modelname}' (real name: '${model.name}') due to rate limits.`,
      );
    }

    logger.error(
      `All providers for model '${modelname}' are at their rate limits.`
    );
    return res.status(503).json({
      error: `All providers for model '${modelname}' are currently at their rate limit. Please try again later.`,
    });
  }
}
