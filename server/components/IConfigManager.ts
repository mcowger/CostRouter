import EventEmitter from 'events';
import { AppConfig } from '../../schemas/appConfig.schema.js';
import { Provider } from '../../schemas/provider.schema.js';

export interface IConfigManager {
  events: EventEmitter;
  getConfig(): AppConfig;
  getProviders(): Provider[];
  updateConfig(newConfig: AppConfig): Promise<void>;
}