/**
 * HomeDirect AI — Security Middleware
 *
 * Centralised security configuration applied to the Express app:
 *   • Helmet — secure HTTP headers
 *   • CORS — origin allow-listing
 *   • Rate limiting — abuse prevention per-IP and per-route
 *
 * Usage in server/index.ts:
 *   import { applySecurity } from "./lib/security";
 *   applySecurity(app);
 */

import type { Express, Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Comma-separated list of allowed origins, or "*" for development */
const ALLOWED_ORIGINS = (
  process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:5000"
)
  .split(",")
  .map((o) => o.trim());

/** Requests per window for the global limiter */
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 100;

/** Window size in milliseconds */
const RATE_LIMIT_WINDOW_MS =
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 min

/** Stricter limit for auth endpoints */
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX) || 10;
const AUTH_RATE_LIMIT_WINDOW_MS =
  Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

/** Stricter limit for webhook endpoints (high-throughput from providers) */
const WEBHOOK_RATE_LIMIT_MAX =
  Number(process.env.WEBHOOK_RATE_LIMIT_MAX) || 500;
const WEBHOOK_RATE_LIMIT_WINDOW_MS =
  Number(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS) || 60 * 1000; // 1 min

// ---------------------------------------------------------------------------
// Helmet — secure headers
// ---------------------------------------------------------------------------

/**
 * Applies a comprehensive set of security headers via middleware.
 *
 * If the `helmet` package is installed it will be used; otherwise we apply
 * the most critical headers manually so the app still works without it.
 */
function helmetMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const helmet = require("helmet");
    return helmet({
      contentSecurityPolicy: IS_PRODUCTION
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind inline styles
              imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org"],
              connectSrc: ["'self'", "wss:", "https:"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false, // disable CSP in dev to avoid Vite HMR issues
      crossOriginEmbedderPolicy: false, // leaflet tiles need cross-origin
      hsts: IS_PRODUCTION ? { maxAge: 63072000, includeSubDomains: true } : false,
    });
  } catch {
    // Fallback: set critical headers manually
    return (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "0"); // rely on CSP instead
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(self), payment=(self)",
      );
      if (IS_PRODUCTION) {
        res.setHeader(
          "Strict-Transport-Security",
          "max-age=63072000; includeSubDomains",
        );
      }
      next();
    };
  }
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

function corsMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  try {
    const cors = require("cors");
    return cors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        // Allow requests with no origin (server-to-server, mobile, curl)
        if (!origin) return callback(null, true);

        if (!IS_PRODUCTION || ALLOWED_ORIGINS.includes("*")) {
          return callback(null, true);
        }

        if (ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }

        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "stripe-signature",
        "x-checkr-signature",
        "x-docusign-signature-1",
      ],
      maxAge: 86400, // preflight cache — 24 h
    });
  } catch {
    // Fallback CORS
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      if (!IS_PRODUCTION || !origin || ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin ?? "*");
      }
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type,Authorization,X-Requested-With,stripe-signature,x-checkr-signature,x-docusign-signature-1",
      );
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
      next();
    };
  }
}

// ---------------------------------------------------------------------------
// Rate limiting (in-memory — swap for Redis in production clusters)
// ---------------------------------------------------------------------------

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(config: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}): (req: Request, res: Response, next: NextFunction) => void {
  const buckets = new Map<string, RateLimitBucket>();
  const keyFn =
    config.keyGenerator ??
    ((req: Request) => {
      // Trust X-Forwarded-For when behind a reverse proxy
      const forwarded = req.headers["x-forwarded-for"];
      if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
      return req.ip ?? req.socket.remoteAddress ?? "unknown";
    });

  // Periodic cleanup to prevent unbounded memory growth
  const CLEANUP_INTERVAL = Math.max(config.windowMs, 60_000);
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, CLEANUP_INTERVAL).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + config.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count++;

    // Set standard rate-limit headers
    res.setHeader("X-RateLimit-Limit", String(config.max));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, config.max - bucket.count)),
    );
    res.setHeader(
      "X-RateLimit-Reset",
      String(Math.ceil(bucket.resetAt / 1000)),
    );

    if (bucket.count > config.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({
        error: config.message ?? "Too many requests — please try again later",
      });
      return;
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Request ID middleware
// ---------------------------------------------------------------------------

/**
 * Attach a unique request ID for tracing. Respects an incoming
 * `X-Request-Id` header (from a load balancer) or generates one.
 */
function requestIdMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  let counter = 0;

  return (req: Request, res: Response, next: NextFunction) => {
    const existing = req.headers["x-request-id"] as string | undefined;
    const id = existing ?? `hd-${Date.now()}-${++counter}`;
    (req as any).requestId = id;
    res.setHeader("X-Request-Id", id);
    next();
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Pre-built rate limiters that can be applied to specific route groups */
export const rateLimiters = {
  /** General API — 100 req / 15 min per IP */
  global: createRateLimiter({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
  }),

  /** Auth endpoints — 10 req / 15 min per IP */
  auth: createRateLimiter({
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    max: AUTH_RATE_LIMIT_MAX,
    message: "Too many authentication attempts — please try again later",
  }),

  /** Webhook endpoints — 500 req / 1 min per IP */
  webhook: createRateLimiter({
    windowMs: WEBHOOK_RATE_LIMIT_WINDOW_MS,
    max: WEBHOOK_RATE_LIMIT_MAX,
    message: "Webhook rate limit exceeded",
  }),

  /** Sensitive operations (password reset, email change) — 5 req / 15 min */
  sensitive: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many attempts — please try again later",
  }),
};

/**
 * Apply all security middleware to the Express app.
 *
 * Call this early in the middleware chain, **before** routes are registered.
 */
export function applySecurity(app: Express): void {
  // Trust proxy (Railway, Render, etc.)
  if (IS_PRODUCTION) {
    app.set("trust proxy", 1);
  }

  // Request ID
  app.use(requestIdMiddleware());

  // Security headers
  app.use(helmetMiddleware());

  // CORS
  app.use(corsMiddleware());

  // Global rate limiter
  app.use("/api/", rateLimiters.global);

  // Stricter rate limits for auth routes
  app.use("/api/login", rateLimiters.auth);
  app.use("/api/register", rateLimiters.auth);

  // Webhook rate limits
  app.use("/api/webhooks/", rateLimiters.webhook);

  console.log(
    `[security] Middleware applied — production=${IS_PRODUCTION}, origins=${ALLOWED_ORIGINS.join(",")}`,
  );
}
