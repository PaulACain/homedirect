import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";

// ── ICP Context (full brand + ICP data embedded) ──────────────────────────────

const ICP_CONTEXT: Record<string, string> = {
  buyer: `
TARGET: Home Buyers in Tampa Bay, FL
CORE OFFER: Buy a home for just 1% at closing. AI handles negotiations, paperwork, and everything through closing. Human chaperone shows homes on demand.

KEY PAIN POINTS:
- Buyer agents charge ~$9,818 on a median $430K Tampa home — paid by buyer via inflated offer price
- Post-NAR settlement, agents still average 5.44% combined — buyers have no real alternative yet
- Agents are incentivized to close fast, not optimally — buyers want transparency
- Paperwork designed to confuse; buyers want 24/7 access to status and docs

SAVINGS MESSAGE: On a $430,000 home, saves buyers approximately $9,818 vs. traditional buyer's agent.

BUYER PERSONAS:
1. Out-of-State Digital Relocator — moving from NY/CA/NJ to Tampa, research-forward, digital-first
2. Move-Up Millennial — owns a home, has equity, resents last commission, financially savvy (age 32–42, HHI $90K–$160K)
3. First-Time Tampa Buyer — budget-conscious, wants every dollar, fears the unknown

EMOTIONAL DRIVERS: Financial autonomy, feeling smart, transparency, cutting out the middleman
BRAND VOICE: "Alex" — knowledgeable friend, shows the math without condescension. No jargon. Direct. Lead with numbers.
COMPETITORS: Zillow, Redfin, Opendoor — none actually cut the commission, they just digitize the same model.
`,
  seller: `
TARGET: Home Sellers in Tampa Bay, FL
CORE OFFER: Sell your home for 1% at closing. Keep ~$19,000 more on a $430K sale. AI handles negotiations, docs, disclosures, title coordination. Chaperones show your home on demand.

KEY PAIN POINTS:
- Tampa average commission is 5.57% — on a $430K home that's ~$23,950 out of pocket
- Most sellers didn't know they were paying the buyer's agent too — until the 2024 NAR settlement
- Tampa inventory at 36% YoY high — sellers under pressure; "can't sell house" Google searches hit all-time high March 2026
- Agents incentivized to take any offer and close fast, not maximize seller net

SAVINGS MESSAGE: Sellers keep ~$19,000 more on a $430,000 sale vs. traditional 5% commission.

SELLER PERSONAS:
1. Commission-Awakened Seller — just learned about NAR settlement, righteous anger, ready to act now
2. Equity-Motivated Move-Up Millennial — bought 2019–2022, significant equity, won't give $20K to an agent
3. Accidental Landlord — tried to sell, couldn't, now renting, still wants out

EMOTIONAL DRIVERS: Righteous anger at commission structure, financial empowerment, "this is MY money", proving financial savvy
BRAND VOICE: "Alex" base + "Rebel" spike — names the injustice, offers the third option. The NAR settlement is the match. HomeDirectAI is the accelerant.
COMPETITORS: FSBO.com, Houzeo, Redfin. FSBO homes sell 15–29% less — this is NOT FSBO. AI negotiation closes the gap.
`,
  concierge: `
TARGET: Concierge / Home Showing Chaperones (Gig Worker Recruitment) — Tampa Bay, FL
CORE OFFER: Earn $20 per home showing. ~30 minutes. Use your Tampa neighborhood knowledge. Work your own schedule. No clients, no sales, no pressure.

KEY VALUE PROPOSITIONS:
- $20/showing = effective $40/hr rate — 2x what DoorDash pays in Tampa ($19–25/hr)
- No vehicle wear — show homes in your own neighborhood
- No sales pressure — open the door, facilitate the tour, report back. That's it.
- App-dispatched — same UX as DoorDash or Uber; accept what you want, skip what you don't
- Professional context — showing homes is more impressive than delivering food

CONCIERGE PERSONAS:
1. Current Gig Worker Upgrade — DoorDash/Uber/Instacart driver wanting better pay with less vehicle wear
2. Real Estate Aspirant — wants to break into real estate; this is the perfect low-risk entry point
3. Neighborhood Expert — retired, part-time, or stay-at-home parent with deep local knowledge; wants flexible supplemental income

EMOTIONAL DRIVERS: Pride in local knowledge, upgrading from delivery work, professional identity, flexible income
BRAND VOICE: HERO archetype — the concierge is the hero of their own story. HomeDirectAI is the tool that unlocks the opportunity.
COMP: DoorDash, Uber, TaskRabbit — same flexibility, double the hourly rate, no car abuse.
`,
};

