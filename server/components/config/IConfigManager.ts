import EventEmitter from 'events';
import { AppConfig } from '#schemas/appConfig.schema';
import { Provider } from '#schemas/provider.schema';

export type LimiterState = Record<string, { points: number; ms: number }>;

export interface IConfigManager {
  events: EventEmitter;
  getConfig(): AppConfig;
  getProviders(): Provider[];
  updateConfig(newConfig: AppConfig): Promise<void>;
  getLimiterState(): Promise<LimiterState | undefined>;
  storeLimiterState(state: LimiterState): Promise<void>;
}