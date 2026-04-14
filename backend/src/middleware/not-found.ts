import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error.js";

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new HttpError(404, "ROUTE_NOT_FOUND", "Route not found"));
};