async function callLLM(systemPrompt: string, userPrompt: string, apiKey: string, baseUrl: string, model: string): Promise<string | null> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2800,
      temperature: 0.75,
    }),
  });
  if (!res.ok) throw new Error(`LLM API error: ${res.status}`);
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || null;
}

// ── Env-based key resolution ─────────────────────────────────────────────────
// API keys come from environment variables only — never stored in the database.
// Set them in .env locally or in Railway's environment variable store.
function resolveApiKey(provider: string): string | undefined {
  const keyMap: Record<string, string> = {
    together:  process.env.TOGETHER_API_KEY  || "",
    openai:    process.env.OPENAI_API_KEY    || "",
    deepseek:  process.env.DEEPSEEK_API_KEY  || "",
    fireworks: process.env.FIREWORKS_API_KEY || "",
  };
  return keyMap[provider] || undefined;
}

export async function registerRoutes(_httpServer: Server, app: Express) {

  // ── Settings ─────────────────────────────────────────────────────────────────
  app.get("/api/settings", (_req, res) => {
    const provider = storage.getSetting("provider")?.value || "together";
    const model    = storage.getSetting("model")?.value    || "";
    const apiKey   = resolveApiKey(provider);
    // Report which env vars are detected (without exposing the values)
    const envStatus = {
      TOGETHER_API_KEY:  !!process.env.TOGETHER_API_KEY,
      OPENAI_API_KEY:    !!process.env.OPENAI_API_KEY,
      DEEPSEEK_API_KEY:  !!process.env.DEEPSEEK_API_KEY,
      FIREWORKS_API_KEY: !!process.env.FIREWORKS_API_KEY,
    };
    res.json({ hasKey: !!apiKey, provider, model, envStatus });
  });

  app.post("/api/settings", (req, res) => {
    const { provider, model } = req.body;
    if (provider !== undefined) storage.setSetting("provider", provider);
    if (model    !== undefined) storage.setSetting("model",    model);
    res.json({ ok: true });
  });

  // ── Copy Generation ───────────────────────────────────────────────────────────
  app.post("/api/generate-copy", async (req, res) => {
    const { icp, angle, context } = req.body;

    if (!icp || !["buyer", "seller", "concierge"].includes(icp)) {
      return res.status(400).json({ error: "icp must be buyer | seller | concierge" });
    }

    const provider = storage.getSetting("provider")?.value || "together";
    const apiKey = resolveApiKey(provider);
    if (!apiKey) {
      return res.status(503).json({ error: `No API key found. Set ${provider.toUpperCase()}_API_KEY in your environment variables.` });
    }
    const modelSetting = storage.getSetting("model");

    const PROVIDERS: Record<string, { baseUrl: string; defaultModel: string }> = {
      together:  { baseUrl: "https://api.together.xyz/v1",              defaultModel: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo" },
      fireworks: { baseUrl: "https://api.fireworks.ai/inference/v1",     defaultModel: "accounts/fireworks/models/llama-v3p1-8b-instruct" },
      deepseek:  { baseUrl: "https://api.deepseek.com",                  defaultModel: "deepseek-chat" },
      openai:    { baseUrl: "https://api.openai.com/v1",                 defaultModel: "gpt-4o-mini" },
    };

    const { baseUrl, defaultModel } = PROVIDERS[provider] || PROVIDERS.together;
    const model = modelSetting?.value || defaultModel;
    const apiKeySetting = { value: apiKey };

    const systemPrompt = `You are an expert direct-response advertising copywriter for HomeDirectAI, an AI-powered real estate platform in Tampa Bay, FL.

BRAND VOICE RULES:
- Voice: "Alex" — knowledgeable friend who shows the math, never a salesperson
- Lead with specific numbers ($19,000 beats "significant savings")
- No jargon. No corporate speak. No exclamation points.
- Be direct, specific, human. Acknowledge skepticism.
- For sellers: righteous anger tone ("You paid their agent too and nobody told you")
- For concierges: hero/pride narrative ("Your Tampa knowledge pays $20 every door you open")
- Never use: "game-changer", "revolutionary", "seamless", "innovative", "cutting-edge", "disrupting"

${ICP_CONTEXT[icp]}
${angle && angle !== "all" ? `FOCUS ANGLE: ${angle.toUpperCase()} — weight all copy toward this emotional angle` : ""}
${context ? `ADDITIONAL CONTEXT: ${context}` : ""}

IMPORTANT: Respond with valid JSON only. No markdown, no explanation outside the JSON.`;

    const userPrompt = `Generate a complete set of ad copy. Return this exact JSON structure:
{
  "headlines": ["8 punchy headlines, under 9 words each, lead with numbers where possible"],
  "hooks": [
    {"angle":"pain","hook":"1-2 sentence hook opening with the pain point"},
    {"angle":"savings","hook":"1-2 sentence hook leading with the dollar savings"},
    {"angle":"curiosity","hook":"1-2 sentence hook that opens a loop"},
    {"angle":"social_proof","hook":"1-2 sentence hook using market data"},
    {"angle":"urgency","hook":"1-2 sentence hook creating time/market urgency"}
  ],
  "bodyVariants": [
    "Variant A (100-130 words): Pain → Agitate → Solution",
    "Variant B (80-100 words): Lead with savings math, then explain how",
    "Variant C (60-80 words): Short punchy narrative, strong CTA setup"
  ],
  "videoScript30": "[HOOK] ... [PROBLEM] ... [SOLUTION] ... [CTA] — 30-second UGC-style, conversational, no teleprompter feel",
  "videoScript60": "[HOOK] ... [STORY] ... [SOLUTION] ... [CTA] — 60-second UGC with a specific Tampa local detail",
  "socialCaptions": [
    "IG/FB storytelling format, ends with CTA",
    "Question-led, conversational",
    "TikTok: hook-first, 3-5 punchy lines",
    "LinkedIn: professional, data-led",
    "UGC-style: sounds like a real person sharing their experience"
  ],
  "emailSubject": "Under 50 chars, high open-rate style",
  "emailPreview": "80-90 chars, deepens the subject line",
  "ctaVariants": ["6 CTA button texts, under 5 words each"],
  "objectionHandlers": ["3 one-liner responses to the top objections — direct, not defensive"]
}`;

    try {
      const raw = await callLLM(systemPrompt, userPrompt, apiKeySetting.value, baseUrl, model);
      if (!raw) return res.status(503).json({ error: "LLM returned empty response" });

      const cleaned = raw.replace(/```json\n?|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      // Save to history
      storage.saveGeneration({
        icp,
        angle: angle || null,
        context: context || null,
        result: JSON.stringify(parsed),
        createdAt: Date.now(),
      });

      res.json(parsed);
    } catch (err: any) {
      console.error("[Copy Gen] Error:", err.message);
      res.status(500).json({ error: err.message || "Generation failed" });
    }
  });

  // ── History ───────────────────────────────────────────────────────────────────
  app.get("/api/history", (_req, res) => {
    const gens = storage.getGenerations(20);
    res.json(gens.map(g => ({
      id: g.id,
      icp: g.icp,
      angle: g.angle,
      context: g.context,
      createdAt: g.createdAt,
      result: JSON.parse(g.result),
    })));
  });

  app.delete("/api/history/:id", (req, res) => {
    storage.deleteGeneration(Number(req.params.id));
    res.json({ ok: true });
  });
}
