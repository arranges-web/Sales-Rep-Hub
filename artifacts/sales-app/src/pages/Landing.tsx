import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Trophy, MapPin, Gift, Zap, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";

interface Pulse {
  topRepFirstName: string | null;
  topRepPoints: number;
  dealsThisWeek: number;
  totalPointsPool: number;
  activeReps: number;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

export default function LandingPage() {
  const [pulse, setPulse] = useState<Pulse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/pulse")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setPulse(data);
      })
      .catch(() => {
        /* fall back to static stats */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = pulse
    ? [
        {
          k: pulse.topRepFirstName
            ? pulse.topRepFirstName.slice(0, 10)
            : "—",
          v: pulse.topRepFirstName
            ? `Top rep • ${compact(pulse.topRepPoints)} pts`
            : "Top rep",
        },
        {
          k: pulse.dealsThisWeek > 0 ? `${pulse.dealsThisWeek}` : "0",
          v: "Deals closed this week",
        },
        {
          k: compact(pulse.totalPointsPool),
          v: "Points in the pool",
        },
      ]
    : [
        { k: "Live", v: "Top rep" },
        { k: "Live", v: "Deals closed this week" },
        { k: "$10k+", v: "Points in the pool" },
      ];

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 jt-grid-bg opacity-60" />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 top-10 h-[28rem] w-[28rem] rounded-full bg-[#3DA935]/15 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-[32rem] w-[32rem] rounded-full bg-[#2C8214]/10 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#FFBF00]/10 blur-[120px]" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo className="h-9" />
        <div className="flex items-center gap-2">
          <Button asChild className="rounded-lg bg-[#3DA935] text-slate-950 hover:bg-[#4FBF45]">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#3DA935]" />
            Joshua Tree Inc — SWFL Sales
          </div>
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-7xl">
            Stack deals.
            <span className="block bg-gradient-to-r from-[#3DA935] via-[#6FD860] to-[#3DA935] bg-clip-text text-transparent">
              Cash the points.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            The internal hub for Joshua Tree reps. Track every job, climb the
            board, and trade points for gear, tickets, and trips.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-lg bg-[#3DA935] px-6 font-semibold text-slate-950 shadow-lg shadow-[#3DA935]/20 hover:bg-[#4FBF45]"
            >
              <Link href="/login">
                Enter the Hub
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Live pulse strip */}
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {stats.map((s) => (
              <div key={s.v} className="bg-card px-4 py-5">
                <div className="font-stat text-2xl font-bold text-foreground">
                  {s.k}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {s.v}
                </div>
              </div>
            ))}
          </div>
          {pulse && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2C8214] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#2C8214]" />
              </span>
              Live from the SWFL board
            </div>
          )}
        </div>

        <div className="mt-20 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Trophy, color: "#FFBF00", title: "Leaderboard", body: "Live rankings, badges, tier cutoffs." },
            { icon: MapPin, color: "#3DA935", title: "Canvas Map", body: "Every Jobber job, quote and request on one map — with the homeowner's phone." },
            { icon: Gift, color: "#2C8214", title: "Vault", body: "Trade points for gear, tools, trips." },
            { icon: Zap, color: "#FFBF00", title: "Hype Feed", body: "Wins, high-fives, comments." },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-xl border border-border bg-card p-5 transition hover:border-[#3DA935]/40 hover:shadow-[0_0_0_1px_rgba(61,169,53,0.15),0_12px_32px_-16px_rgba(61,169,53,0.45)]"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background"
                  style={{ color: f.color, boxShadow: `inset 0 0 0 1px ${f.color}33` }}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 font-bold text-foreground">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="mt-16 border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">Joshua Tree Inc.</span> — ISA
            certified arborists serving Cape Coral, Fort Myers &amp; Southwest Florida.
          </div>
          <div className="flex items-center gap-4 text-xs">
            <a
              href="https://myjoshuatree.com/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#3DA935] hover:underline"
            >
              myjoshuatree.com
            </a>
            <span className="text-muted-foreground">
              Internal use only · Employees &amp; contractors
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
