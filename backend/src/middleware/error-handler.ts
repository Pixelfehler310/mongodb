import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error.js";

export const createErrorHandler = (logger: Logger) => {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        code: "INVALID_REQUEST_BODY",
        message: "Request body validation failed",
        details: err.flatten(),
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (err instanceof HttpError) {
      res.status(err.status).json({
        error: err.status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
        code: err.code,
        message: err.message,
        details: err.details,
        timestamp: new Date().toISOString()
      });
      return;
    }

    logger.error({ err }, "Unhandled error");
    res.status(500).json({
      error: "INTERNAL_ERROR",
      code: "UNEXPECTED_FAILURE",
      message: "Unexpected server error",
      timestamp: new Date().toISOString()
    });
  };
};
