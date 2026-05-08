import { Router } from "express";
import type { AppConfig } from "../config/env.js";
import type { DatabaseMode } from "../db/database-mode.js";
import { isMongoConnected } from "../db/mongo.js";
import { isPostgresConnected } from "../db/postgres.js";
import { defaultPerformanceScenarioIds, getDefaultPerformanceDbModes, getPerformanceScenarioPreset, performanceScenarioPresets } from "../performance/presets.js";
import { runPerformanceSuite } from "../performance/runner.js";
import { HttpError } from "../utils/http-error.js";
import { performanceRunInputSchema } from "../validation/schemas.js";

const getAvailableDbModes = (): DatabaseMode[] => {
  const modes: DatabaseMode[] = [];

  if (isMongoConnected()) {
    modes.push("mongo");
  }

  if (isPostgresConnected()) {
    modes.push("postgres");
  }

  return modes;
};

const parseCsvList = (input: unknown): string[] => {
  if (Array.isArray(input)) {
    return input.flatMap((entry) => parseCsvList(entry));
  }

  if (typeof input !== "string") {
    return [];
  }

  return input
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const parseIntegerQuery = (input: unknown): number | undefined => {
  if (typeof input !== "string" || input.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(input);
  return Number.isInteger(parsed) ? parsed : undefined;
};

const resolvePerformanceRequest = (payloadInput: unknown) => {
  const availableDbModes = getAvailableDbModes();
  if (availableDbModes.length === 0) {
    throw new HttpError(503, "NO_DATABASES_AVAILABLE", "No connected database is available for performance tests");
  }

  const payload = performanceRunInputSchema.parse(payloadInput ?? {});
  const requestedDbModes = payload.db_modes.filter((dbMode) => availableDbModes.includes(dbMode));
  if (requestedDbModes.length === 0) {
    throw new HttpError(400, "NO_VALID_DATABASES_SELECTED", "Select at least one connected database mode");
  }

  const selectedScenarioIds = payload.scenario_ids.length > 0 ? payload.scenario_ids : defaultPerformanceScenarioIds;
  const selectedScenarios = selectedScenarioIds.map((scenarioId) => {
    const scenario = getPerformanceScenarioPreset(scenarioId);
    if (!scenario) {
      throw new HttpError(400, "UNKNOWN_PERFORMANCE_SCENARIO", `Unknown performance scenario: ${scenarioId}`);
    }

    return scenario;
  });

  return {
    payload,
    requestedDbModes,
    selectedScenarioIds,
    selectedScenarios,
  };
};

const writeSse = (res: Parameters<Router["get"]>[1] extends never ? never : any, eventName: string, payload: unknown): void => {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export const createPerformanceRouter = (config: AppConfig): Router => {
  const router = Router();

  router.get("/performance/presets", (_req, res) => {
    const availableDbModes = getAvailableDbModes();

    res.json({
      available_db_modes: availableDbModes,
      defaults: {
        duration_seconds: 10,
        concurrency: 20,
        iterations: 3,
        db_modes: getDefaultPerformanceDbModes(availableDbModes),
        scenario_ids: defaultPerformanceScenarioIds,
      },
      scenarios: performanceScenarioPresets,
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/performance/stream", async (req, res) => {
    let closed = false;

    req.on("close", () => {
      closed = true;
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const resolved = resolvePerformanceRequest({
        duration_seconds: parseIntegerQuery(req.query.duration_seconds),
        concurrency: parseIntegerQuery(req.query.concurrency),
        iterations: parseIntegerQuery(req.query.iterations),
        db_modes: parseCsvList(req.query.db_modes),
        scenario_ids: parseCsvList(req.query.scenario_ids),
      });

      await runPerformanceSuite({
        baseUrl: `http://127.0.0.1:${config.port}/api/v1`,
        scenarios: resolved.selectedScenarios,
        dbModes: resolved.requestedDbModes,
        iterations: resolved.payload.iterations,
        durationSeconds: resolved.payload.duration_seconds,
        concurrency: resolved.payload.concurrency,
        onProgress: (event) => {
          if (closed) {
            return;
          }

          writeSse(res, event.type, {
            success: true,
            plan: {
              duration_seconds: resolved.payload.duration_seconds,
              concurrency: resolved.payload.concurrency,
              iterations: resolved.payload.iterations,
              db_modes: resolved.requestedDbModes,
              scenario_ids: resolved.selectedScenarioIds,
              estimated_total_seconds: resolved.payload.duration_seconds * resolved.payload.iterations * resolved.requestedDbModes.length * resolved.selectedScenarios.length,
            },
            timestamp: new Date().toISOString(),
            ...event,
          });
        },
      });

      if (!closed) {
        res.end();
      }
    } catch (error) {
      if (!closed) {
        const message = error instanceof Error ? error.message : "Performance stream failed";
        writeSse(res, "suite-error", {
          success: false,
          message,
          timestamp: new Date().toISOString(),
        });
        res.end();
      }
    }
  });

  router.post("/performance/run", async (req, res, next) => {
    try {
      const resolved = resolvePerformanceRequest(req.body ?? {});

      const suite = await runPerformanceSuite({
        baseUrl: `http://127.0.0.1:${config.port}/api/v1`,
        scenarios: resolved.selectedScenarios,
        dbModes: resolved.requestedDbModes,
        iterations: resolved.payload.iterations,
        durationSeconds: resolved.payload.duration_seconds,
        concurrency: resolved.payload.concurrency,
      });

      res.json({
        success: true,
        plan: {
          duration_seconds: resolved.payload.duration_seconds,
          concurrency: resolved.payload.concurrency,
          iterations: resolved.payload.iterations,
          db_modes: resolved.requestedDbModes,
          scenario_ids: resolved.selectedScenarioIds,
          estimated_total_seconds: resolved.payload.duration_seconds * resolved.payload.iterations * resolved.requestedDbModes.length * resolved.selectedScenarios.length,
        },
        ...suite,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
