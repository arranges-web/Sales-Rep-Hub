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

router.post("/coach/chat", requireAuth, async (req, res, next) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({
        error:
          "Coach AI not configured. Set ANTHROPIC_API_KEY on the API server to enable practice chat.",
      });
      return;
    }

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

    // Forward to Anthropic Messages API.
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
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
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!anthropicRes.ok) {
      const text = await anthropicRes.text();
      logger.warn({ status: anthropicRes.status, text }, "coach: anthropic non-200");
      res.status(502).json({ error: "Coach upstream error" });
      return;
    }

    const data = (await anthropicRes.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const reply =
      data.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("")
        .trim() || "(silence)";

    res.json({ reply, coaching: null });
  } catch (e) {
    next(e);
  }
});

export default router;
