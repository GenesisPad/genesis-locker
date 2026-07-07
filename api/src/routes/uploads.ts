import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";

// Images are stored on local disk under UPLOADS_DIR (default ./uploads), served
// back statically at /v1/uploads/<filename>. This is real, self-hosted storage
// (not a mock) - no external pinning service is configured for this deployment.
export const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), "uploads");

const MAX_BYTES = 750 * 1024; // headroom above the frontend's 500KB compression target
const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const bodySchema = z.object({
  dataUrl: z.string().min(1),
});

export const uploadsRouter = Router();

uploadsRouter.post("/", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Missing dataUrl" });
  }

  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(parsed.data.dataUrl);
  if (!match) {
    return res.status(400).json({ error: "dataUrl must be a base64-encoded image" });
  }

  const [, mime, base64] = match;
  const ext = ALLOWED_MIME[mime];
  if (!ext) {
    return res.status(400).json({ error: `Unsupported image type: ${mime}` });
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: `Image exceeds ${Math.round(MAX_BYTES / 1024)}KB limit` });
  }

  await mkdir(uploadsDir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(uploadsDir, filename), buffer);

  res.json({ url: `/v1/uploads/${filename}` });
});
