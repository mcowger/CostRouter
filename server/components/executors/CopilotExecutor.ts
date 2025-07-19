import { Provider } from "../../schemas/provider.schema.js";
import { Model } from "../../schemas/model.schema.js";
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
import { CopilotTokenManager } from "../CopilotTokenManager.js";

const COPILOT_API_HOST = "api.githubcopilot.com";

const COPILOT_HEADERS = {
  "editor-version": "vscode/1.85.1",
  "Copilot-Integration-Id": "vscode-chat",
};

export class CopilotExecutor extends BaseExecutor {
  private tokenManager: CopilotTokenManager;

  constructor(usageManager: UsageManager) {
    super(usageManager);
    this.tokenManager = CopilotTokenManager.getInstance();
  }

  public async execute(req: Request, res: Response): Promise<void> {
    const chosenProvider = res.locals.chosenProvider as Provider;
    const chosenModel = res.locals.chosenModel as Model;
    logger.debug({ provider: chosenProvider, model: chosenModel }, "Executing request with Copilot provider:");

    if (chosenProvider.type !== "copilot") {
      logger.error(
        `Provider ${chosenProvider.id} is not configured correctly for Copilot API.`,
      );
      res.status(500).json({ error: "Provider not configured" });
      return;
    }

    try {
      const bearerToken = await this.tokenManager.getBearerToken();

      const llm = createOpenAICompatible({
        name: chosenProvider.id,
        baseURL: `https://${COPILOT_API_HOST}`,
        apiKey: bearerToken,
        headers: COPILOT_HEADERS,
      });

      const { messages, stream = false } = req.body;
      // Use the real model name for the API call
      const model: LanguageModelV1 = llm(chosenModel.name);

      if (stream) {
        const result = await streamText({ model, messages });
        this.handleStreamingResponse(res, chosenProvider, chosenModel, result);
      } else {
        const result = await generateText({ model, messages });
        this.handleNonStreamingResponse(res, chosenProvider, chosenModel, result);
      }
    } catch (error) {
      logger.error(`AI request failed for provider ${chosenProvider.id}: ${getErrorMessage(error)}`);
      res.status(500).json({ error: "AI request failed" });
    }
  }
}