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

export const createPerformanceRouter = (config: AppConfig): Router => {
  const router = Router();

  router.get("/performance/presets", (_req, res) => {
    const availableDbModes = getAvailableDbModes();

    res.json({
      available_db_modes: availableDbModes,
      defaults: {
        duration_seconds: 6,
        concurrency: 20,
        iterations: 1,
        db_modes: getDefaultPerformanceDbModes(availableDbModes),
        scenario_ids: defaultPerformanceScenarioIds,
      },
      scenarios: performanceScenarioPresets,
      timestamp: new Date().toISOString(),
    });
  });

  router.post("/performance/run", async (req, res, next) => {
    try {
      const availableDbModes = getAvailableDbModes();
      if (availableDbModes.length === 0) {
        throw new HttpError(503, "NO_DATABASES_AVAILABLE", "No connected database is available for performance tests");
      }

      const payload = performanceRunInputSchema.parse(req.body ?? {});
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

      const suite = await runPerformanceSuite({
        baseUrl: `http://127.0.0.1:${config.port}/api/v1`,
        scenarios: selectedScenarios,
        dbModes: requestedDbModes,
        iterations: payload.iterations,
        durationSeconds: payload.duration_seconds,
        concurrency: payload.concurrency,
      });

      res.json({
        success: true,
        plan: {
          duration_seconds: payload.duration_seconds,
          concurrency: payload.concurrency,
          iterations: payload.iterations,
          db_modes: requestedDbModes,
          scenario_ids: selectedScenarioIds,
          estimated_total_seconds: payload.duration_seconds * payload.iterations * requestedDbModes.length * selectedScenarios.length,
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
