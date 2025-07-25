import { promises as fs } from 'fs';
import path from 'path';
import EventEmitter from 'events';
import { parse } from 'jsonc-parser';
import { AppConfig, AppConfigSchema } from '../../schemas/appConfig.schema.js';
import { Provider } from '../../schemas/provider.schema.js';
import { logger } from './Logger.js';
import { getErrorMessage } from './Utils.js';
import { IConfigManager } from './IConfigManager.js';

export class FileSystemConfigManager implements IConfigManager {
  public events: EventEmitter = new EventEmitter();
  private config: AppConfig;
  private readonly configPath: string;

  private constructor(initialConfig: AppConfig, configPath: string) {
    this.config = initialConfig;
    this.configPath = configPath;
  }

  public static async create(configPath: string): Promise<IConfigManager> {
    let validatedConfig: AppConfig;
    let configLoaded = false;

    try {
      const rawData = await fs.readFile(configPath, 'utf-8');
      const json = parse(rawData);
      validatedConfig = AppConfigSchema.parse(json);
      configLoaded = true;
    } catch (error: any) {
      logger.warn(`Failed to load or parse configuration file (${configPath}): ${getErrorMessage(error)}`);
      logger.warn('Attempting to initialize with minimal valid configuration.');

      validatedConfig = { providers: [] }; // Minimal valid config

      if (error.code === 'ENOENT') {
        try {
          const defaultConfigContent = JSON.stringify(validatedConfig, null, 2);
          const dir = path.dirname(configPath);
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(configPath, defaultConfigContent, 'utf-8');
          logger.info(`Created default configuration file at: ${configPath}`);
        } catch (writeError) {
          logger.error(`Failed to create default config file: ${getErrorMessage(writeError)}`);
        }
      } else {
        logger.warn(`Existing config file is invalid. Proceeding with minimal configuration.`);
      }
    }

    const instance = new FileSystemConfigManager(validatedConfig, configPath);

    if (configLoaded) {
      logger.info('Configuration loaded and validated successfully from: ', configPath);
    } else {
      logger.info('FileSystemConfigManager initialized with fallback configuration.');
    }

    return instance;
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public getProviders(): Provider[] {
    return this.config.providers;
  }

  public async updateConfig(newConfig: AppConfig): Promise<void> {
    const validatedConfig = AppConfigSchema.parse(newConfig);
    this.config = validatedConfig;
    this.events.emit('configUpdated', validatedConfig);
    logger.info('Configuration updated in memory and event emitted.');

    const tempPath = `${this.configPath}.${Date.now()}.tmp`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(validatedConfig, null, 2), 'utf-8');
      await fs.rename(tempPath, this.configPath);
      logger.info('Configuration file updated successfully.');
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw new Error(`Failed to write configuration to file: ${getErrorMessage(error)}`);
    }
  }
}