/**
 * HomeDirectAI — ICP Copy Generator
 *
 * Generates structured ad copy, hooks, video scripts, and social captions
 * for each ICP segment (buyer | seller | concierge) using the existing AI engine.
 *
 * Route: POST /api/marketing/generate-copy
 */

import { chatJSON } from "./ai-engine";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ICPTarget = "buyer" | "seller" | "concierge";
export type HookAngle = "pain" | "savings" | "curiosity" | "social_proof" | "urgency" | "all";
export type AdFormat = "meta_feed" | "meta_story" | "tiktok_script" | "google_search" | "organic_social" | "email" | "all";

export interface CopyRequest {
  icp: ICPTarget;
  angle?: HookAngle;    // default: "all"
  format?: AdFormat;    // default: "all"
  context?: string;     // optional extra context (e.g. "focus on Tampa relocation buyers")
}

export interface GeneratedCopy {
  icp: ICPTarget;
  headlines: string[];            // 8 punchy ad headlines
  hooks: HookVariant[];           // 5 hook openings, one per angle
  bodyVariants: string[];         // 3 full ad body copy variants
  videoScript30: string;          // 30-sec UGC-style video script
  videoScript60: string;          // 60-sec video script
  socialCaptions: string[];       // 5 organic social captions (IG/FB/TikTok)
  emailSubject: string;           // Email subject line
  emailPreview: string;           // Email preview text (90 chars)
  ctaVariants: string[];          // 6 CTA button text options
  objectionHandlers: string[];    // 3 one-liner objection responses
}

export interface HookVariant {
  angle: string;
  hook: string;
}

// ── ICP Context ───────────────────────────────────────────────────────────────

const ICP_CONTEXT: Record<ICPTarget, string> = {
  buyer: `
TARGET: Home Buyers in Tampa Bay, FL
CORE OFFER: Buy a home for just 1% at closing. AI handles negotiations, paperwork, and everything through closing. Human chaperone shows you homes on demand.

KEY PAIN POINTS:
- Buyer agents charge ~$9,818 commission on a median $430K Tampa home — paid by the buyer via inflated offer price
- Post-NAR settlement, agents still take 5.44% combined — buyers feel they have no real alternative
- Agents are incentivized to close fast, not optimally. Buyers want transparency, not a summary.
- Agents work on agent timelines. Buyers want 24/7 access to status, docs, and data.
- Paperwork and contracts feel designed to confuse.

KEY SAVINGS MESSAGE: On a $430,000 home, HomeDirectAI saves buyers approximately $9,818 vs. a traditional buyer's agent.

BUYER PERSONAS:
1. Out-of-State Digital Relocator — moving from NY/CA/NJ to Tampa, research-forward, doesn't have a local agent relationship, comfortable going digital-first
2. Move-Up Millennial — already owns a home, has equity, resents commission from last transaction, financially savvy
3. First-Time Tampa Buyer — budget-conscious, wants to keep every dollar, fears the unknown

EMOTIONAL DRIVERS: Financial autonomy, feeling smart, transparency, "I did this myself", cutting out the middleman
BRAND VOICE: "Alex" — knowledgeable friend who shows the math without condescension. No jargon. Direct.
COMP CONTEXT: Zillow, Redfin, Opendoor. None of them cut the commission — they just digitize the same model.
`,

  seller: `
TARGET: Home Sellers in Tampa Bay, FL
CORE OFFER: Sell your home for 1% at closing. Keep ~$19,000 more on a $430K sale. AI handles negotiations, documents, disclosures, and title coordination. Gig-economy chaperones show your home on demand.

KEY PAIN POINTS:
- Tampa average combined commission is 5.57% — on a $430K home that's ~$23,950 out of pocket
- Most sellers didn't know they were paying the buyer's agent too — until the 2024 NAR settlement made headlines
- Tampa inventory is at a 36% YoY high — sellers are feeling the pressure; "can't sell house" Google searches hit all-time high in early 2026
- Sellers feel the agent is incentivized to take any offer and close fast, not maximize their net

KEY SAVINGS MESSAGE: Sellers keep ~$19,000 more on a $430,000 sale using HomeDirectAI vs. traditional 5% commission.

SELLER PERSONAS:
1. Commission-Awakened Seller ("ICP 3") — just found out about NAR settlement, righteous anger, ready to act
2. Equity-Motivated Move-Up Millennial — bought 2019–2022, has significant equity, doesn't want to give $20K to an agent
3. Accidental Landlord / Reluctant Seller — tried to sell, couldn't, renting the home now, still wants out

EMOTIONAL DRIVERS: Righteous anger at commission structure, financial empowerment, "this is MY money", proving financial savvy
BRAND VOICE: "Alex" base + "Rebel" spike for sellers — names the injustice, offers the third option. The NAR settlement is the match; HomeDirectAI is the accelerant.
COMP CONTEXT: Zillow, FSBO.com, Houzeo, Redfin. FSBO homes sell 15–29% less — this is NOT FSBO. AI negotiation closes the gap.
`,

  concierge: `
TARGET: Concierge / Home Showing Chaperones (Gig Worker Recruitment) — Tampa Bay, FL
CORE OFFER: Earn $20 per home showing. ~30 minutes. Use your Tampa neighborhood knowledge. Work on your schedule. No clients, no pressure, no sales.

KEY VALUE PROPOSITIONS:
- $20/showing = effective $40/hr rate — 2x what DoorDash pays in Tampa ($19–25/hr effective)
- No mileage wear — show homes in your own neighborhood
- No sales pressure — you open the door, facilitate the tour, report back. That's it.
- App-dispatched — same UX as DoorDash or Uber; accept what you want, skip what you don't
- Professional context — showing homes feels more impressive than delivering food

CONCIERGE PERSONAS:
1. Current Gig Worker Upgrade — DoorDash/Uber/Instacart driver looking for better pay per hour with less vehicle wear
2. Real Estate Aspirant — wants to break into real estate, this is the perfect low-risk entry point with local knowledge value
3. Neighborhood Expert — retired, part-time worker, or stay-at-home parent with deep local knowledge; wants supplemental income on a flexible schedule

EMOTIONAL DRIVERS: Pride in local knowledge, upgrading from delivery work, professional identity, flexible income, "I'm more than a driver"
BRAND VOICE: HERO archetype for concierge content — the concierge is the hero of their own financial story. HomeDirectAI is the tool that unlocks the opportunity.
COMP CONTEXT: DoorDash, Uber, TaskRabbit. The comparison always returns to: same gig-economy flexibility, double the hourly rate, no car abuse.
`,
};

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(icp: ICPTarget, angle: HookAngle, context?: string): string {
  return `You are an expert direct-response advertising copywriter for HomeDirectAI, an AI-powered real estate platform in Tampa Bay, FL.

BRAND VOICE RULES:
- Voice name: "Alex" — the knowledgeable friend who shows you the math, not a salesperson
- No jargon. No corporate speak. No exclamation points (unless used once for strong emphasis).
- Lead with the number whenever possible. "$19,000" beats "significant savings".
- Be direct, specific, and human. Acknowledge skepticism — don't paper over it.
- For sellers: you may use some righteous anger/rebel tone ("You paid their agent too and nobody told you")
- For concierges: lean into pride and upgrade narrative ("Your neighborhood knowledge is worth $20 every time you open a door")
- Never use: "game-changer", "revolutionary", "seamless", "innovative", "cutting-edge", "disrupting"

PLATFORM: HomeDirectAI | Tampa Bay, FL | 1% closing fee | AI negotiations + human chaperones
${ICP_CONTEXT[icp]}
${context ? `ADDITIONAL CONTEXT: ${context}` : ""}
${angle !== "all" ? `FOCUS ANGLE: ${angle.toUpperCase()} — weight all copy toward this emotional angle` : ""}

OUTPUT: Return valid JSON matching the exact schema provided. No markdown, no explanation outside the JSON.`;
}

