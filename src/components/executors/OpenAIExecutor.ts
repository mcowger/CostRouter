import { Provider } from "../../schemas/provider.schema.js";
import { logger } from "../Logger.js";
import { Request, Response } from "express";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  generateText,
  LanguageModelV1,
  streamText,
} from "ai";
import { getErrorMessage } from "../Utils.js";
import { BaseExecutor } from "./BaseExecutor.js";
import { UsageManager } from "../UsageManager.js";

export class OpenAIExecutor extends BaseExecutor {

  constructor(usageManager: UsageManager) {
    super(usageManager);
  }

  public async execute(req: Request, res: Response): Promise<void> {
    const chosenProvider = res.locals.chosenProvider as Provider;
    logger.debug({ provider: chosenProvider }, "Executing request with OpenAI provider:");

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
    const model: LanguageModelV1 = llm(req.body.model as string);

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
}