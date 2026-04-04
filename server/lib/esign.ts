/**
 * HomeDirect AI — E-Signature Integration (DocuSign)
 *
 * Manages the digital signing workflow for:
 *   • Purchase agreements & offer letters
 *   • Disclosure documents
 *   • Chaperone service agreements
 *
 * Uses the DocuSign eSignature REST API v2.1.
 * Docs: https://developers.docusign.com/docs/esign-rest-api/
 */

import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DOCUSIGN_BASE_URL =
  process.env.DOCUSIGN_ENV === "production"
    ? "https://na1.docusign.net/restapi/v2.1"
    : "https://demo.docusign.net/restapi/v2.1";

const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID ?? "";
const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY ?? "";
const DOCUSIGN_USER_ID = process.env.DOCUSIGN_USER_ID ?? "";
const DOCUSIGN_RSA_PRIVATE_KEY = process.env.DOCUSIGN_RSA_PRIVATE_KEY ?? "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Signer {
  name: string;
  email: string;
  /** DocuSign recipient routing order (1-based) */
  routingOrder?: number;
  /** Identifier for the signer role in the template (e.g. "buyer", "seller") */
  roleName?: string;
}

export interface CreateEnvelopeInput {
  /** Human-readable subject line shown in the signing email */
  subject: string;
  /** One or more signers who need to sign */
  signers: Signer[];
  /** Base64-encoded document content */
  documentBase64: string;
  /** File name for the document (e.g. "purchase_agreement.pdf") */
  documentName: string;
  /** Internal HomeDirect reference */
  dealId: string;
  /** Optional: create from a server-side template instead of a raw document */
  templateId?: string;
}

export type EnvelopeStatus =
  | "created"
  | "sent"
  | "delivered"
  | "signed"
  | "completed"
  | "declined"
  | "voided";

export interface EnvelopeResult {
  envelopeId: string;
  status: EnvelopeStatus;
  uri: string;
}

export interface SigningUrlResult {
  url: string;
  /** URL expires in 5 minutes — redirect the user immediately */
  expiresInSeconds: number;
}

export interface DocuSignWebhookPayload {
  event: string;
  apiVersion: string;
  uri: string;
  retryCount: number;
  configurationId: number;
  generatedDateTime: string;
  data: {
    accountId: string;
    envelopeId: string;
    envelopeSummary: {
      status: string;
      recipients: {
        signers: Array<{
          name: string;
          email: string;
          status: string;
          signedDateTime?: string;
        }>;
      };
      customFields?: {
        textCustomFields?: Array<{
          name: string;
          value: string;
        }>;
      };
    };
  };
}

// ---------------------------------------------------------------------------
// Auth — JWT Grant (server-to-server)
// ---------------------------------------------------------------------------

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

/**
 * Obtain an access token using the JWT Grant flow.
 *
 * The token is cached in-memory until 60 s before expiry.
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const crypto = await import("crypto");
  const jwtHeader = Buffer.from(
    JSON.stringify({ typ: "JWT", alg: "RS256" }),
  ).toString("base64url");

  const issuedAt = Math.floor(now / 1000);
  const jwtPayload = Buffer.from(
    JSON.stringify({
      iss: DOCUSIGN_INTEGRATION_KEY,
      sub: DOCUSIGN_USER_ID,
      aud: process.env.DOCUSIGN_ENV === "production"
        ? "account.docusign.com"
        : "account-d.docusign.com",
      iat: issuedAt,
      exp: issuedAt + 3600,
      scope: "signature impersonation",
    }),
  ).toString("base64url");

  const signable = `${jwtHeader}.${jwtPayload}`;
  const privateKey = DOCUSIGN_RSA_PRIVATE_KEY.replace(/\\n/g, "\n");
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(signable)
    .sign(privateKey, "base64url");

  const assertion = `${signable}.${signature}`;

  const tokenUrl =
    process.env.DOCUSIGN_ENV === "production"
      ? "https://account.docusign.com/oauth/token"
      : "https://account-d.docusign.com/oauth/token";

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DocuSign token request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function docusignFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const url = `${DOCUSIGN_BASE_URL}/accounts/${DOCUSIGN_ACCOUNT_ID}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `DocuSign API ${options.method ?? "GET"} ${path} returned ${response.status}: ${body}`,
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Envelope management
// ---------------------------------------------------------------------------

/**
 * Create and send an envelope (document + signers).
 *
 * If `templateId` is provided, the server-side template is used and the
 * document fields can be omitted.
 */
export async function createEnvelope(
  input: CreateEnvelopeInput,
): Promise<EnvelopeResult> {
  const signers = input.signers.map((s, i) => ({
    email: s.email,
    name: s.name,
    recipientId: String(i + 1),
    routingOrder: String(s.routingOrder ?? i + 1),
    roleName: s.roleName,
  }));

  const body: Record<string, unknown> = {
    emailSubject: input.subject,
    status: "sent", // immediately send for signing
    recipients: { signers },
    customFields: {
      textCustomFields: [
        { name: "homedirect_deal_id", value: input.dealId, show: "false" },
      ],
    },
  };

  if (input.templateId) {
    body.templateId = input.templateId;
  } else {
    body.documents = [
      {
        documentBase64: input.documentBase64,
        name: input.documentName,
        fileExtension: input.documentName.split(".").pop() ?? "pdf",
        documentId: "1",
      },
    ];
  }

  const result = await docusignFetch<{
    envelopeId: string;
    status: string;
    uri: string;
  }>("/envelopes", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    envelopeId: result.envelopeId,
    status: result.status as EnvelopeStatus,
    uri: result.uri,
  };
}

