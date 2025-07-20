// src/components/ConfigManager.ts
import { promises as fs } from 'fs';
import { AppConfig, AppConfigSchema } from '../../schemas/appConfig.schema.js';
import { Provider } from '../../schemas/provider.schema';
import { parse } from 'jsonc-parser';
import { logger, PinoLogger } from "./Logger.js";
import { getErrorMessage } from './Utils.js';

export class ConfigManager {
    private static instance: ConfigManager;
    private config: AppConfig;
    private configPath: string;

    // Private constructor to enforce singleton pattern
    private constructor(initialConfig: AppConfig, configPath: string) {
        this.config = initialConfig;
        this.configPath = configPath;
    }

    /**
     * Initializes the singleton ConfigManager by loading and validating the config file.
     * This should be called once at application startup.
     */
    public static async initialize(configPath: string): Promise<ConfigManager> {
        if (ConfigManager.instance) {
            logger.warn("ConfigManager has already been initialized.");
            return ConfigManager.getInstance();
        }

        try {
          const rawData = await fs.readFile(configPath, "utf-8");
          // Use jsonc-parser to parse JSONC (JSON with comments)
          const json = parse(rawData);

          // Validate the data on load. Throws a detailed error on failure.
          const validatedConfig = AppConfigSchema.parse(json);

          ConfigManager.instance = new ConfigManager(validatedConfig, configPath);
          logger.info("Configuration loaded and validated successfully from: ", configPath);
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

    public static getConfig(): AppConfig {
        if (!ConfigManager.instance) {
            throw new Error("ConfigManager must be initialized before use.");
        }
        return ConfigManager.instance.config;
    }

    public static async updateConfig(newConfig: AppConfig): Promise<void> {
        if (!ConfigManager.instance) {
            throw new Error("ConfigManager must be initialized before use.");
        }

        // Validate the new config before applying it
        const validatedConfig = AppConfigSchema.parse(newConfig);
        ConfigManager.instance.config = validatedConfig;

        // Atomically write the new config to the file
        const tempPath = `${ConfigManager.instance.configPath}.${Date.now()}.tmp`;
        try {
            await fs.writeFile(tempPath, JSON.stringify(validatedConfig, null, 2), 'utf-8');
            await fs.rename(tempPath, ConfigManager.instance.configPath);
            logger.info("Configuration file updated successfully.");
        } catch (error) {
            // If something goes wrong, try to clean up the temp file
            try {
                await fs.unlink(tempPath);
            } catch (cleanupError) {
                // Ignore errors during cleanup
            }
            throw new Error(`Failed to write configuration to file: ${getErrorMessage(error)}`);
        }
    }
}