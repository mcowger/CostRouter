import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { subHours, isBefore, parseISO } from "date-fns";
import {
  UsageDatabase,
  UsageRecord,
  UsageRecordSchema,
} from "../../schemas/usage.schema.js";
import { logger } from "./Logger.js";
import { getErrorMessage } from "./Utils.js";

type UsageRecordInput = Omit<UsageRecord, "timestamp" | "totalTokens">;

export class UsageDatabaseManager {
  private static instance: UsageDatabaseManager;
  private db: Low<UsageDatabase>;

  private constructor(dbPath: string) {
    const adapter = new JSONFile<UsageDatabase>(dbPath);
    this.db = new Low(adapter, { records: [] });
  }

  public static async initialize(dbPath: string): Promise<void> {
    if (UsageDatabaseManager.instance) {
      logger.warn("UsageDatabaseManager has already been initialized.");
      return;
    }
    logger.info(`Initializing usage database at ${dbPath}...`);
    UsageDatabaseManager.instance = new UsageDatabaseManager(dbPath);
    await UsageDatabaseManager.instance.db.read();
    logger.info("Usage database initialized.");
  }

  public static getInstance(): UsageDatabaseManager {
    if (!UsageDatabaseManager.instance) {
      throw new Error("UsageDatabaseManager must be initialized before use.");
    }
    return UsageDatabaseManager.instance;
  }

  public async recordUsage(data: UsageRecordInput): Promise<void> {
    const totalTokens = (data.promptTokens || 0) + (data.completionTokens || 0);
    const newRecord: UsageRecord = {
      ...data,
      timestamp: new Date().toISOString(),
      totalTokens,
    };

    // This ensures defaults are applied if any fields are missing
    const parsedRecord = UsageRecordSchema.parse(newRecord);

    this.db.data.records.push(parsedRecord);
    await this.db.write();
    logger.info("Recorded usage to database:", parsedRecord);
  }

  public async getUsage(
    hours: number,
    filters: { model?: string; providerId?: string },
  ): Promise<UsageRecord[]> {
    await this.db.read();
    const cutoffDate = subHours(new Date(), hours);

    return this.db.data.records.filter((record) => {
      const recordDate = parseISO(record.timestamp);
      if (isBefore(recordDate, cutoffDate)) {
        return false;
      }
      if (filters.model && record.model !== filters.model) {
        return false;
      }
      if (filters.providerId && record.providerId !== filters.providerId) {
        return false;
      }
      return true;
    });
  }

  public async pruneOldRecords(hours: number): Promise<number> {
    await this.db.read();
    const originalCount = this.db.data.records.length;
    const cutoffDate = subHours(new Date(), hours);

    this.db.data.records = this.db.data.records.filter((record) => {
      const recordDate = parseISO(record.timestamp);
      return !isBefore(recordDate, cutoffDate);
    });

    await this.db.write();
    const removedCount = originalCount - this.db.data.records.length;
    if (removedCount > 0) {
      logger.info(
        `Pruned ${removedCount} old usage records (older than ${hours} hours).`,
      );
    } else {
      logger.debug("No usage records needed pruning.");
    }
    return removedCount;
  }
}
