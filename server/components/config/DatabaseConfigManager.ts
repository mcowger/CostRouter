import EventEmitter from 'events';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { AppConfig, AppConfigSchema } from '#schemas/appConfig.schema';
import { Provider } from '#schemas/provider.schema';
import { IConfigManager, LimiterState } from './IConfigManager.js';
import { logger } from '../Logger.js';

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
    this.db = new Low(adapter, { providers: [], limiterState: {} });
    this.config = { providers: [], limiterState: {} };
  }

  public static async initialize(databasePath: string): Promise<DatabaseConfigManager> {
    logger.info(`Initializing config database at ${databasePath}...`);
    const instance = new DatabaseConfigManager(databasePath);

    await instance.db.read();

    // If the database file is new, it will be null, so we should write the default.
    if (instance.db.data === null) {
      instance.db.data = { providers: [], limiterState: {} };
      await instance.db.write();
    }

    // Sanitize limiterState to remove invalid entries left by rate-limiter-flexible
    if (instance.db.data.limiterState) {
      for (const key in instance.db.data.limiterState) {
        const entry = instance.db.data.limiterState[key];
        // Only remove entries that are truly invalid (null, undefined, or non-objects)
        // Empty objects {} are valid - they represent "no limit configured" for this key
        if (!entry || typeof entry !== 'object') {
          logger.warn(`Removing invalid limiter state entry for key: ${key}`);
          delete instance.db.data.limiterState[key];
        } else if (Object.keys(entry).length > 0) {
          // If the entry has properties, validate they are correct types
          // If not, silently remove without warning
          if (!('points' in entry) || !('ms' in entry) || 
              typeof entry.points !== 'number' || typeof entry.ms !== 'number') {
            delete instance.db.data.limiterState[key];
          }
        }
        // Empty objects {} are kept as valid "no limit configured" entries
      }
    } else {
      // If limiterState is missing, initialize it to prevent data loss on write.
      instance.db.data.limiterState = {};
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
    Object.assign(this.db.data, validatedConfig);
    await this.db.write();

    this.events.emit('configUpdated', this.config);
    logger.info("Configuration has been updated and saved to the database.");
  }

  public async reloadConfig(): Promise<void> {
    logger.info("Reloading configuration from database...");
    
    // Re-read the configuration from disk
    await this.db.read();
    
    // Sanitize limiterState (same logic as initialization)
    if (this.db.data.limiterState) {
      for (const key in this.db.data.limiterState) {
        const entry = this.db.data.limiterState[key];
        // Only remove entries that are truly invalid (null, undefined, or non-objects)
        // Empty objects {} are valid - they represent "no limit configured" for this key
        if (!entry || typeof entry !== 'object') {
          logger.warn(`Removing invalid limiter state entry for key: ${key}`);
          delete this.db.data.limiterState[key];
        } else if (Object.keys(entry).length > 0) {
          // If the entry has properties, validate they are correct types
          // If not, silently remove without warning
          if (!('points' in entry) || !('ms' in entry) || 
              typeof entry.points !== 'number' || typeof entry.ms !== 'number') {
            delete this.db.data.limiterState[key];
          }
        }
        // Empty objects {} are kept as valid "no limit configured" entries
      }
    } else {
      this.db.data.limiterState = {};
    }

    // Validate and update the config
    this.config = AppConfigSchema.parse(this.db.data);
    
    // Emit the configUpdated event so other components can react
    this.events.emit('configUpdated', this.config);
    logger.info("Configuration reloaded successfully from database.");
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