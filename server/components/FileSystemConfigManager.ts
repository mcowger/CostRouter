import EventEmitter from 'events';
import { promises as fs } from 'fs';
import { parse } from 'jsonc-parser';
import { AppConfig, AppConfigSchema } from '../../schemas/appConfig.schema.js';
import { Provider } from '../../schemas/provider.schema.js';
import { IConfigManager, LimiterState } from './IConfigManager.js';
import { logger } from './Logger.js';

export class FileSystemConfigManager implements IConfigManager {
  public events = new EventEmitter();
  private config!: AppConfig;
  private configPath: string;

  private constructor(configPath: string) {
    this.configPath = configPath;
  }

  public static async initialize(configPath: string): Promise<FileSystemConfigManager> {
    const instance = new FileSystemConfigManager(configPath);
    await instance.loadConfig();
    return instance;
  }

  private async loadConfig(): Promise<void> {
    logger.info(`Loading configuration from file: ${this.configPath}`);
    try {
      const rawData = await fs.readFile(this.configPath, 'utf8');
      const parsedData = parse(rawData);
      const validationResult = AppConfigSchema.safeParse(parsedData);

      if (!validationResult.success) {
        logger.error({
          message: 'Invalid configuration file.',
          errors: validationResult.error.flatten(),
        });
        throw new Error('Failed to validate configuration file.');
      }

      this.config = validationResult.data;
      logger.info('Configuration loaded and validated successfully.');
    } catch (error) {
      logger.error(`Failed to load or parse configuration file: ${error}`);
      throw error;
    }
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public getProviders(): Provider[] {
    return this.config.providers;
  }

  public async updateConfig(newConfig: AppConfig): Promise<void> {
    const validationResult = AppConfigSchema.safeParse(newConfig);
    if (!validationResult.success) {
      logger.error({
        message: 'Invalid configuration provided for update.',
        errors: validationResult.error.flatten(),
      });
      throw new Error('Failed to validate new configuration.');
    }

    this.config = validationResult.data;
    await this.saveConfig();
    this.events.emit('config-updated', this.config);
  }

  private async saveConfig(): Promise<void> {
    logger.info(`Saving configuration to file: ${this.configPath}`);
    const tempPath = `${this.configPath}.tmp`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(this.config, null, 2), 'utf8');
      await fs.rename(tempPath, this.configPath);
      logger.info('Configuration saved successfully.');
    } catch (error) {
      logger.error(`Failed to save configuration: ${error}`);
      // Attempt to clean up the temporary file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore errors during cleanup
      }
      throw error;
    }
  }
  public async getLimiterState(): Promise<LimiterState | undefined> {
    logger.warn('Limiter state persistence is not supported by FileSystemConfigManager. State will not be saved.');
    return Promise.resolve(undefined);
  }

  public async storeLimiterState(): Promise<void> {
    // No-op for file system-based config.
    return Promise.resolve();
  }
}