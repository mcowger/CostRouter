// src/components/ConfigManager.ts
import { promises as fs } from 'fs';
import { AppConfig, AppConfigSchema } from '../../schemas/appConfig.schema.js';
import { Provider } from '../../schemas/provider.schema';
import { parse } from 'jsonc-parser';
import { logger } from "./Logger.js";
import { getErrorMessage } from './Utils.js';
import path from 'path'; // Import path module

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

        let validatedConfig: AppConfig;
        let configLoaded = false;

        try {
          const rawData = await fs.readFile(configPath, "utf-8");
          const json = parse(rawData);
          validatedConfig = AppConfigSchema.parse(json);
          configLoaded = true;
        } catch (error: any) {
            logger.warn(`Failed to load or parse configuration file (${configPath}): ${getErrorMessage(error)}`);
            logger.warn("Attempting to initialize with minimal valid configuration.");

            validatedConfig = { providers: [] }; // Minimal valid config

            // If file not found, try to create it with default content
            if (error.code === 'ENOENT') {
                try {
                    const defaultConfigContent = JSON.stringify(validatedConfig, null, 2);
                    const dir = path.dirname(configPath);
                    await fs.mkdir(dir, { recursive: true });
                    await fs.writeFile(configPath, defaultConfigContent, 'utf-8');
                    logger.info(`Created default configuration file at: ${configPath}`);
                } catch (writeError) {
                    logger.error(`Failed to create default config file: ${getErrorMessage(writeError)}`);
                    // Continue with minimal config but warn if cannot write
                }
            } else {
                // If it's a parsing error or other issue, just log and proceed with minimal config
                logger.warn(`Existing config file is invalid. Proceeding with minimal configuration.`);
            }
        }

        ConfigManager.instance = new ConfigManager(validatedConfig, configPath);
        if (configLoaded) {
            logger.info("Configuration loaded and validated successfully from: ", configPath);
        } else {
            logger.info("ConfigManager initialized with fallback configuration.");
        }
        return ConfigManager.instance;
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