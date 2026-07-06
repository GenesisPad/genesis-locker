import cors from "cors";
import express from "express";
import helmet from "helmet";
import { router } from "./routes/index.js";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use("/v1", router);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  return app;
}
