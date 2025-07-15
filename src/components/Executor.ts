import { Provider } from "../schemas/provider.schema.js";
import { UsageManager } from "./UsageManager.js";
import { logger } from "./Logger.js";
import { Request, Response } from "express";
import { BaseExecutor, CopilotExecutor, OpenAIExecutor } from "./executors/index.js";

export class Executor {
  private static instance: Executor;
  private usageManager: UsageManager;
  private executors: Map<string, BaseExecutor>;

  private constructor(usageManager: UsageManager) {
    this.usageManager = usageManager;
    this.executors = new Map();
    this.registerExecutors();
  }

  private registerExecutors(): void {
    this.executors.set("openai", new OpenAIExecutor(this.usageManager));
    this.executors.set("copilot", new CopilotExecutor(this.usageManager));
    // Register other executors here
  }

  public static getInstance(usageManager: UsageManager): Executor {
    if (!Executor.instance) {
      Executor.instance = new Executor(usageManager);
    }
    return Executor.instance;
  }

  public async execute(req: Request, res: Response): Promise<void> {
    const chosenProvider = res.locals.chosenProvider as Provider;
    const executor = this.executors.get(chosenProvider.type);

    if (!executor) {
      logger.error(`No executor found for provider type: ${chosenProvider.type}`);
      res.status(500).json({ error: "Executor not found" });
      return;
    }

    await executor.execute(req, res);
  }
}
