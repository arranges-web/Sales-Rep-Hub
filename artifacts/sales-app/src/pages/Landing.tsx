import { SignInButton, SignUpButton } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Trophy, MapPin, Gift, Zap, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function LandingPage() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 jt-grid-bg opacity-60" />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 top-10 h-[28rem] w-[28rem] rounded-full bg-[#2EA3F2]/15 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-[32rem] w-[32rem] rounded-full bg-[#2C8214]/10 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#FFBF00]/10 blur-[120px]" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo className="h-9" />
        <div className="flex items-center gap-2">
          <SignInButton mode="modal">
            <Button variant="ghost" className="rounded-lg text-foreground hover:bg-muted">
              Sign in
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button className="rounded-lg bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6]">
              Join the team
            </Button>
          </SignUpButton>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2EA3F2]" />
            Joshua Tree Inc — SWFL Sales
          </div>
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-7xl">
            Stack deals.
            <span className="block bg-gradient-to-r from-[#2EA3F2] via-[#56cdfb] to-[#2EA3F2] bg-clip-text text-transparent">
              Cash the points.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            The internal hub for Joshua Tree reps. Track every job, climb the
            board, and trade points for gear, tickets, and trips.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <SignInButton mode="modal">
              <Button
                size="lg"
                className="rounded-lg bg-[#2EA3F2] px-6 font-semibold text-slate-950 shadow-lg shadow-[#2EA3F2]/20 hover:bg-[#48b3f6]"
              >
                Sign in
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button
                size="lg"
                variant="outline"
                className="rounded-lg border-border px-6 font-semibold"
              >
                Create account
              </Button>
            </SignUpButton>
          </div>

          {/* Stat strip */}
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {[
              { k: "Live", v: "Leaderboard" },
              { k: "$10k+", v: "Top tier prize" },
              { k: "24/7", v: "Pin to win" },
            ].map((s) => (
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
        </div>

        <div className="mt-20 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Trophy, color: "#FFBF00", title: "Leaderboard", body: "Live rankings, badges, tier cutoffs." },
            { icon: MapPin, color: "#2EA3F2", title: "Canvas Map", body: "Drop pins, work streets, win blocks." },
            { icon: Gift, color: "#2C8214", title: "Vault", body: "Trade points for gear, tools, trips." },
            { icon: Zap, color: "#FFBF00", title: "Hype Feed", body: "Wins, high-fives, comments." },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-xl border border-border bg-card p-5 transition hover:border-[#2EA3F2]/40 hover:shadow-[0_0_0_1px_rgba(46,163,242,0.15),0_12px_32px_-16px_rgba(46,163,242,0.45)]"
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
    </div>
  );
}
