import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

const SCENARIO_PROMPTS: Record<string, string> = {
  "cold-door-pest":
    "You are 'Pat', a homeowner in Southwest Florida. A pest-control sales rep just knocked on your front door. You are mildly annoyed but not rude. Push back on price, ask if they're licensed, and mention you already have a guy. Stay in character — never break the fourth wall.",
  "objection-price":
    "You are 'Sam', a homeowner who likes the rep's pitch but is sticker-shocked. Resist the price hard but stay reasonable. If the rep handles three objections well, agree to schedule a service.",
  "rebuttal-spouse":
    "You are 'Jordan', a homeowner who keeps deflecting with 'I have to ask my spouse'. The rep needs to either get the spouse on the phone or build enough urgency that you commit on your own.",
  "follow-up-call":
    "You are 'Riley', a lead the rep already met two weeks ago and now is calling for a follow-up. You vaguely remember them. You're polite but distracted; the rep needs to re-anchor value before pitching.",
};

const DEFAULT_SCENARIO_KEY = "cold-door-pest";

const COACH_SYSTEM = (scenario: string) =>
  `${scenario}

Rules:
- Keep replies SHORT (1-3 sentences). This is a real-time door conversation.
- React naturally to what the rep just said. Don't agree too easily — make them earn it.
- Never list bullet points or markdown — speak like a real person on a doorstep.
- Stay in character throughout. Do not address the rep as 'the user' or refer to AI.
`;

// Lightweight canned replies for demo mode (no API key configured). Picks
// the next reply by turn count + scenario so the conversation feels like
// it has an arc instead of repeating the same line.
const DEMO_REPLIES: Record<string, string[]> = {
  "cold-door-pest": [
    "Yeah? What's this about — I'm in the middle of dinner.",
    "Pest control? I already have a guy who comes by every quarter.",
    "Honestly your price sounds high. What makes you different from Terminix?",
    "Are you licensed in Lee County? I had a bad experience with a door knocker last year.",
    "Alright, you've actually been pretty straight with me. What would the first visit look like?",
  ],
  "objection-price":
    [
      "That sounds great, but I'm not paying that much. Not even close.",
      "Look, I get it's a good service — it's still way out of budget for me.",
      "If I really had to do this, what's the lowest you can go and still make it worth it?",
      "Hmm. And how long is that price locked in for?",
      "Okay, you've got my attention. What's the next step?",
    ],
  "rebuttal-spouse": [
    "Sounds nice but I have to run it by my wife first.",
    "She handles all the home stuff. I genuinely can't sign anything today.",
    "I could try to call her but she's at work — she won't pick up.",
    "Okay. If you can show me one more time why this beats waiting til next month, maybe.",
    "Alright. Let me see if she'll do a quick call. Give me a sec.",
  ],
  "follow-up-call": [
    "Hey… remind me which company you're with?",
    "Right, right. Yeah, we talked about something but I honestly forgot the details.",
    "I'm slammed today. Can you give me the 30-second version?",
    "Okay that does ring a bell. What were the next steps again?",
    "Yeah let's lock in a time. What's good for you this week?",
  ],
};

function demoReply(scenarioKey: string, userTurns: number): string {
  const bank = DEMO_REPLIES[scenarioKey] ?? DEMO_REPLIES[DEFAULT_SCENARIO_KEY]!;
  const idx = Math.min(userTurns - 1, bank.length - 1);
  return bank[Math.max(idx, 0)]!;
}

interface CoachProviderResult {
  reply: string;
}

type CoachProvider = "openai" | "anthropic" | "demo";

function pickProvider(): CoachProvider {
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  return "demo";
}

async function callOpenAI(
  scenarioKey: string,
  messages: CoachMessage[],
): Promise<CoachProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      temperature: 0.8,
      messages: [
        { role: "system", content: COACH_SYSTEM(SCENARIO_PROMPTS[scenarioKey]!) },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.warn({ status: res.status, text }, "coach: openai non-200");
    throw new Error("OpenAI upstream error");
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = data.choices?.[0]?.message?.content?.trim() || "(silence)";
  return { reply };
}

async function callAnthropic(
  scenarioKey: string,
  messages: CoachMessage[],
): Promise<CoachProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: COACH_SYSTEM(SCENARIO_PROMPTS[scenarioKey]!),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.warn({ status: res.status, text }, "coach: anthropic non-200");
    throw new Error("Anthropic upstream error");
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const reply =
    data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim() || "(silence)";
  return { reply };
}

router.post("/coach/chat", requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const messages: CoachMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const scenarioKey =
      typeof body.scenario === "string" && SCENARIO_PROMPTS[body.scenario]
        ? body.scenario
        : DEFAULT_SCENARIO_KEY;

    if (messages.length === 0) {
      res.status(400).json({ error: "messages required" });
      return;
    }

    const provider = pickProvider();
    let reply: string;

    if (provider === "demo") {
      // No API key configured — fall through to canned roleplay so the UI
      // still demos end-to-end. UI tags this with "demo mode" via the header.
      const userTurns = messages.filter((m) => m.role === "user").length;
      reply = demoReply(scenarioKey, userTurns);
      res.setHeader("X-Coach-Provider", "demo");
      res.json({ reply, coaching: null });
      return;
    }

    try {
      const result =
        provider === "openai"
          ? await callOpenAI(scenarioKey, messages)
          : await callAnthropic(scenarioKey, messages);
      reply = result.reply;
    } catch {
      res.status(502).json({ error: "Coach upstream error" });
      return;
    }

    res.setHeader("X-Coach-Provider", provider);
    res.json({ reply, coaching: null });
  } catch (e) {
    next(e);
  }
});

export default router;
