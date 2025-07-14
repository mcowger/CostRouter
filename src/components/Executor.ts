import { Provider } from "../schemas/provider.schema.js";
import { UsageManager } from "./UsageManager.js";
import { logger } from "./Logger.js";
import { Request, Response } from "express";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  generateText,
  LanguageModelV1,
  streamText,
  GenerateTextResult,
  StreamTextResult,
} from "ai";
import { getErrorMessage } from "./Utils.js";

export class Executor {
  private static instance: Executor;
  private usageManager: UsageManager;

  private constructor(usageManager: UsageManager) {
    this.usageManager = usageManager;
  }

  public static getInstance(usageManager: UsageManager): Executor {
    if (!Executor.instance) {
      Executor.instance = new Executor(usageManager);
    }
    return Executor.instance;
  }

  public async execute(req: Request, res: Response): Promise<void> {
    const chosenProvider = res.locals.chosenProvider as Provider;
    logger.debug({ provider: chosenProvider }, "Executing request with provider:");

    if (
      chosenProvider.type !== "openai" ||
      !chosenProvider.baseURL ||
      !chosenProvider.apiKey
    ) {
      logger.error(
        `Provider ${chosenProvider.id} is not configured correctly for OpenAI API.`,
      );
      res.status(500).json({ error: "Provider not configured" });
      return;
    }

    const llm = createOpenAICompatible({
      name: chosenProvider.id,
      baseURL: chosenProvider.baseURL,
      apiKey: chosenProvider.apiKey,
    });

    const { messages, stream = false } = req.body;
    // @ts-expect-error: createOpenAICompatible returns a LanguageModelV1
    const model: LanguageModelV1 = llm(req.body.model as string);

    // ----- Handle Streaming and Non-Streaming -----
    try {
      if (stream) {
        const result = await streamText({ model, messages });
        this.handleStreamingResponse(res, chosenProvider, result);
      } else {
        const result = await generateText({ model, messages });
        this.handleNonStreamingResponse(res, chosenProvider, result);
      }
    } catch (error) {
      logger.error(`AI request failed for provider ${chosenProvider.id}: ${getErrorMessage(error)}`);
      res.status(500).json({ error: "AI request failed" });
    }
  }

  // ----- Streaming Response Handler -----
  private handleStreamingResponse(
    res: Response,
    provider: Provider,
    result: StreamTextResult<any>,
  ): void {
    result.pipeDataStreamToResponse(res);

    // Consume usage after the stream is finished
    result.usage
      .then((usage) => {
        this.usageManager.consume(provider.id, usage);
      })
      .catch((error) => {
        logger.error(`Failed to consume usage for streaming request: ${getErrorMessage(error)}`);
      });
  }

  // ----- Non-Streaming Response Handler -----
  private handleNonStreamingResponse(
    res: Response,
    provider: Provider,
    result: GenerateTextResult<any>,
  ): void {
    // Consume usage immediately
    this.usageManager.consume(provider.id, result.usage);
    res.json(result);
  }
}
