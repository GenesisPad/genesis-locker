import cors from "cors";
import express from "express";
import helmet from "helmet";
import { router } from "./routes/index.js";
import { uploadsRouter, uploadsDir } from "./routes/uploads.js";

export function createApp() {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use("/v1/uploads", express.static(uploadsDir));
  app.use("/v1/uploads", uploadsRouter);
  app.use("/v1", router);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  return app;
}