const USER_PROMPT = `Generate a complete set of ad copy for this ICP. Return JSON with this exact structure:
{
  "headlines": ["string x8 — punchy, specific, under 9 words each. Lead with numbers where possible."],
  "hooks": [
    { "angle": "pain", "hook": "1–2 sentence hook that opens with the pain point" },
    { "angle": "savings", "hook": "1–2 sentence hook that leads with the dollar savings" },
    { "angle": "curiosity", "hook": "1–2 sentence hook that opens a loop the reader wants to close" },
    { "angle": "social_proof", "hook": "1–2 sentence hook using credibility/market data" },
    { "angle": "urgency", "hook": "1–2 sentence hook that creates time or market urgency" }
  ],
  "bodyVariants": [
    "Variant A (100–130 words): Pain → Agitate → Solution structure",
    "Variant B (80–100 words): Lead with savings math, then explain how",
    "Variant C (60–80 words): Short punchy narrative, ends with strong CTA setup"
  ],
  "videoScript30": "A 30-second UGC-style video script. Starts with a scroll-stopping spoken hook. Conversational, no teleprompter feel. Format: [HOOK] ... [PROBLEM] ... [SOLUTION] ... [CTA]",
  "videoScript60": "A 60-second UGC-style video script. Same format but more story development. Includes a specific Tampa/local detail.",
  "socialCaptions": [
    "Caption 1 (IG/FB): storytelling format, ends with CTA",
    "Caption 2 (IG/FB): question-led, conversational",
    "Caption 3 (TikTok): hook-first, punchy, 3–5 lines max",
    "Caption 4 (LinkedIn): professional framing, data-led",
    "Caption 5 (Any): user-generated-style, sounds like a real person sharing an experience"
  ],
  "emailSubject": "Email subject line under 50 characters. High open-rate style.",
  "emailPreview": "Email preview text, 80–90 characters. Completes or deepens the subject line.",
  "ctaVariants": ["6 short CTA button texts, each under 5 words"],
  "objectionHandlers": ["3 one-liner responses to the biggest objections — direct, not defensive"]
}`;

// ── Main Export ────────────────────────────────────────────────────────────────

export async function generateMarketingCopy(req: CopyRequest): Promise<GeneratedCopy | null> {
  const angle = req.angle || "all";
  const systemPrompt = buildSystemPrompt(req.icp, angle, req.context);

  const result = await chatJSON<Omit<GeneratedCopy, "icp">>(
    systemPrompt,
    USER_PROMPT,
    2400
  );

  if (!result) return null;

  return { ...result, icp: req.icp };
}
