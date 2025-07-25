import EventEmitter from 'events';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { AppConfig, AppConfigSchema } from '../../schemas/appConfig.schema.js';
import { Provider } from '../../schemas/provider.schema.js';
import { IConfigManager, LimiterState } from './IConfigManager.js';
import { logger } from './Logger.js';

/**
 * Manages application configuration using a LowDB JSON file.
 */
export class DatabaseConfigManager implements IConfigManager {
  public events = new EventEmitter();
  private db: Low<AppConfig>;
  private config: AppConfig;

  private constructor(dbPath: string) {
    const adapter = new JSONFile<AppConfig>(dbPath);
    // Set default data if the file doesn't exist or is empty
    this.db = new Low(adapter, { providers: [] });
    this.config = { providers: [] };
  }

  public static async initialize(databasePath: string): Promise<DatabaseConfigManager> {
    logger.info(`Initializing config database at ${databasePath}...`);
    const instance = new DatabaseConfigManager(databasePath);

    await instance.db.read();

    // If the database file is new/empty, db.data will be the default.
    // It's good practice to write it back to ensure the file is created.
    if (!instance.db.data || instance.db.data.providers.length === 0) {
      instance.db.data = { providers: [] };
      await instance.db.write();
    }

    // Validate the loaded configuration
    instance.config = AppConfigSchema.parse(instance.db.data);

    logger.info("Config database initialized.");
    return instance;
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public getProviders(): Provider[] {
    return this.config.providers;
  }

  public async updateConfig(newConfig: AppConfig): Promise<void> {
    // Validate the new configuration before updating
    const validatedConfig = AppConfigSchema.parse(newConfig);

    this.config = validatedConfig;
    this.db.data = validatedConfig;
    await this.db.write();

    this.events.emit('config-updated', this.config);
    logger.info("Configuration has been updated and saved to the database.");
  }

  public async getLimiterState(): Promise<LimiterState | undefined> {
    await this.db.read();
    return this.db.data.limiterState;
  }

  public async storeLimiterState(state: LimiterState): Promise<void> {
    this.db.data.limiterState = state;
    await this.db.write();
  }
}