import * as fs from 'fs';
import * as path from 'path';
import { logger } from "./Logger.js";

const COPILOT_TOKEN_API_URL = "https://api.github.com/copilot_internal/v2/token";
const TOKEN_FILE = 'copilot.data';

interface CopilotMeta {
  token: string;
  expiresAt: number;
}

// Token cache storing {token, expiresAt} keyed by oauthToken
const cacheMap = new Map<string, CopilotMeta>();

export class CopilotTokenManager {
  private static instance: CopilotTokenManager;
  private oauthToken: string | null = null;

  private constructor() {
    this.loadTokenFromFile();
  }

  public static getInstance(): CopilotTokenManager {
    if (!CopilotTokenManager.instance) {
      CopilotTokenManager.instance = new CopilotTokenManager();
    }
    return CopilotTokenManager.instance;
  }

  private loadTokenFromFile(): void {
    try {
      const tokenPath = path.resolve(process.cwd(), TOKEN_FILE);
      if (fs.existsSync(tokenPath)) {
        this.oauthToken = fs.readFileSync(tokenPath, 'utf-8').trim();
        logger.info('Successfully loaded Copilot OAuth token from file.');
        logger.debug({ oauthToken: this.oauthToken.slice(0, 10) }, "Copilot OAuth token");
      }
    } catch (error: any) {
      logger.error(`Failed to load Copilot OAuth token: ${error.message}`);
    }
  }

  private isTokenValid(meta?: CopilotMeta): boolean {
    if (!meta) return false;
    const bufferDuration = 5 * 60 * 1000;
    return Date.now() < meta.expiresAt - bufferDuration;
  }

  private async fetchMeta(oauthToken: string): Promise<CopilotMeta> {
    const res = await fetch(COPILOT_TOKEN_API_URL, {
      method: "GET",
      headers: {
        "User-Agent": "CostRouter",
        Authorization: `token ${oauthToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch token: ${res.status} ${res.statusText}`);
    }

    const { token, expires_at } = await res.json();
    const expiresAt = new Date(expires_at).getTime();

    return { token, expiresAt };
  }

  private async refreshMeta(oauthToken: string): Promise<CopilotMeta> {
    logger.debug({ oauthToken: oauthToken.slice(0, 10) }, "Refreshing Copilot token");
    const meta = await this.fetchMeta(oauthToken);
    cacheMap.set(oauthToken, meta);
    return meta;
  }

  public async getBearerToken(): Promise<string> {
    if (!this.oauthToken) {
      throw new Error("Copilot OAuth token not found. Please run the getCopilotToken.ts script.");
    }
    let meta = cacheMap.get(this.oauthToken);
    if (!this.isTokenValid(meta)) {
      meta = await this.refreshMeta(this.oauthToken);
    }
    return meta?.token || "";
  }
}