/**
 * Generate an embedded signing URL for a recipient.
 *
 * The buyer/seller can complete the signing ceremony inside the
 * HomeDirect UI via an iframe or redirect.
 */
export async function getEmbeddedSigningUrl(
  envelopeId: string,
  signer: Signer,
  returnUrl: string,
): Promise<SigningUrlResult> {
  const result = await docusignFetch<{ url: string }>(
    `/envelopes/${envelopeId}/views/recipient`,
    {
      method: "POST",
      body: JSON.stringify({
        authenticationMethod: "none",
        email: signer.email,
        userName: signer.name,
        returnUrl,
        clientUserId: signer.email, // ties the recipient to embedded signing
      }),
    },
  );

  return { url: result.url, expiresInSeconds: 300 };
}

/**
 * Get the current status of an envelope.
 */
export async function getEnvelopeStatus(
  envelopeId: string,
): Promise<EnvelopeResult> {
  const result = await docusignFetch<{
    envelopeId: string;
    status: string;
    uri: string;
  }>(`/envelopes/${envelopeId}`);

  return {
    envelopeId: result.envelopeId,
    status: result.status as EnvelopeStatus,
    uri: result.uri,
  };
}

/**
 * Download the completed, signed document.
 */
export async function downloadSignedDocument(
  envelopeId: string,
  documentId: string = "combined",
): Promise<Buffer> {
  const token = await getAccessToken();
  const url = `${DOCUSIGN_BASE_URL}/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes/${envelopeId}/documents/${documentId}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download document (${response.status}): ${await response.text()}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Void (cancel) an envelope that has not yet been completed.
 */
export async function voidEnvelope(
  envelopeId: string,
  reason: string,
): Promise<void> {
  await docusignFetch(`/envelopes/${envelopeId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "voided", voidedReason: reason }),
  });
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

/**
 * Express route handler for `POST /api/webhooks/docusign`.
 *
 * DocuSign Connect sends envelope status change notifications here.
 */
export async function handleDocuSignWebhook(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  // --- HMAC verification (DocuSign Connect HMAC) ---
  const hmacSecret = process.env.DOCUSIGN_WEBHOOK_HMAC_SECRET;
  if (hmacSecret) {
    const crypto = await import("crypto");
    const rawBody: string | Buffer = (req as any).rawBody ?? "";
    const expectedSig = crypto
      .createHmac("sha256", hmacSecret)
      .update(rawBody)
      .digest("base64");

    const receivedSig = req.headers["x-docusign-signature-1"] as string | undefined;
    if (!receivedSig || receivedSig !== expectedSig) {
      console.error("[docusign] Webhook HMAC verification failed");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  const payload = req.body as DocuSignWebhookPayload;
  const eventType = payload.event;
  const envelopeId = payload.data?.envelopeId;
  const envelopeStatus = payload.data?.envelopeSummary?.status;

  // Extract HomeDirect deal ID from custom fields
  const dealId = payload.data?.envelopeSummary?.customFields?.textCustomFields?.find(
    (f) => f.name === "homedirect_deal_id",
  )?.value;

  try {
    switch (eventType) {
      case "envelope-completed": {
        console.log(
          `[docusign] Envelope completed: ${envelopeId} — deal=${dealId}`,
        );
        // TODO: update deal status to "documents_signed" in storage
        // TODO: trigger next step (e.g. initiate closing payment)
        // TODO: notify buyer + seller that documents are fully executed
        break;
      }

      case "envelope-sent": {
        console.log(`[docusign] Envelope sent: ${envelopeId}`);
        break;
      }

      case "envelope-delivered": {
        console.log(`[docusign] Envelope delivered: ${envelopeId}`);
        break;
      }

      case "recipient-completed": {
        const signers = payload.data?.envelopeSummary?.recipients?.signers ?? [];
        const completed = signers.filter((s) => s.status === "completed");
        console.log(
          `[docusign] Recipient signed: ${envelopeId} — ${completed.length}/${signers.length} complete`,
        );
        // TODO: notify other parties of progress
        break;
      }

      case "envelope-declined": {
        console.warn(`[docusign] Envelope declined: ${envelopeId}`);
        // TODO: notify deal parties and update deal status
        break;
      }

      case "envelope-voided": {
        console.warn(
          `[docusign] Envelope voided: ${envelopeId} — status=${envelopeStatus}`,
        );
        break;
      }

      default:
        console.log(`[docusign] Unhandled event: ${eventType}`);
    }

    res.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[docusign] Webhook processing error: ${message}`);
    res.status(500).json({ error: "Internal webhook processing error" });
  }
}
