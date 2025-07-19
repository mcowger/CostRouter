import { Provider } from "../../schemas/provider.schema.js";
import { Model } from "../../schemas/model.schema.js";
import { UsageManager } from "../UsageManager.js";
import { logger } from "../Logger.js";
import { Request, Response } from "express";
import { GenerateTextResult, LanguageModelUsage, StreamTextResult } from "ai";
import { getErrorMessage } from "../Utils.js";

export abstract class BaseExecutor {
  protected usageManager: UsageManager;

  constructor(usageManager: UsageManager) {
    this.usageManager = usageManager;
  }

  public abstract execute(req: Request, res: Response): Promise<void>;

  protected calculateCost(model: Model, usage: LanguageModelUsage): number {
    const pricing = model.pricing;
    if (!pricing || !usage) {
      logger.debug(`No pricing or usage data for model '${model.name}'. Cost is 0.`);
      return 0;
    }

    // If a flat request cost is defined, it overrides token-based pricing.
    if (pricing.costPerRequest) {
      return pricing.costPerRequest;
    }

    const inputCost = (usage.promptTokens / 1_000_000) * (pricing.inputCostPerMillionTokens ?? 0);
    const outputCost = (usage.completionTokens / 1_000_000) * (pricing.outputCostPerMillionTokens ?? 0);
    
    const totalCost = inputCost + outputCost;
    logger.debug(`Calculated cost for model '${model.name}': $${totalCost.toFixed(6)}`);
    return totalCost;
  }

  protected handleStreamingResponse(
    res: Response,
    provider: Provider,
    model: Model,
    result: StreamTextResult<any, any>,
  ): void {
    result.pipeDataStreamToResponse(res);

    result.usage
      .then((usage: LanguageModelUsage) => {
        const cost = this.calculateCost(model, usage);
        // Use the real model name for usage tracking
        this.usageManager.consume(provider.id, model.name, usage, cost);
      })
      .catch((error: any) => {
        logger.error(`Failed to consume usage for streaming request: ${getErrorMessage(error)}`);
      });
  }

  protected handleNonStreamingResponse(
    res: Response,
    provider: Provider,
    model: Model,
    result: GenerateTextResult<any, any>,
  ): void {
    const cost = this.calculateCost(model, result.usage);
    // Use the real model name for usage tracking
    this.usageManager.consume(provider.id, model.name, result.usage, cost);
    res.json(result);
  }
}