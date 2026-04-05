/**
 * HomeDirectAI Unified AI Engine
 * Provider-agnostic LLM integration with automatic fallback chain:
 *   Together AI → Fireworks AI → DeepSeek → Rule-based
 *
 * All three cloud providers use OpenAI-compatible APIs (same request/response format).
 * If only DEEPSEEK_API_KEY is set, behavior is identical to the previous implementation.
 */

interface AIConfig {
  provider: "together" | "fireworks" | "deepseek" | "fallback";
  model: string;
  apiKey: string;
  baseUrl: string;
}

/**
 * Detect which provider to use based on available environment variables.
 * Priority: Together AI → Fireworks AI → DeepSeek → rule-based fallback
 */
function getProvider(): AIConfig {
  if (process.env.TOGETHER_API_KEY) {
    return {
      provider: "together",
      model: process.env.TOGETHER_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      apiKey: process.env.TOGETHER_API_KEY,
      baseUrl: "https://api.together.xyz/v1",
    };
  }
  if (process.env.FIREWORKS_API_KEY) {
    return {
      provider: "fireworks",
      model: process.env.FIREWORKS_MODEL || "accounts/fireworks/models/llama-v3p1-8b-instruct",
      apiKey: process.env.FIREWORKS_API_KEY,
      baseUrl: "https://api.fireworks.ai/inference/v1",
    };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      provider: "deepseek",
      model: "deepseek-chat",
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: "https://api.deepseek.com",
    };
  }
  return { provider: "fallback", model: "rule-based", apiKey: "", baseUrl: "" };
}

/**
 * Low-level LLM call. Uses the active provider's OpenAI-compatible endpoint.
 * Returns null if provider is "fallback" (no API keys configured).
 * Throws on network/API errors (caller should catch and fall back).
 */
async function callLLM(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 800
): Promise<string | null> {
  const config = getProvider();

  if (config.provider === "fallback") {
    return null;
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`${config.provider} API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content || null;
}

/**
 * Primary public interface for all AI features.
 *
 * @param systemPrompt  Full system prompt (base knowledge + context)
 * @param userMessage   The user's current message (will be sanitized)
 * @param history       Previous conversation messages (kept to last 10)
 * @param maxTokens     Max tokens in the response (default 800)
 * @returns             AI response string, or null if no provider is available
 */
export async function chat(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: string; content: string }> = [],
  maxTokens: number = 800
): Promise<string | null> {
  const config = getProvider();

  const sanitized = sanitizeMessage(userMessage);

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: sanitizeMessage(m.content),
    })),
    { role: "user", content: sanitized },
  ];

  try {
    const result = await callLLM(messages, maxTokens);
    if (result !== null) {
      console.log(`[AI Engine] Provider: ${config.provider} | Model: ${config.model} | Tokens requested: ${maxTokens}`);
    } else {
      console.log(`[AI Engine] No API keys configured — using rule-based fallback`);
    }
    return result;
  } catch (error) {
    console.error(`[AI Engine] ${config.provider} call failed:`, error);
    return null;
  }
}

/**
 * Variant of chat() specifically for structured JSON responses.
 * Returns parsed object or null on failure.
 */
export async function chatJSON<T>(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 400
): Promise<T | null> {
  // Add JSON instruction to system prompt
  const jsonSystemPrompt = systemPrompt + "\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanation.";

  const result = await chat(jsonSystemPrompt, userMessage, [], maxTokens);
  if (!result) return null;

  try {
    return JSON.parse(result.replace(/```json\n?|```/g, "").trim()) as T;
  } catch {
    console.error(`[AI Engine] Failed to parse JSON response:`, result.substring(0, 200));
    return null;
  }
}

/**
 * Returns the name of the currently active provider (for logging/debugging).
 */
export function getActiveProvider(): string {
  return getProvider().provider;
}

/**
 * Returns true if any LLM provider is configured (not rule-based fallback).
 */
export function hasLLMProvider(): boolean {
  return getProvider().provider !== "fallback";
}

// ── Shared utilities ──────────────────────────────────────────────────────────

/**
 * Strip sensitive data before sending to any external API.
 */
export function sanitizeMessage(text: string): string {
  return text
    // SSN patterns
    .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, "[SSN REDACTED]")
    // Bank account numbers (8–17 digits)
    .replace(/\b\d{8,17}\b/g, "[ACCOUNT REDACTED]")
    // Routing numbers (9 digits)
    .replace(/\b\d{9}\b/g, "[NUMBER REDACTED]")
    // Credit card patterns
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[CARD REDACTED]");
}
