import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

type PartnerCredential = { id: string; key: string };
type RateBucket = { count: number; resetAt: number };
type CachedResponse = { body: unknown; etag: string; expiresAt: number };

const buckets = new Map<string, RateBucket>();
const responseCache = new Map<string, CachedResponse>();

function credentials(): PartnerCredential[] {
  return [process.env.PARTNER_API_KEYS, process.env.PARTNER_API_KEY]
    .filter(Boolean).join(",").split(",").map((entry) => entry.trim()).filter(Boolean)
    .map((entry, index) => {
      const separator = entry.indexOf(":");
      return separator > 0
        ? { id: entry.slice(0, separator).trim(), key: entry.slice(separator + 1).trim() }
        : { id: `partner-${index + 1}`, key: entry };
    }).filter((entry) => entry.id && entry.key);
}

function suppliedKey(req: Request) {
  const direct = req.header("x-api-key")?.trim();
  if (direct) return direct;
  const authorization = req.header("authorization")?.trim() ?? "";
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : null;
}

function keysEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

declare global {
  namespace Express { interface Request { partnerId?: string; } }
}

export function requirePartnerApiKey(req: Request, res: Response, next: NextFunction) {
  const available = credentials();
  if (available.length === 0) return res.status(503).json({ error: "partner_api_not_configured", message: "Partner API access has not been configured." });
  const provided = suppliedKey(req);
  const credential = provided ? available.find((candidate) => keysEqual(candidate.key, provided)) : undefined;
  if (!credential) {
    res.setHeader("WWW-Authenticate", "Bearer");
    return res.status(401).json({ error: "invalid_api_key", message: "Provide a valid partner API key using X-API-Key or Authorization: Bearer." });
  }
  req.partnerId = credential.id;
  next();
}

export function partnerRateLimit(req: Request, res: Response, next: NextFunction) {
  const max = Math.max(1, Number(process.env.PARTNER_RATE_LIMIT_MAX || 600));
  const windowMs = Math.max(1_000, Number(process.env.PARTNER_RATE_LIMIT_WINDOW_MS || 60_000));
  const now = Date.now();
  const bucketKey = req.partnerId ?? "unknown";
  let bucket = buckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(bucketKey, bucket);
  }
  res.setHeader("RateLimit-Limit", String(max));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count - 1)));
  res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1_000)));
  if (bucket.count >= max) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({ error: "rate_limit_exceeded", message: "Partner request limit exceeded. Retry after the indicated delay.", retryAfter });
  }
  bucket.count += 1;
  next();
}

export function partnerResponseCache(req: Request, res: Response, next: NextFunction) {
  const ttlSeconds = Math.max(1, Number(process.env.PARTNER_CACHE_TTL_SECONDS || 15));
  const cacheKey = req.originalUrl;
  const now = Date.now();
  const cached = responseCache.get(cacheKey);
  // Keep authenticated responses out of shared caches unless the edge is
  // explicitly configured to vary its cache key by partner credential.
  res.setHeader("Cache-Control", `private, max-age=${ttlSeconds}, stale-while-revalidate=30`);
  if (cached && cached.expiresAt > now) {
    res.setHeader("ETag", cached.etag);
    res.setHeader("X-Genesis-Cache", "HIT");
    if (req.header("if-none-match") === cached.etag) return res.status(304).end();
    return res.json(cached.body);
  }
  const sendJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const etag = `\"${createHash("sha256").update(JSON.stringify(body)).digest("base64url")}\"`;
      responseCache.set(cacheKey, { body, etag, expiresAt: now + ttlSeconds * 1_000 });
      if (responseCache.size > 1_000) {
        const oldest = responseCache.keys().next().value;
        if (oldest) responseCache.delete(oldest);
      }
      res.setHeader("ETag", etag);
      res.setHeader("X-Genesis-Cache", "MISS");
      if (req.header("if-none-match") === etag) return res.status(304).end();
    }
    return sendJson(body);
  }) as Response["json"];
  next();
}

export function resetPartnerApiStateForTests() { buckets.clear(); responseCache.clear(); }
