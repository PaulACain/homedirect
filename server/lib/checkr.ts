/**
 * HomeDirect AI — Checkr Background Check Integration
 *
 * Every chaperone must pass a background check before they can be assigned
 * showings. This module wraps the Checkr API for:
 *   • Creating a candidate profile
 *   • Ordering a background check (invitation flow)
 *   • Polling / webhook-driven status updates
 *
 * Checkr API docs: https://docs.checkr.com
 */

import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CHECKR_API_BASE =
  process.env.CHECKR_API_ENV === "production"
    ? "https://api.checkr.com/v1"
    : "https://api.checkr-staging.com/v1";

const CHECKR_API_KEY = process.env.CHECKR_API_KEY ?? "";

/** Default screening package — "tasker_pro" is a common preset for gig workers */
const DEFAULT_PACKAGE = process.env.CHECKR_PACKAGE ?? "tasker_pro";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckrCandidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  dob: string | null;
  created_at: string;
}

export interface CheckrInvitation {
  id: string;
  candidate_id: string;
  package: string;
  status: "pending" | "completed" | "expired";
  invitation_url: string;
  created_at: string;
}

export type CheckrReportStatus =
  | "pending"
  | "clear"
  | "consider"
  | "suspended"
  | "dispute";

export interface CheckrReport {
  id: string;
  candidate_id: string;
  package: string;
  status: CheckrReportStatus;
  adjudication: "engaged" | "pre_adverse_action" | "adverse_action" | null;
  created_at: string;
  completed_at: string | null;
  turnaround_time: number | null;
}

export interface CreateCandidateInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dob?: string; // YYYY-MM-DD
  /** Internal HomeDirect user ID for cross-referencing */
  userId: string;
}

export interface CheckrWebhookPayload {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      status: string;
      [key: string]: unknown;
    };
  };
  created_at: string;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function checkrFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${CHECKR_API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(`${CHECKR_API_KEY}:`).toString("base64")}`,
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const body = await response.text();
    throw new CheckrApiError(
      `Checkr API ${options.method ?? "GET"} ${path} returned ${response.status}: ${body}`,
      response.status,
      body,
    );
  }

  return response.json() as Promise<T>;
}

export class CheckrApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = "CheckrApiError";
  }
}

// ---------------------------------------------------------------------------
// Candidate management
// ---------------------------------------------------------------------------

/**
 * Create a candidate in Checkr. This must happen before ordering a check.
 */
export async function createCandidate(
  input: CreateCandidateInput,
): Promise<CheckrCandidate> {
  const body: Record<string, unknown> = {
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    custom_id: input.userId,
  };

  if (input.phone) body.phone = input.phone;
  if (input.dob) body.dob = input.dob;

  return checkrFetch<CheckrCandidate>("/candidates", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Retrieve a candidate by their Checkr ID.
 */
export async function getCandidate(
  candidateId: string,
): Promise<CheckrCandidate> {
  return checkrFetch<CheckrCandidate>(`/candidates/${candidateId}`);
}

// ---------------------------------------------------------------------------
// Background check (invitation flow)
// ---------------------------------------------------------------------------

/**
 * Send an invitation to a candidate so they can consent and provide SSN
 * through Checkr's hosted flow. This is the recommended approach since
 * HomeDirect never handles the candidate's SSN directly.
 */
export async function createInvitation(
  candidateId: string,
  packageSlug?: string,
): Promise<CheckrInvitation> {
  return checkrFetch<CheckrInvitation>("/invitations", {
    method: "POST",
    body: JSON.stringify({
      candidate_id: candidateId,
      package: packageSlug ?? DEFAULT_PACKAGE,
    }),
  });
}

// ---------------------------------------------------------------------------
// Report retrieval
// ---------------------------------------------------------------------------

/**
 * Retrieve the report for a completed background check.
 */
export async function getReport(reportId: string): Promise<CheckrReport> {
  return checkrFetch<CheckrReport>(`/reports/${reportId}`);
}

/**
 * List all reports for a given candidate.
 */
export async function listReportsForCandidate(
  candidateId: string,
): Promise<CheckrReport[]> {
  const result = await checkrFetch<{ data: CheckrReport[] }>(
    `/reports?candidate_id=${encodeURIComponent(candidateId)}`,
  );
  return result.data;
}

/**
 * Determine whether a chaperone's background check is approved.
 *
 * Business rule: a "clear" status with no adverse adjudication means approved.
 */
export function isCheckApproved(report: CheckrReport): boolean {
  return (
    report.status === "clear" &&
    report.adjudication !== "pre_adverse_action" &&
    report.adjudication !== "adverse_action"
  );
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

/**
 * Express route handler for `POST /api/webhooks/checkr`.
 *
 * Checkr signs webhooks with a shared secret sent in the
 * `x-checkr-signature` header (HMAC-SHA256).
 */
export async function handleCheckrWebhook(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  // --- Signature verification ---
  const secret = process.env.CHECKR_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[checkr] CHECKR_WEBHOOK_SECRET is not configured");
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  const receivedSig = req.headers["x-checkr-signature"] as string | undefined;
  if (!receivedSig) {
    res.status(400).json({ error: "Missing x-checkr-signature header" });
    return;
  }

  // Verify HMAC
  const crypto = await import("crypto");
  const rawBody: string | Buffer = (req as any).rawBody ?? "";
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig))) {
    console.error("[checkr] Webhook signature mismatch");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // --- Event routing ---
  const payload = req.body as CheckrWebhookPayload;
  const eventType = payload.type;

  try {
    switch (eventType) {
      case "report.completed": {
        const reportId = payload.data.object.id;
        const status = payload.data.object.status as CheckrReportStatus;
        console.log(
          `[checkr] Report completed: ${reportId} — status=${status}`,
        );
        // TODO: update chaperone record in storage
        // TODO: if approved, mark chaperone as "active"
        // TODO: send notification to chaperone with result
        break;
      }

      case "report.upgraded": {
        console.log(
          `[checkr] Report upgraded: ${payload.data.object.id}`,
        );
        break;
      }

      case "report.suspended": {
        console.warn(
          `[checkr] Report suspended: ${payload.data.object.id}`,
        );
        // TODO: flag chaperone and notify admin
        break;
      }

      case "invitation.completed": {
        console.log(
          `[checkr] Invitation completed: ${payload.data.object.id}`,
        );
        // Candidate has finished the Checkr-hosted form — report is processing
        break;
      }

      case "invitation.expired": {
        console.warn(
          `[checkr] Invitation expired: ${payload.data.object.id}`,
        );
        // TODO: notify chaperone to complete the background check
        break;
      }

      default:
        console.log(`[checkr] Unhandled webhook type: ${eventType}`);
    }

    res.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[checkr] Webhook processing error: ${message}`);
    res.status(500).json({ error: "Internal webhook processing error" });
  }
}
