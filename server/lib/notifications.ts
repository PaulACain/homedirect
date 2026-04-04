/**
 * HomeDirect AI — Notification System
 *
 * Unified notification layer backed by:
 *   • SendGrid for transactional email
 *   • Twilio for SMS
 *   • In-app WebSocket push (via the existing ws setup in index.ts)
 *
 * All public functions accept a channel-agnostic payload and route through
 * the appropriate provider. If a provider is not configured (missing env
 * vars) the send is skipped with a warning — this keeps local development
 * friction-free.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? "";
const SENDGRID_FROM_EMAIL =
  process.env.SENDGRID_FROM_EMAIL ?? "noreply@homedirect.ai";
const SENDGRID_FROM_NAME =
  process.env.SENDGRID_FROM_NAME ?? "HomeDirect AI";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER ?? "";

const SENDGRID_API_BASE = "https://api.sendgrid.com/v3";
const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationChannel = "email" | "sms" | "push";

export interface NotificationRecipient {
  userId: string;
  email?: string;
  phone?: string;
  /** Whether the user has opted in to SMS */
  smsOptIn?: boolean;
}

export type NotificationType =
  | "offer_submitted"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_countered"
  | "showing_confirmed"
  | "showing_reminder"
  | "showing_cancelled"
  | "chaperone_assigned"
  | "chaperone_en_route"
  | "chaperone_arrived"
  | "documents_ready"
  | "documents_signed"
  | "payment_received"
  | "payment_failed"
  | "background_check_complete"
  | "account_verified";

export interface NotificationPayload {
  type: NotificationType;
  recipient: NotificationRecipient;
  /** Channels to attempt — defaults to all available */
  channels?: NotificationChannel[];
  /** Dynamic data merged into templates */
  data: Record<string, string | number | boolean>;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  /** Plain-text body */
  text: string;
  /** Optional HTML body */
  html?: string;
  /** SendGrid dynamic template ID (overrides subject/text/html) */
  templateId?: string;
  /** Merge variables for the template */
  templateData?: Record<string, unknown>;
}

export interface SendSmsInput {
  to: string;
  body: string;
}

interface SendResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Template mapping
// ---------------------------------------------------------------------------

/**
 * Map notification types to SendGrid template IDs.
 *
 * Replace these placeholder IDs with real ones created in the SendGrid
 * dashboard under Transactional Templates.
 */
const EMAIL_TEMPLATE_IDS: Partial<Record<NotificationType, string>> = {
  offer_submitted: process.env.SG_TPL_OFFER_SUBMITTED ?? "",
  offer_accepted: process.env.SG_TPL_OFFER_ACCEPTED ?? "",
  offer_rejected: process.env.SG_TPL_OFFER_REJECTED ?? "",
  offer_countered: process.env.SG_TPL_OFFER_COUNTERED ?? "",
  showing_confirmed: process.env.SG_TPL_SHOWING_CONFIRMED ?? "",
  showing_reminder: process.env.SG_TPL_SHOWING_REMINDER ?? "",
  showing_cancelled: process.env.SG_TPL_SHOWING_CANCELLED ?? "",
  chaperone_assigned: process.env.SG_TPL_CHAPERONE_ASSIGNED ?? "",
  chaperone_en_route: process.env.SG_TPL_CHAPERONE_EN_ROUTE ?? "",
  chaperone_arrived: process.env.SG_TPL_CHAPERONE_ARRIVED ?? "",
  documents_ready: process.env.SG_TPL_DOCUMENTS_READY ?? "",
  documents_signed: process.env.SG_TPL_DOCUMENTS_SIGNED ?? "",
  payment_received: process.env.SG_TPL_PAYMENT_RECEIVED ?? "",
  payment_failed: process.env.SG_TPL_PAYMENT_FAILED ?? "",
  background_check_complete: process.env.SG_TPL_BG_CHECK_COMPLETE ?? "",
  account_verified: process.env.SG_TPL_ACCOUNT_VERIFIED ?? "",
};

/**
 * SMS message builders per notification type.
 *
 * Keep messages under 160 chars where possible to avoid multi-segment charges.
 */
