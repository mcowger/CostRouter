import { Provider } from "../../schemas/provider.schema.js";
import { UsageManager } from "../UsageManager.js";
import { logger } from "../Logger.js";
import { Request, Response } from "express";
import { GenerateTextResult, StreamTextResult } from "ai";
import { getErrorMessage } from "../Utils.js";

export abstract class BaseExecutor {
  protected usageManager: UsageManager;

  constructor(usageManager: UsageManager) {
    this.usageManager = usageManager;
  }

  public abstract execute(req: Request, res: Response): Promise<void>;

  protected handleStreamingResponse(
    res: Response,
    provider: Provider,
    result: StreamTextResult<any, any>,
  ): void {
    result.pipeDataStreamToResponse(res);

    result.usage
      .then((usage: any) => {
        this.usageManager.consume(provider.id, usage);
      })
      .catch((error: any) => {
        logger.error(`Failed to consume usage for streaming request: ${getErrorMessage(error)}`);
      });
  }

  protected handleNonStreamingResponse(
    res: Response,
    provider: Provider,
    result: GenerateTextResult<any, any>,
  ): void {
    this.usageManager.consume(provider.id, result.usage);
    res.json(result);
  }
}