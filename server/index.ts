import express from "express";
import cors from "cors";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import path from 'path';
import { ConfigManager } from "./components/config/ConfigManager.js";
import { PriceData } from "./components/PriceData.js";
import { Router } from "./components/Router.js";
import { UsageManager } from "./components/UsageManager.js";
import { logger, responseBodyLogger, requestResponseLogger, PinoLogger } from "./components/Logger.js";
import { UnifiedExecutor } from "./components/UnifiedExecutor.js";
import { getErrorMessage } from "./components/Utils.js";

const COPILOT_CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const COPILOT_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const COPILOT_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';

async function main() {
  // --- 1. Argument Parsing ---
  const argv = await yargs(hideBin(process.argv))
    .option("config-database", {
      alias: "cd",
      type: "string",
      description: "Path to the configuration LowDB JSON database file",
      required: true,
    })
    .option("loglevel", {
      alias: "l",
      type: "string",
      description: "Logging level (info, debug, warn, error)",
      default: "info",
    })
    .parse();

  // Set initial log level from CLI argument
  logger.level = argv.loglevel;

  // --- 2. Initialize Singletons in Order ---
  await ConfigManager.initialize({ databasePath: argv.configDatabase as string });
  
  // Apply log level from config if available, otherwise use CLI argument
  try {
    const config = ConfigManager.getInstance().getConfig();
    const configLogLevel = config.logLevel;
    const finalLogLevel = configLogLevel || argv.loglevel;
    PinoLogger.setLogLevel(finalLogLevel);
    logger.info(`Log level set to: ${finalLogLevel}${configLogLevel ? ' (from config)' : ' (from CLI)'}`);
  } catch (error) {
    logger.warn(`Failed to apply config log level, using CLI argument: ${argv.loglevel}`);
    PinoLogger.setLogLevel(argv.loglevel);
  }
  PriceData.initialize();
  await UsageManager.initialize();
  Router.initialize();


  // --- 3. Get Instances ---
  const router = Router.getInstance();
  const usageManager = UsageManager.getInstance();
  UnifiedExecutor.initialize(usageManager);
  const executor = UnifiedExecutor.getInstance();

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
      const providers = ConfigManager.getInstance().getProviders();
      const allModels = new Set<string>();

      for (const provider of providers) {
        for (const model of provider.models) {
          allModels.add(model.mappedName ?? model.name);
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
      const config = ConfigManager.getInstance().getConfig();
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
      await ConfigManager.getInstance().updateConfig(newConfig);
      res.json({ message: "Configuration updated successfully." });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to set config: ${message}`);
      res.status(500).json({ error: "Failed to update configuration." });
    }
  });

  app.post("/admin/reload", async (_req, res) => {
    try {
      logger.info("Configuration reload requested via API endpoint");
      
      // Persist current usage state before reloading
      await UsageManager.getInstance().persistLimiterState();
      logger.info("Usage state persisted successfully");
      
      // Reload the configuration from disk
      await ConfigManager.getInstance().reloadConfig();
      logger.info("Configuration reloaded from disk");
      
      // The UsageManager will automatically update limiters via the configUpdated event
      // Router and other components will automatically use the new config
      
      res.json({ message: "Configuration reloaded successfully." });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to reload configuration: ${message}`);
      res.status(500).json({ error: "Failed to reload configuration." });
    }
  });

  // --- 7. Logging Admin API Routes ---
  app.get("/admin/logging/level", (_req, res) => {
    try {
      const currentLevel = PinoLogger.getCurrentLogLevel();
      res.json({ level: currentLevel });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to get current log level: ${message}`);
      res.status(500).json({ error: "Failed to retrieve current log level." });
    }
  });

  app.post("/admin/logging/level", (req, res) => {
    try {
      const { level } = req.body;
      if (!level || typeof level !== 'string') {
        return res.status(400).json({ error: "Log level is required and must be a string." });
      }

      PinoLogger.setLogLevel(level);
      logger.info(`Log level changed to: ${level}`);
      
      res.json({ 
        message: `Log level successfully changed to ${level}`,
        level: level 
      });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to set log level: ${message}`);
      res.status(400).json({ error: message });
    }
  });

  // --- 8. Copilot Auth API Routes ---
  app.post("/api/copilot/auth/start", async (_req, res) => {
    try {
      const response = await fetch(COPILOT_DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'User-Agent': 'costrouter-Token-Generator/1.0',
        },
        body: JSON.stringify({ client_id: COPILOT_CLIENT_ID, scope: 'read:user' }),
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      res.json(data);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to start Copilot auth: ${message}`);
      res.status(500).json({ error: "Failed to start Copilot device authorization." });
    }
  });

  app.post("/api/copilot/auth/poll", async (req, res) => {
    try {
      const { device_code, providerId } = req.body;
      if (!device_code || !providerId) {
        return res.status(400).json({ error: "Device code and provider ID are required." });
      }

      const response = await fetch(COPILOT_OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'User-Agent': 'costrouter-Token-Generator/1.0',
        },
        body: JSON.stringify({
          client_id: COPILOT_CLIENT_ID,
          device_code: device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const data = await response.json();

      if (data.error) {
        return res.json(data);
      }

      if (data.access_token) {
        const configManager = ConfigManager.getInstance();
        const currentConfig = configManager.getConfig();
        const provider = currentConfig.providers.find(p => p.id === providerId);

        if (provider) {
          provider.oauthToken = data.access_token;
          await configManager.updateConfig(currentConfig);
          logger.info(`Successfully authorized and saved Copilot token for provider: ${providerId}`);
        } else {
          logger.warn(`Provider with ID ${providerId} not found during Copilot auth poll.`);
        }
      }
      res.json(data);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to poll for Copilot token: ${message}`);
      res.status(500).json({ error: "Failed to poll for Copilot token." });
    }
  });


  // --- 9. Usage Dashboard API Route ---
  app.get("/usage/current", async (_req, res) => {
    try {
      logger.debug("Fetching current usage data");
      const usageData = await usageManager.getCurrentUsageData();
      res.json(usageData);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to get current usage data: ${message}`);
      res.status(500).json({ error: "Failed to retrieve current usage data." });
    }
  });

  // --- 9.5. Logging Admin API Routes ---
  app.get("/admin/logging/level", (_req, res) => {
    try {
      const currentLevel = PinoLogger.getCurrentLogLevel();
      res.json({ level: currentLevel });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to get log level: ${message}`);
      res.status(500).json({ error: "Failed to retrieve log level." });
    }
  });

  app.post("/admin/logging/level", (req, res) => {
    try {
      const { level } = req.body;
      if (!level || typeof level !== 'string') {
        return res.status(400).json({ error: "Log level is required and must be a string." });
      }

      PinoLogger.setLogLevel(level);
      logger.info(`Log level changed to: ${level}`);
      res.json({ message: `Log level successfully changed to ${level}`, level });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Failed to set log level: ${message}`);
      res.status(400).json({ error: message });
    }
  });

  // --- 10. Test Usage Simulation Route (for testing the dashboard) ---
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

  // Use process.cwd() to reliably get the project root directory.
  const projectRoot = process.cwd();

  // The path to the compiled UI is now consistently in `dist/ui`.
  const uiPath = path.join(projectRoot, 'dist', 'ui');

  // Serve all static files from the correct build directory.
  app.use(express.static(uiPath));

  // For any non-API request, send the main index.html file to support the SPA.
  app.get('*', (_req, res) => {
    // Use a try-catch block for graceful error handling if the file is missing.
    try {
      res.sendFile(path.join(uiPath, 'index.html'));
    } catch (err) {
      res.status(404).send('UI not found. Please run the build process.');
    }
  });


  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    logger.info(`LLM Gateway listening on port ${PORT}`);
  });

  // --- Graceful Shutdown ---
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info("HTTP server closed.");
      await UsageManager.shutdown();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Run the main function and catch any top-level errors.
main().catch((error) => {
  console.error("Failed to start the application:", error);
  process.exit(1);
});