const SMS_BUILDERS: Partial<Record<NotificationType, (data: Record<string, unknown>) => string>> = {
  offer_submitted: (d) =>
    `HomeDirect: Your offer on ${d.propertyAddress} has been submitted. We'll notify you when the seller responds.`,
  offer_accepted: (d) =>
    `HomeDirect: Great news! Your offer on ${d.propertyAddress} was accepted. Check your email for next steps.`,
  offer_rejected: (d) =>
    `HomeDirect: Your offer on ${d.propertyAddress} was not accepted. Log in for details.`,
  showing_confirmed: (d) =>
    `HomeDirect: Your showing at ${d.propertyAddress} is confirmed for ${d.showingDate} at ${d.showingTime}.`,
  showing_reminder: (d) =>
    `HomeDirect: Reminder — showing at ${d.propertyAddress} today at ${d.showingTime}.`,
  showing_cancelled: (d) =>
    `HomeDirect: Your showing at ${d.propertyAddress} on ${d.showingDate} has been cancelled.`,
  chaperone_assigned: (d) =>
    `HomeDirect: ${d.chaperoneName} will chaperone your showing at ${d.propertyAddress}.`,
  chaperone_en_route: (d) =>
    `HomeDirect: Your chaperone ${d.chaperoneName} is on their way. ETA: ${d.eta} min.`,
  chaperone_arrived: (d) =>
    `HomeDirect: Your chaperone has arrived at ${d.propertyAddress}.`,
  documents_ready: () =>
    `HomeDirect: Documents are ready for your signature. Check your email or log in to sign.`,
  payment_received: () =>
    `HomeDirect: Payment received. Thank you!`,
  payment_failed: () =>
    `HomeDirect: Payment failed. Please update your payment method in your account.`,
};

// ---------------------------------------------------------------------------
// Email (SendGrid)
// ---------------------------------------------------------------------------

/**
 * Send a transactional email via the SendGrid v3 Mail Send API.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn("[notifications] SendGrid not configured — skipping email");
    return;
  }

  const body: Record<string, unknown> = {
    from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
    personalizations: [
      {
        to: [{ email: input.to }],
        ...(input.templateData
          ? { dynamic_template_data: input.templateData }
          : {}),
      },
    ],
  };

  if (input.templateId) {
    body.template_id = input.templateId;
  } else {
    body.subject = input.subject;
    body.content = [
      { type: "text/plain", value: input.text },
      ...(input.html ? [{ type: "text/html", value: input.html }] : []),
    ];
  }

  const response = await fetch(`${SENDGRID_API_BASE}/mail/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `SendGrid API returned ${response.status}: ${text}`,
    );
  }
}

// ---------------------------------------------------------------------------
// SMS (Twilio)
// ---------------------------------------------------------------------------

/**
 * Send an SMS via the Twilio REST API.
 */
export async function sendSms(input: SendSmsInput): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.warn("[notifications] Twilio not configured — skipping SMS");
    return;
  }

  const url = `${TWILIO_API_BASE}/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`,
  ).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: TWILIO_FROM_NUMBER,
      To: input.to,
      Body: input.body,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio API returned ${response.status}: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Unified dispatcher
// ---------------------------------------------------------------------------

/**
 * Send a notification across all requested channels.
 *
 * Failures on individual channels are logged but do not prevent other
 * channels from being attempted. Returns a per-channel result summary.
 */
