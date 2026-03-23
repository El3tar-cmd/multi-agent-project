import { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

/**
 * Custom application error with structured metadata.
 * Use this instead of throwing raw Error objects.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(options: {
    message: string;
    statusCode?: number;
    code?: string;
    context?: Record<string, unknown>;
    isOperational?: boolean;
    cause?: Error;
  }) {
    super(options.message);
    this.name = "AppError";
    this.statusCode = options.statusCode || 500;
    this.code = options.code || "internal_error";
    this.context = options.context;
    this.isOperational = options.isOperational ?? true;
    if (options.cause) this.cause = options.cause;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      ...(process.env.NODE_ENV !== "production" && this.context
        ? { context: this.context }
        : {}),
    };
  }
}

/**
 * Pre-built error factories for common cases
 */
export const Errors = {
  notFound: (resource: string, id?: string) =>
    new AppError({
      message: `${resource} not found${id ? `: ${id}` : ""}`,
      statusCode: 404,
      code: "not_found",
      context: { resource, id },
    }),

  validation: (message: string, context?: Record<string, unknown>) =>
    new AppError({
      message,
      statusCode: 400,
      code: "validation_error",
      context,
    }),

  conflict: (message: string) =>
    new AppError({
      message,
      statusCode: 409,
      code: "conflict",
    }),

  serviceUnavailable: (service: string, cause?: Error) =>
    new AppError({
      message: `${service} is unavailable`,
      statusCode: 503,
      code: "service_unavailable",
      context: { service },
      cause,
    }),

  internal: (message: string, cause?: Error) =>
    new AppError({
      message,
      statusCode: 500,
      code: "internal_error",
      isOperational: false,
      cause,
    }),
};

/**
 * Express global error handler middleware.
 * Must be registered LAST with app.use().
 */
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    // Operational/expected errors
    logger.warn(
      {
        err: {
          code: err.code,
          message: err.message,
          statusCode: err.statusCode,
          context: err.context,
        },
        req: { method: req.method, url: req.url },
      },
      `AppError: ${err.code}`,
    );

    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // Unexpected / programming errors
  logger.error(
    {
      err: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      req: { method: req.method, url: req.url },
    },
    "Unhandled error in request",
  );

  res.status(500).json({
    error: "internal_error",
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err.message,
  });
}

/**
 * Wraps an async route handler so thrown errors are passed to next().
 * Use: router.get("/path", asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Setup global process-level error handlers.
 * Call once at startup.
 */
export function setupProcessErrorHandlers() {
  process.on("unhandledRejection", (reason: Error) => {
    logger.fatal({ err: reason }, "Unhandled Rejection - shutting down");
    process.exit(1);
  });

  process.on("uncaughtException", (err: Error) => {
    logger.fatal({ err }, "Uncaught Exception - shutting down");
    process.exit(1);
  });
}
