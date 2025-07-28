import { IConfigManager, LimiterState } from './IConfigManager.js';
import { DatabaseConfigManager } from './DatabaseConfigManager.js';
import { AppConfig } from '#schemas/appConfig.schema.js';
import { Provider } from '#schemas/provider.schema.js';
import EventEmitter from 'events';

type InitializeParams = {
  databasePath: string;
};

export class ConfigManager implements IConfigManager {
  private static instance: IConfigManager;
  public events: EventEmitter;

  private constructor(manager: IConfigManager) {
    ConfigManager.instance = manager;
    this.events = manager.events;
  }

  public static async initialize(params: InitializeParams): Promise<void> {
    const manager = await DatabaseConfigManager.initialize(params.databasePath);
    new ConfigManager(manager);
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      throw new Error('ConfigManager has not been initialized. Call initialize() first.');
    }
    return new ConfigManager(ConfigManager.instance);
  }

  public getConfig(): AppConfig {
    return ConfigManager.instance.getConfig();
  }

  public getProviders(): Provider[] {
    return ConfigManager.instance.getProviders();
  }

  public updateConfig(newConfig: AppConfig): Promise<void> {
    return ConfigManager.instance.updateConfig(newConfig);
  }

  public reloadConfig(): Promise<void> {
    return ConfigManager.instance.reloadConfig();
  }
  
  public getLimiterState(): Promise<LimiterState | undefined> {
    return ConfigManager.instance.getLimiterState();
  }

  public storeLimiterState(state: LimiterState): Promise<void> {
    return ConfigManager.instance.storeLimiterState(state);
  }
}