export async function sendNotification(
  payload: NotificationPayload,
): Promise<SendResult[]> {
  const channels = payload.channels ?? determineChannels(payload);
  const results: SendResult[] = [];

  for (const channel of channels) {
    try {
      switch (channel) {
        case "email": {
          if (!payload.recipient.email) {
            results.push({ channel, success: false, error: "No email address" });
            break;
          }
          const templateId = EMAIL_TEMPLATE_IDS[payload.type];
          if (templateId) {
            await sendEmail({
              to: payload.recipient.email,
              subject: "", // template provides subject
              text: "",
              templateId,
              templateData: {
                ...payload.data,
                user_id: payload.recipient.userId,
              },
            });
          } else {
            // Fallback: plain-text email
            const subject = formatSubject(payload.type);
            const text = formatPlainText(payload.type, payload.data);
            await sendEmail({
              to: payload.recipient.email,
              subject,
              text,
            });
          }
          results.push({ channel, success: true });
          break;
        }

        case "sms": {
          if (!payload.recipient.phone) {
            results.push({ channel, success: false, error: "No phone number" });
            break;
          }
          if (payload.recipient.smsOptIn === false) {
            results.push({ channel, success: false, error: "SMS opt-out" });
            break;
          }
          const builder = SMS_BUILDERS[payload.type];
          const body = builder
            ? builder(payload.data)
            : `HomeDirect: You have a new update. Log in for details.`;
          await sendSms({ to: payload.recipient.phone, body });
          results.push({ channel, success: true });
          break;
        }

        case "push": {
          // TODO: emit via WebSocket to the user's active sessions
          console.log(
            `[notifications] push → user=${payload.recipient.userId} type=${payload.type}`,
          );
          results.push({ channel, success: true });
          break;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `[notifications] ${channel} failed for ${payload.type}: ${message}`,
      );
      results.push({ channel, success: false, error: message });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Convenience senders for common events
// ---------------------------------------------------------------------------

export async function notifyOfferUpdate(
  recipient: NotificationRecipient,
  type: "offer_submitted" | "offer_accepted" | "offer_rejected" | "offer_countered",
  data: { propertyAddress: string; offerAmount: number; dealId: string },
): Promise<SendResult[]> {
  return sendNotification({
    type,
    recipient,
    data: { ...data, offerAmount: String(data.offerAmount) },
  });
}

export async function notifyShowingConfirmation(
  recipient: NotificationRecipient,
  data: {
    propertyAddress: string;
    showingDate: string;
    showingTime: string;
    chaperoneName: string;
  },
): Promise<SendResult[]> {
  return sendNotification({
    type: "showing_confirmed",
    recipient,
    data,
  });
}

export async function notifyChaperoneAlert(
  recipient: NotificationRecipient,
  type: "chaperone_assigned" | "chaperone_en_route" | "chaperone_arrived",
  data: {
    propertyAddress: string;
    chaperoneName: string;
    eta?: number;
    showingDate?: string;
    showingTime?: string;
  },
): Promise<SendResult[]> {
  return sendNotification({
    type,
    recipient,
    channels: ["sms", "push"], // time-sensitive — skip email
    data: { ...data, eta: String(data.eta ?? "") },
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function determineChannels(payload: NotificationPayload): NotificationChannel[] {
  // Time-sensitive events prefer SMS + push; everything gets email
  const timeSensitive: NotificationType[] = [
    "chaperone_en_route",
    "chaperone_arrived",
    "showing_reminder",
    "showing_cancelled",
  ];

  if (timeSensitive.includes(payload.type)) {
    return ["sms", "push"];
  }

  return ["email", "push"];
}

function formatSubject(type: NotificationType): string {
  const map: Record<NotificationType, string> = {
    offer_submitted: "Your offer has been submitted",
    offer_accepted: "Your offer was accepted!",
    offer_rejected: "Offer update",
    offer_countered: "You received a counter-offer",
    showing_confirmed: "Showing confirmed",
    showing_reminder: "Showing reminder",
    showing_cancelled: "Showing cancelled",
    chaperone_assigned: "Chaperone assigned to your showing",
    chaperone_en_route: "Your chaperone is on the way",
    chaperone_arrived: "Your chaperone has arrived",
    documents_ready: "Documents ready for signature",
    documents_signed: "Documents fully signed",
    payment_received: "Payment received",
    payment_failed: "Payment failed — action required",
    background_check_complete: "Background check complete",
    account_verified: "Your account has been verified",
  };
  return `HomeDirect — ${map[type] ?? "Notification"}`;
}

function formatPlainText(
  type: NotificationType,
  data: Record<string, unknown>,
): string {
  // Fallback plain-text bodies when no SendGrid template is configured
  const builder = SMS_BUILDERS[type];
  if (builder) return builder(data);
  return `You have a new notification from HomeDirect (${type}). Log in to your account for details.`;
}
