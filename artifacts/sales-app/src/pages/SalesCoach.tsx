import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  RefreshCcw,
  User as UserIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BrandHeader } from "@/components/BrandHeader";
import { cn } from "@/lib/utils";
import { useCoachChat, type CoachChatMessage } from "@workspace/api-client-react";

const SCENARIOS: Array<{ key: string; label: string; blurb: string }> = [
  {
    key: "cold-door-pest",
    label: "Cold door · pest",
    blurb: "Knock on a Florida homeowner's door. They already have a guy.",
  },
  {
    key: "objection-price",
    label: "Price objection",
    blurb: "Customer likes the pitch but is sticker-shocked.",
  },
  {
    key: "rebuttal-spouse",
    label: "Spouse stall",
    blurb: "Homeowner keeps deflecting with 'I have to ask my spouse'.",
  },
  {
    key: "follow-up-call",
    label: "Follow-up call",
    blurb: "Calling a lead two weeks after first knock.",
  },
];

// Web Speech API has slightly different shapes across browsers; use a loose
// shape and feature-detect at the call site.
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function SalesCoachPage() {
  const [scenario, setScenario] = useState<string>(SCENARIOS[0]!.key);
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const chat = useCoachChat();
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const speechSupported = useMemo(() => !!getSpeechRecognitionCtor(), []);
  const ttsSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Reset chat whenever scenario changes
  useEffect(() => {
    setMessages([]);
    setDraft("");
    setVoiceError(null);
    if (recogRef.current) {
      recogRef.current.abort();
      recogRef.current = null;
      setListening(false);
    }
    if (ttsSupported) window.speechSynthesis.cancel();
  }, [scenario, ttsSupported]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, chat.isPending]);

  const sendMessage = async (content: string) => {
    const text = content.trim();
    if (!text || chat.isPending) return;
    const next: CoachChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    try {
      const res = await chat.mutateAsync({
        data: { scenario, messages: next },
      });
      const reply = res.reply ?? "(no reply)";
      setMessages((cur) => [...cur, { role: "assistant", content: reply }]);
      if (speakReplies && ttsSupported) {
        const u = new SpeechSynthesisUtterance(reply);
        u.rate = 1.05;
        u.pitch = 1.0;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Coach is unavailable.";
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: `⚠️ ${msg}` },
      ]);
    }
  };

  const toggleListening = () => {
    setVoiceError(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceError("Voice input isn't supported in this browser.");
      return;
    }
    if (listening && recogRef.current) {
      recogRef.current.stop();
      return;
    }
    const r = new Ctor();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (ev) => {
      const transcript = Array.from(ev.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) {
        // In voice mode, speaking auto-sends. Otherwise it just fills the box.
        if (voiceMode) {
          sendMessage(transcript);
        } else {
          setDraft((d) => (d ? `${d} ${transcript}` : transcript));
        }
      }
    };
    r.onend = () => {
      setListening(false);
      recogRef.current = null;
    };
    r.onerror = (ev) => {
      setVoiceError(ev.error ?? "Mic error");
      setListening(false);
    };
    recogRef.current = r;
    setListening(true);
    try {
      r.start();
    } catch (e) {
      setListening(false);
      setVoiceError(e instanceof Error ? e.message : "Could not start mic");
    }
  };

  const enableVoiceMode = () => {
    setVoiceMode(true);
    setSpeakReplies(true);
    // Kick off listening as soon as voice mode is on so the rep can just speak.
    if (!listening) toggleListening();
  };

  const disableVoiceMode = () => {
    setVoiceMode(false);
    if (recogRef.current) recogRef.current.stop();
    if (ttsSupported) window.speechSynthesis.cancel();
  };

  const reset = () => {
    setMessages([]);
    setDraft("");
    setVoiceError(null);
    if (ttsSupported) window.speechSynthesis.cancel();
  };

  const activeScenario =
    SCENARIOS.find((s) => s.key === scenario) ?? SCENARIOS[0]!;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="Sales Coach"
        subtitle="Practice live conversations against an AI homeowner. Switch on voice mode and rehearse out loud."
        icon={<Bot className="h-6 w-6" strokeWidth={1.5} />}
        actions={
          <div className="flex flex-wrap gap-1.5">
            {ttsSupported && (
              <Button
                size="sm"
                variant={speakReplies ? "default" : "outline"}
                onClick={() => {
                  if (speakReplies && ttsSupported) window.speechSynthesis.cancel();
                  setSpeakReplies((v) => !v);
                }}
                className={cn(
                  "rounded-lg",
                  speakReplies && "bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6]",
                )}
                title={speakReplies ? "Mute customer voice" : "Hear customer voice"}
              >
                {speakReplies ? (
                  <Volume2 className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="mr-1 h-3.5 w-3.5" />
                )}
                Voice out
              </Button>
            )}
            <Button
              size="sm"
              variant={voiceMode ? "default" : "outline"}
              onClick={voiceMode ? disableVoiceMode : enableVoiceMode}
              disabled={!speechSupported || !ttsSupported}
              className={cn(
                "rounded-lg",
                voiceMode && "bg-[#2C8214] text-white hover:bg-[#246910]",
              )}
              title={
                speechSupported && ttsSupported
                  ? "Hands-free roleplay"
                  : "Voice mode needs Chrome/Edge with mic permission."
              }
            >
              {voiceMode ? (
                <MicOff className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Mic className="mr-1 h-3.5 w-3.5" />
              )}
              {voiceMode ? "Voice mode on" : "Voice mode"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={reset}
              className="rounded-lg"
              disabled={messages.length === 0 && !chat.isPending}
            >
              <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        }
      />

      <Card className="p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Scenario
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCENARIOS.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={s.key === scenario ? "default" : "outline"}
              onClick={() => setScenario(s.key)}
              className={cn(
                "rounded-xl",
                s.key === scenario &&
                  "bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6]",
              )}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{activeScenario.blurb}</p>
      </Card>

      <Card className="flex h-[60vh] min-h-[420px] flex-col">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !chat.isPending && (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Bot className="mb-2 h-8 w-8 text-[#2EA3F2]" />
              <p className="max-w-sm">
                Open with your real door pitch. The customer will react in
                character — handle the objections, then close.
              </p>
              {voiceMode && (
                <Badge className="mt-3 bg-[#2C8214] text-white">
                  Voice mode on — start speaking
                </Badge>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} content={m.content} />
          ))}
          {chat.isPending && (
            <ChatBubble role="assistant" content="…" pending />
          )}
        </div>

        <form
          className="border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(draft);
          }}
        >
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(draft);
                }
              }}
              placeholder={
                voiceMode
                  ? "Speak your pitch — typing also works."
                  : "Type your pitch or rebuttal…"
              }
              rows={2}
              className="min-h-[44px] resize-none rounded-xl"
            />
            {speechSupported && (
              <Button
                type="button"
                size="icon"
                variant={listening ? "default" : "outline"}
                className={cn(
                  "h-11 w-11 shrink-0 rounded-xl",
                  listening && "animate-pulse bg-[#FFBF00] text-slate-950 hover:bg-[#e9ad00]",
                )}
                onClick={toggleListening}
                title={listening ? "Stop listening" : "Hold to dictate"}
              >
                {listening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              type="submit"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl bg-[#2EA3F2] hover:bg-[#1d8fd8]"
              disabled={!draft.trim() || chat.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {voiceError && (
            <p className="mt-2 text-xs text-amber-500">{voiceError}</p>
          )}
          {!speechSupported && (
            <p className="mt-1 text-xs text-muted-foreground">
              Voice input needs Chrome, Edge, or Safari with mic permission.
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}

function ChatBubble({
  role,
  content,
  pending = false,
}: {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2EA3F2]/15 text-[#2EA3F2]">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-[#2EA3F2] text-slate-950"
            : "bg-card border border-border text-foreground",
          pending && "italic text-muted-foreground",
        )}
      >
        {content}
      </div>
      {isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2C8214]/15 text-[#2C8214]">
          <UserIcon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
