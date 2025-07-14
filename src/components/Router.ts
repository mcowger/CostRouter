import { Provider } from "../schemas/provider.schema.js";
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


  private getProvidersForModel(modelname: string): Provider[] | undefined {
    logger.debug(`Searching for providers for model: ${modelname}`);
    const providers: Provider[] = ConfigManager.getProviders();
    const filteredProviders = providers.filter((provider) =>
      provider.models.includes(modelname),
    );
    return filteredProviders.length > 0 ? filteredProviders : undefined;
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
      `Identified candidate providers: ${candidates.map((p) => p.id).join(", ")}`,
    );

    for (const provider of candidates) {
      if (await this.usageManager.isUnderLimit(provider.id)) {
        logger.debug(`Selected provider '${provider.id}' as it has available capacity.`);
        res.locals.chosenProvider = provider;
        return next();
      }
      logger.debug(
        `Skipping provider '${provider.id}' due to rate limits.`,
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
