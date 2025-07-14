import express from "express";
import { ConfigManager } from "./components/ConfigManager.js";
import { Router } from "./components/Router.js";
import { UsageManager } from "./components/UsageManager.js";
import { logger, responseBodyLogger, requestResponseLogger } from "./components/Logger.js";
import { Executor } from "./components/Executor.js";

async function main() {
  // --- 1. Initialize Singletons in Order ---
  await ConfigManager.initialize();
  UsageManager.initialize();
  Router.initialize();
  
  // --- 2. Get Instances ---
  const router = Router.getInstance();
  const usageManager = UsageManager.getInstance();
  const executor = Executor.getInstance(usageManager);

  // --- 3. Express Server Setup ---
  const app = express();
  app.use(express.json());
  app.use(responseBodyLogger);
  app.use(requestResponseLogger);

  // --- 4. Core API Route ---
  app.post(
    "/v1/chat/completions",
    router.chooseProvider.bind(router), // Bind 'this' context for router
    executor.execute.bind(executor),   // Bind 'this' context for executor
  );

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`LLM Gateway listening on port ${PORT}`);
  });
}

// Run the main function and catch any top-level errors.
main().catch((error) => {
  console.error("Failed to start the application:", error);
  process.exit(1);
});
