import { pino, type Logger } from "pino";
import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import lodash from "lodash";

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

  // Log incoming request based on log level
  const { method, url, headers, body } = req;
  const requestLogObject: any = { requestId, type: "request", method, url };

  if (logger.isLevelEnabled("trace")) {
    requestLogObject.headers = headers;
    requestLogObject.body = body;
    logger.trace(requestLogObject, `--> ${method} ${url}`);
  } else if (logger.isLevelEnabled("debug")) {
    requestLogObject.messagePreview = lodash.get(body, "messages[0]");
    logger.debug(requestLogObject, `--> ${method} ${url}`);
  } else if (logger.isLevelEnabled("info")) {
    logger.info(null, `--> ${method} ${url}`);
  }

  const startTime = Date.now();

  // Log outgoing response on finish
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const { statusCode, statusMessage } = res;
    const responseLogObject: any = {
      requestId,
      type: "response",
      statusCode,
      statusMessage,
      durationMs: duration,
    };

    let responseBody;
    if ((res as any).responseBody) {
      try {
        responseBody = JSON.parse((res as any).responseBody.toString());
      } catch (e) {
        responseBody = (res as any).responseBody.toString();
      }
    }

    if (logger.isLevelEnabled("trace")) {
      responseLogObject.headers = res.getHeaders();
      responseLogObject.body = responseBody;
      logger.trace(
        responseLogObject,
        `<-- ${method} ${url} ${statusCode} ${duration}ms`,
      );
    } else if (logger.isLevelEnabled("debug")) {
      responseLogObject.choicePreview = lodash.get(responseBody, "text").slice(0, 40);
      logger.debug(
        responseLogObject,
        `<-- ${method} ${url} ${statusCode} ${duration}ms`,
      );
    } else if (logger.isLevelEnabled("info")) {
      logger.info(
        null,
        `<-- ${method} ${url} ${statusCode} ${duration}ms`,
      );
    }
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