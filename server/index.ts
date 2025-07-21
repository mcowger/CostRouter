import express from "express";
import cors from "cors";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfigManager } from "./components/ConfigManager.js";
import { PriceData } from "./components/PriceData.js";
import { Router } from "./components/Router.js";
import { UsageManager } from "./components/UsageManager.js";
import { UsageDatabaseManager } from "./components/UsageDatabaseManager.js";
import { logger, responseBodyLogger, requestResponseLogger } from "./components/Logger.js";
import { Executor } from "./components/Executor.js";
import { getErrorMessage } from "./components/Utils.js";

async function main() {
  // --- 1. Argument Parsing ---
  const argv = await yargs(hideBin(process.argv))
    .option("config", {
      alias: "c",
      type: "string",
      description: "Path to the configuration JSON(C) file",
      demandOption: true,
    })
    .option("loglevel", {
      alias: "l",
      type: "string",
      description: "Logging level (info, debug, warn, error)",
      default: "info",
    })
    .option("usage-db-path", {
        type: "string",
        description: "Path to the usage database file (e.g., usage.db.json). If not provided, usage tracking is disabled.",
        
    })
    .option("prune-max-age", {
        type: "number",
        description: "Maximum age in hours for usage records. Older records will be pruned on startup.",
        default: 720, // 30 days
    })
    .option("disable-pruning", {
        type: "boolean",
        description: "Disables automatic pruning of old usage records on startup.",
        default: false,
    })
    .parse();

  logger.level = argv.loglevel;

  // --- 2. Initialize Singletons in Order ---
  await ConfigManager.initialize(argv.config);
  await PriceData.initialize();
  UsageManager.initialize();
  Router.initialize();

  if (argv.usageDbPath) {
    await UsageDatabaseManager.initialize(argv.usageDbPath);
    if (!argv.disablePruning && argv.pruneMaxAge > 0) {
      try {
        const dbManager = UsageDatabaseManager.getInstance();
        await dbManager.pruneOldRecords(argv.pruneMaxAge);
      } catch (error) {
        logger.error(`Failed to prune old usage data: ${getErrorMessage(error)}`);
      }
    }
  }
  
  // --- 3. Get Instances ---
  const router = Router.getInstance();
  const usageManager = UsageManager.getInstance();
  const executor = Executor.getInstance(usageManager);

  // --- 3. Express Server Setup ---
  // Initialize Express application
  const app = express();
  // Enable JSON body parsing for incoming requests
  app.use(express.json());
  app.use(cors());

  // Apply response body logging middleware
  app.use(responseBodyLogger);
  // Apply request and response logging middleware
  app.use(requestResponseLogger);

  // --- 4. Health Check Endpoint ---
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  });

  // --- 5. Core API Route ---
  app.post(
    "/v1/chat/completions",
    router.chooseProvider.bind(router),
    executor.execute.bind(executor),
  );

  app.get("/v1/models", (_req, res) => {
    try {
      const providers = ConfigManager.getProviders();
      const allModels = new Set<string>();

      for (const provider of providers) {
        for (const model of provider.models) {
          allModels.add(model.name);
        }
      }

      const modelData = Array.from(allModels).map((modelId) => ({
        id: modelId,
        object: "model",
        created: 1686935002, // Fixed timestamp as requested
        owned_by: "ai",      // Fixed owner as requested
      }));

      res.json({
        object: "list",
        data: modelData,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to get models: ${message}`);
      res.status(500).json({ error: "Failed to retrieve models." });
    }
  });

  // --- 6. Config API Routes ---
  app.get("/config/get", (_req, res) => {
    try {
      const config = ConfigManager.getConfig();
      res.json(config);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to get config: ${message}`);
      res.status(500).json({ error: "Failed to retrieve config." });
    }
  });

  app.post("/config/set", async (req, res) => {
    try {
      const newConfig = req.body;
      await ConfigManager.updateConfig(newConfig);
      res.json({ message: "Configuration updated successfully." });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to set config: ${message}`);
      res.status(500).json({ error: "Failed to update configuration." });
    }
  });

  // --- 7. Usage API Routes ---
  app.get("/usage/get", async (req, res) => {
    try {
      const { hours = '24', model, providerId } = req.query;
      const dbManager = UsageDatabaseManager.getInstance();
      const records = await dbManager.getUsage(parseFloat(hours as string), {
        model: model as string,
        providerId: providerId as string,
      });
      res.json(records);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to get usage data: ${message}`);
      // Don't leak internal error details to the client
      res.status(500).json({ error: "Failed to retrieve usage data." });
    }
  });

  app.post("/usage/prune", async (req, res) => {
    try {
      const { hours = '720' } = req.body;
      const dbManager = UsageDatabaseManager.getInstance();
      const count = await dbManager.pruneOldRecords(parseInt(hours, 10));
      res.json({ message: `Successfully pruned ${count} records.` });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to prune usage data: ${message}`);
      res.status(500).json({ error: "Failed to prune usage data." });
    }
  });

  // --- 8. Usage Dashboard API Route ---
  app.get("/usage/current", async (_req, res) => {
    try {
      const usageData = await usageManager.getCurrentUsageData();
      res.json(usageData);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to get current usage data: ${message}`);
      res.status(500).json({ error: "Failed to retrieve current usage data." });
    }
  });

  // --- 9. Test Usage Simulation Route (for testing the dashboard) ---
  app.post("/usage/simulate", async (req, res) => {
    try {
      const { providerId = "openroutera", model = "moonshotai/kimi-k2:free", tokens = 100, cost = 0.01 } = req.body;

      await usageManager.consume(
        providerId,
        model,
        { promptTokens: Math.floor(tokens * 0.7), completionTokens: Math.floor(tokens * 0.3) },
        cost
      );

      res.json({
        message: `Simulated usage for provider ${providerId}/${model}: ${tokens} tokens, $${cost}`,
        providerId,
        model,
        tokens,
        cost
      });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to simulate usage: ${message}`);
      res.status(500).json({ error: "Failed to simulate usage." });
    }
  });

  // --- Static UI Serving (after API routes) ---
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uiBuildPath = path.join(__dirname, '../ui/dist');
  app.use(express.static(uiBuildPath));

  // Catch-all handler: send back React's index.html file for any non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(uiBuildPath, 'index.html'));
  });

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
