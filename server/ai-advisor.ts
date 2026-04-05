/**
 * AI Home Advisor — Context-aware chat assistant
 * Uses the unified AI engine (Together AI → Fireworks AI → DeepSeek → rule-based).
 * Context awareness (page, role, transaction) is layered on top of the comprehensive
 * real estate knowledge base from knowledge-base.ts.
 */

import { chat, sanitizeMessage } from "./ai-engine";
import { getBaseKnowledge } from "./knowledge-base";

function buildContextPrompt(context: {
  page: string;
  userRole?: string;
  userName?: string;
  transactionId?: number;
  listingAddress?: string;
  offerAmount?: number;
  listingPrice?: number;
}): string {
  const { page, userRole, userName, transactionId, listingAddress, offerAmount, listingPrice } = context;

  let pageContext = "";
  switch (true) {
    case page.includes("/transaction") && page.includes("/inspection"):
      pageContext = "The user is in the INSPECTION PORTAL. Help them understand inspection findings, what's serious vs cosmetic, whether to request repairs or credits, and how to negotiate inspection issues.";
      break;
    case page.includes("/transaction") && page.includes("/escrow"):
      pageContext = "The user is in the ESCROW & CLOSING PORTAL. Help with wire transfer questions, closing costs, escrow timelines, and what to expect. ALWAYS warn about wire fraud — tell them to verify instructions by phone.";
      break;
    case page.includes("/transaction") && page.includes("/lender"):
      pageContext = "The user is in the LENDER PORTAL. Help with mortgage questions — rates, loan types (FHA/VA/conventional), PMI, DTI ratios, pre-approval, required documents, and the underwriting process.";
      break;
    case page.includes("/transaction") && page.includes("/appraisal"):
      pageContext = "The user is in the APPRAISAL PORTAL. Help with appraisal questions — how appraisals work, what happens if it comes in low (appraisal gap), comparables, and how to challenge a low appraisal.";
      break;
    case page.includes("/transaction") && page.includes("/title"):
      pageContext = "The user is in the TITLE COMPANY PORTAL. Help with title insurance, title searches, liens, encumbrances, what documents the title company needs, and the closing process.";
      break;
    case page.includes("/transaction"):
      pageContext = "The user is viewing their TRANSACTION HUB — the main closing dashboard. Help them understand their checklist items, what steps come next, and the overall closing timeline.";
      break;
    case page.includes("/negotiate"):
      pageContext = "The user is in the NEGOTIATION CHAT. Help with offer strategy, counter-offers, contingencies, and negotiation tactics.";
      break;
    case page.includes("/listing"):
      pageContext = `The user is viewing a PROPERTY LISTING.${listingPrice ? ` Listing price: $${listingPrice.toLocaleString()}.` : ""} Help with questions about the property, neighborhood, pricing, whether it's a good deal, and how to make an offer.`;
      break;
    case page.includes("/sell"):
      pageContext = "The user is LISTING THEIR HOME for sale. Help with pricing strategy, staging tips, what photos to take, how to write a compelling description, and what to expect.";
      break;
    case page.includes("/dashboard"):
      pageContext = "The user is on their DASHBOARD. Help them understand their offers, walkthroughs, transactions, and what actions they need to take.";
      break;
    case page.includes("/search") || page.includes("/map"):
      pageContext = "The user is BROWSING LISTINGS. Help them with search tips, what to look for in a home, neighborhood questions, and how the buying process works on HomeDirectAI.";
      break;
    case page.includes("/chaperone"):
      pageContext = "The user is in the CHAPERONE section. Help with questions about becoming a chaperone, the application process, how payments work, and what to expect during showings.";
      break;
    default:
      pageContext = "The user is on the HomeDirectAI platform. Help with any real estate questions — buying, selling, the closing process, financing, inspections, or how the platform works.";
  }

  return `## SESSION CONTEXT
Current page: ${page}
${userName ? `User's name: ${userName}` : ""}
${userRole ? `User role: ${userRole}` : ""}
${transactionId ? `Active transaction ID: #${transactionId}` : ""}
${listingAddress ? `Property: ${listingAddress}` : ""}
${offerAmount ? `Offer amount: $${offerAmount.toLocaleString()}` : ""}
${listingPrice ? `Listing price: $${listingPrice.toLocaleString()}` : ""}

## CURRENT PAGE CONTEXT
${pageContext}

## MLS LISTINGS NOTE
HomeDirectAI shows BOTH our own listings (green on map, 1% fee) AND MLS listings from the broader market (blue on map). For MLS listings, the seller may have a traditional agent, but buyers can still use our AI negotiation tools to prepare competitive offers. When discussing MLS listings, explain that buyers can still save significantly by using our platform.`;
}

export async function getAdvisorResponse(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  context: {
    page: string;
    userRole?: string;
    userName?: string;
    transactionId?: number;
    listingAddress?: string;
    offerAmount?: number;
    listingPrice?: number;
  }
): Promise<string> {
  const contextPrompt = buildContextPrompt(context);
  const systemPrompt = getBaseKnowledge() + "\n\n" + contextPrompt;

  const result = await chat(systemPrompt, message, conversationHistory, 800);

  if (result !== null) {
    return result;
  }

  // Rule-based fallback when no API keys are configured
  return getFallbackResponse(message, context);
}

function getFallbackResponse(message: string, context: { page: string }): string {
  const lower = message.toLowerCase();

  if (lower.includes("how") && lower.includes("work")) {
    return "HomeDirectAI handles the entire home buying and selling process — from listing to closing. Sellers list their home and we charge just 1% at closing (saving thousands vs the traditional 5-6% agent commission). Buyers can browse listings, schedule $20 chaperone walkthroughs, and make offers. Our AI handles negotiations, document preparation, and closing coordination. Is there a specific part of the process you'd like to know more about?";
  }
  if (lower.includes("closing cost") || lower.includes("how much")) {
    return "Closing costs typically include your 1% HomeDirectAI fee, title insurance, recording fees, prorated taxes, and any lender fees. For a typical $400K home, buyers can expect $8,000-$12,000 in total closing costs. The big savings is on the commission — you save about $18,000 compared to using a traditional agent. Would you like me to break down the specific costs?";
  }
  if (lower.includes("inspection")) {
    return "A home inspection is one of the most important steps in buying a home. A licensed inspector examines the property's structure, systems, and condition. The inspection typically costs $350-$600 and takes 2-3 hours. In Florida, the standard inspection period is 15 days from the effective date of the contract. After receiving the report, our AI will analyze the findings and help you decide whether to request repairs, credits, or move forward as-is. Do you have specific concerns about the inspection?";
  }
  if (lower.includes("offer") || lower.includes("negotiate")) {
    return "When you're ready to make an offer, our AI analyzes comparable sales, market conditions, and the property's time on market to help you determine a competitive offer price. Once submitted, the AI handles back-and-forth negotiation with the seller. You can ask for comps, suggest counter-offers, or request specific contingencies through the negotiation chat.";
  }
  if (lower.includes("wire") || lower.includes("transfer") || lower.includes("escrow")) {
    return "⚠️ Wire fraud is the #1 cybercrime in real estate. ALWAYS verify wire instructions by calling your title company directly using a phone number from their official website — never from an email. Your escrow portal has the wire details, but please verify by phone before sending any funds. How can I help with the closing process?";
  }
  if (lower.includes("mortgage") || lower.includes("loan") || lower.includes("rate")) {
    return "For mortgage questions, your lender portal has your loan details and required documents. Generally, you'll want to compare rates from at least 3 lenders. A conventional loan with 20% down avoids PMI. FHA loans allow as low as 3.5% down. Your total monthly payment includes principal, interest, property taxes, and homeowner's insurance. Want me to explain any of these in more detail?";
  }
  if (lower.includes("chaperone") || lower.includes("walkthrough") || lower.includes("showing")) {
    return "Our chaperone model is like DoorDash for home tours! When you schedule a walkthrough, a local, background-checked chaperone meets you at the property to guide you through. It costs just $20. They'll unlock the home, walk you through each room, and answer basic questions about the property. Any specific questions about scheduling a walkthrough?";
  }
  if (lower.includes("mls") || lower.includes("realtor") || lower.includes("market listing")) {
    return "HomeDirectAI now shows both our own listings (1% fee) and MLS listings from the broader market. Our own listings are the best deal — no traditional agents, just 1% at closing. But we also show you MLS listings so you can see everything available. For MLS listings, the seller may have a traditional agent, but you can still use our AI negotiation tools to prepare a competitive offer. Want to browse listings or have questions about a specific property?";
  }
  if (lower.includes("florida") || lower.includes("law") || lower.includes("disclosure")) {
    return "Florida real estate has some unique rules. Sellers must disclose known material defects (Johnson v. Davis ruling). The standard inspection period is 15 days. Documentary stamp taxes are $0.70 per $100 of sale price (seller pays). Florida title insurance rates are set by state statute. I can walk you through any specific aspect of Florida real estate law you need to understand.";
  }

  return "I'm your HomeDirectAI Home Advisor! I can help with anything related to buying or selling a home — from understanding the closing process and inspections, to mortgage questions and negotiation strategy. Our platform saves you thousands with just a 1% fee at closing, and we show you both our own listings and MLS listings from the broader market. What would you like to know?";
}
