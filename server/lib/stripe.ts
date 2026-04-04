/**
 * HomeDirect AI — Stripe Connect Integration
 *
 * Handles the platform's 1% closing-fee model:
 *   • Each chaperone (showing agent) onboards via Stripe Connect
 *   • When a deal closes the buyer pays through the platform
 *   • The platform retains 1% and transfers the chaperone payout
 *
 * All monetary values are in **cents** (Stripe convention).
 */

import Stripe from "stripe";
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  typescript: true,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateConnectedAccountInput {
  email: string;
  firstName: string;
  lastName: string;
  /** Internal HomeDirect user ID stored as Stripe metadata */
  userId: string;
}

export interface CreatePaymentIntentInput {
  /** Total closing amount in cents */
  amountCents: number;
  /** ISO 4217 currency code — defaults to "usd" */
  currency?: string;
  /** Stripe connected-account ID of the chaperone receiving the payout */
  chaperoneAccountId: string;
  /** Internal deal / transaction reference */
  dealId: string;
  /** Internal buyer user ID */
  buyerId: string;
}

export interface TransferInput {
  /** Amount in cents to transfer to the connected account */
  amountCents: number;
  /** Destination Stripe connected-account ID */
  destinationAccountId: string;
  /** The PaymentIntent or Charge that funds the transfer */
  sourcePaymentIntentId: string;
  /** Internal reference for reconciliation */
  dealId: string;
}

// ---------------------------------------------------------------------------
// Connected Account helpers
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Connect Express account for a chaperone.
 *
 * After creation, generate an Account Link so the chaperone can complete
 * onboarding via Stripe's hosted flow.
 */
export async function createConnectedAccount(
  input: CreateConnectedAccountInput,
): Promise<Stripe.Account> {
  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email: input.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    individual: {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
    },
    metadata: {
      homedirect_user_id: input.userId,
      role: "chaperone",
    },
  });

  return account;
}

/**
 * Generate a Stripe-hosted onboarding link for a connected account.
 */
export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
): Promise<Stripe.AccountLink> {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
}

/**
 * Generate a login link so a chaperone can view their Stripe Express dashboard.
 */
export async function createLoginLink(
  accountId: string,
): Promise<Stripe.LoginLink> {
  return stripe.accounts.createLoginLink(accountId);
}

/**
 * Retrieve the current status of a connected account (useful for checking
 * whether onboarding is complete before allowing payouts).
 */
export async function getAccountStatus(accountId: string): Promise<{
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted ?? false,
  };
}

// ---------------------------------------------------------------------------
// Payment helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the platform fee (1 % of the closing amount).
 */
export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * 0.01);
}

/**
 * Create a PaymentIntent that collects the closing fee from the buyer and
 * earmarks the chaperone payout via `transfer_data`.
 *
 * Stripe automatically holds the platform fee and transfers the remainder
 * to the connected account once the payment succeeds.
 */
export async function createClosingPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<Stripe.PaymentIntent> {
  const platformFee = calculatePlatformFee(input.amountCents);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: input.amountCents,
    currency: input.currency ?? "usd",
    payment_method_types: ["card"],
    application_fee_amount: platformFee,
    transfer_data: {
      destination: input.chaperoneAccountId,
    },
    metadata: {
      homedirect_deal_id: input.dealId,
      homedirect_buyer_id: input.buyerId,
      platform_fee_cents: String(platformFee),
    },
  });

  return paymentIntent;
}

/**
 * Manually transfer funds to a connected account.
 *
 * Use this when you need to split payments across multiple chaperones or
 * issue deferred payouts outside of `transfer_data`.
 */
export async function transferToConnectedAccount(
  input: TransferInput,
): Promise<Stripe.Transfer> {
  return stripe.transfers.create({
    amount: input.amountCents,
    currency: "usd",
    destination: input.destinationAccountId,
    source_transaction: input.sourcePaymentIntentId,
    metadata: {
      homedirect_deal_id: input.dealId,
    },
  });
}

/**
 * Issue a refund for a closing payment.
 */
export async function refundPayment(
  paymentIntentId: string,
  reason?: string,
): Promise<Stripe.Refund> {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    reason: (reason as Stripe.RefundCreateParams["reason"]) ?? "requested_by_customer",
  });
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

/**
 * Verify and parse a Stripe webhook event.
 *
 * The raw body must be preserved for signature verification — see the
 * `rawBody` middleware in `server/index.ts`.
 */
export function constructWebhookEvent(
  rawBody: string | Buffer,
  signature: string,
): Stripe.Event {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
}

/**
 * Express route handler for `POST /api/webhooks/stripe`.
 *
 * Delegates to event-specific processors — add new cases as needed.
 */
export async function handleStripeWebhook(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const signature = req.headers["stripe-signature"] as string | undefined;
  if (!signature) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;
  try {
    // `rawBody` is attached by the JSON-verify middleware in index.ts
    event = constructWebhookEvent((req as any).rawBody, signature);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[stripe] Webhook signature verification failed: ${message}`);
    res.status(400).json({ error: `Webhook Error: ${message}` });
    return;
  }

  try {
    switch (event.type) {
      // ----- Payment lifecycle -----
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.log(
          `[stripe] Payment succeeded: ${pi.id} — deal ${pi.metadata.homedirect_deal_id}`,
        );
        // TODO: update deal status to "payment_received" in storage
        // TODO: trigger buyer / seller confirmation notifications
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.error(
          `[stripe] Payment failed: ${pi.id} — ${pi.last_payment_error?.message}`,
        );
        // TODO: notify buyer of payment failure
        break;
      }

      // ----- Connect account lifecycle -----
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        console.log(
          `[stripe] Account updated: ${account.id} — charges_enabled=${account.charges_enabled}`,
        );
        // TODO: update chaperone onboarding status in storage
        break;
      }

      // ----- Transfer lifecycle -----
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        console.log(
          `[stripe] Transfer created: ${transfer.id} → ${transfer.destination}`,
        );
        break;
      }

      case "transfer.reversed": {
        const transfer = event.data.object as Stripe.Transfer;
        console.warn(`[stripe] Transfer reversed: ${transfer.id}`);
        // TODO: handle payout clawback
        break;
      }

      // ----- Payout lifecycle -----
      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        console.log(`[stripe] Payout paid: ${payout.id}`);
        // TODO: notify chaperone that funds have been deposited
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        console.error(
          `[stripe] Payout failed: ${payout.id} — ${payout.failure_message}`,
        );
        // TODO: notify chaperone of payout failure
        break;
      }

      default:
        console.log(`[stripe] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[stripe] Error processing webhook: ${message}`);
    res.status(500).json({ error: "Internal webhook processing error" });
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { stripe };
