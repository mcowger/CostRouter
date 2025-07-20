import { Provider } from "../../schemas/provider.schema.js";
import { UsageManager } from "./UsageManager.js";
import { logger } from "./Logger.js";
import { Request, Response } from "express";
import { UnifiedExecutor } from "./UnifiedExecutor.js";

/**
 * Main executor class that handles AI requests for all provider types.
 * Now uses the UnifiedExecutor instead of provider-specific executors.
 */
export class Executor {
  private static instance: Executor;
  private unifiedExecutor: UnifiedExecutor;

  private constructor(usageManager: UsageManager) {
    this.unifiedExecutor = new UnifiedExecutor(usageManager);
  }

  public static getInstance(usageManager: UsageManager): Executor {
    if (!Executor.instance) {
      Executor.instance = new Executor(usageManager);
    }
    return Executor.instance;
  }

  /**
   * Executes an AI request using the unified executor.
   * Supports all AI SDK v5 providers.
   */
  public async execute(req: Request, res: Response): Promise<void> {
    const chosenProvider = res.locals.chosenProvider as Provider;

    logger.debug(`Executing request for provider: ${chosenProvider.id} (${chosenProvider.type})`);

    try {
      await this.unifiedExecutor.execute(req, res);
    } catch (error) {
      logger.error(`Execution failed for provider ${chosenProvider.id}: ${error}`);
      res.status(500).json({ error: "Request execution failed" });
    }
  }

  /**
   * Clears the provider instance cache in the unified executor.
   * Useful for testing or when configurations change.
   */
  public clearCache(): void {
    this.unifiedExecutor.clearCache();
  }
}
