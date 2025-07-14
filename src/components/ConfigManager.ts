// src/components/ConfigManager.ts
import { promises as fs } from 'fs';
import { AppConfig, AppConfigSchema } from '../schemas/appConfig.schema.js';
import { Provider } from '../schemas/provider.schema.js';
import { parse } from 'jsonc-parser';
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { logger, PinoLogger } from "./Logger.js";
import { getErrorMessage } from './Utils.js';

export class ConfigManager {
    private static instance: ConfigManager;
    private config: AppConfig;

    // Private constructor to enforce singleton pattern
    private constructor(initialConfig: AppConfig) {
        this.config = initialConfig;
    }

    /**
     * Initializes the singleton ConfigManager by loading and validating the config file.
     * This should be called once at application startup.
     */
    public static async initialize(): Promise<ConfigManager> {
        if (ConfigManager.instance) {
            logger.warn("ConfigManager has already been initialized.");
            return ConfigManager.getInstance();
        }

        try {
          // 1. --- Argument Parsing ---
          const argv = await yargs(hideBin(process.argv))
            .option("config", {
              alias: "c",
              type: "string",
              description: "Path to the configuration JSON(C) file",
              demandOption: true, // Makes this a required argument
            })
            .option("loglevel", {
              alias: "l",
              type: "string",
              description: "Logging level (e.g., info, debug, warn, error)",
              default: "info", // Default log level
            })
            .parse();
          logger.level = argv.loglevel || "info"; // Set the log level based on the argument
          const rawData = await fs.readFile(argv.config, "utf-8");
          // Use jsonc-parser to parse JSONC (JSON with comments)
          const json = parse(rawData);

          // Validate the data on load. Throws a detailed error on failure.
          const validatedConfig = AppConfigSchema.parse(json);

          ConfigManager.instance = new ConfigManager(validatedConfig);
          logger.info("Configuration loaded and validated successfully from: ", argv.config);
          return ConfigManager.instance;
        } catch (error) {
            logger.error(`Failed to initialize ConfigManager: ${getErrorMessage(error)}`);
            // Exit the process if config is invalid or not found, as the app cannot run.
            process.exit(1);
        }
    }

    /**
     * Returns the singleton instance of the ConfigManager.
     * Throws an error if it hasn't been initialized.
     */
    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            throw new Error("ConfigManager must be initialized before use.");
        }
        return ConfigManager.instance;
    }
    public static getProviders(): Provider[] {
        if (!ConfigManager.instance) {
            throw new Error("ConfigManager must be initialized before use.");
        }
        return ConfigManager.instance.config.providers;
    }
}