// src/components/ConfigManager.ts
import { logger } from "./Logger.js";
import { FileSystemConfigManager } from './FileSystemConfigManager.js';
import { IConfigManager } from './IConfigManager.js';

export class ConfigManager {
  private static instance: IConfigManager;

  // Private constructor to prevent instantiation
  private constructor() { }

  /**
   * Initializes the singleton ConfigManager by creating a provider-specific instance.
   * This should be called once at application startup.
   */
  public static async initialize(configPath: string): Promise<void> {
    if (ConfigManager.instance) {
      logger.warn("ConfigManager has already been initialized.");
      return;
    }
    // For now, we are hardcoding the FileSystemConfigManager.
    // In the future, we could have a factory that decides which provider to use.
    ConfigManager.instance = await FileSystemConfigManager.create(configPath);
    logger.info("ConfigManager initialized successfully.");
  }

  /**
   * Returns the singleton instance of the ConfigManager.
   * Throws an error if it hasn't been initialized.
   */
  public static getInstance(): IConfigManager {
    if (!ConfigManager.instance) {
      throw new Error("ConfigManager must be initialized before use.");
    }
    return ConfigManager.instance;
  }
}