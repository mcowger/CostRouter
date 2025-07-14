import pino, { Logger } from "pino";
import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

/**
 * A custom middleware to capture the response body. This needs to be placed
 * before any route handlers.
 */
export const responseBodyLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const originalSend = res.send;
  res.send = function (chunk) {
    (res as any).responseBody = chunk;
    return originalSend.apply(res, arguments as any);
  };
  next();
};

/**
 * A custom logging middleware that logs requests and responses separately.
 */
export const requestResponseLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestId = randomUUID();
  const logger = PinoLogger.getLogger();

  // Log incoming request
  logger.debug(
    {
      requestId,
      type: "request",
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    },
    `--> ${req.method} ${req.url}`,
  );

  const startTime = Date.now();

  // Log outgoing response on finish
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    let responseBody;
    if ((res as any).responseBody) {
      try {
        responseBody = JSON.parse((res as any).responseBody.toString());
      } catch (e) {
        responseBody = (res as any).responseBody.toString();
      }
    }

    logger.debug(
      {
        requestId,
        type: "response",
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        durationMs: duration,
        headers: res.getHeaders(),
        body: responseBody,
      },
      `<-- ${req.method} ${req.url} ${res.statusCode} ${duration}ms`,
    );
  });

  next();
};

export class PinoLogger {
  private static instance: Logger;
  private static options: pino.LoggerOptions = {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        singleLine: false,
        ignore: "pid,hostname",
      },
    },
  };

  private constructor() {}

  public static getLogger(): Logger {
    if (!PinoLogger.instance) {
      PinoLogger.instance = pino(PinoLogger.options);
    }
    return PinoLogger.instance;
  }

  public static configure(options: pino.LoggerOptions): void {
    if (PinoLogger.instance) {
      throw new Error("Logger already initialized");
    }
    PinoLogger.options = options;
  }
}

export const logger = PinoLogger.getLogger();