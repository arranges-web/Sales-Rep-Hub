import { SignInButton, SignUpButton } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Trophy, MapPin, Gift, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-sky-50 via-white to-emerald-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2EA3F2] text-white font-extrabold shadow-md">
            JT
          </div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold text-[#2C8214]">JOSHUA</div>
            <div className="text-sm font-extrabold text-[#2EA3F2]">TREE</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SignInButton mode="modal">
            <Button variant="ghost" className="rounded-xl">Sign in</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button className="rounded-xl bg-[#2EA3F2] text-white hover:bg-[#1d8fd8]">
              Join the team
            </Button>
          </SignUpButton>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FFBF00]/20 px-4 py-1.5 text-xs font-semibold text-[#7a5a00]">
            <Zap className="h-3.5 w-3.5" />
            SWFL Sales Team Hub
          </div>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Close more deals.
            <span className="block bg-gradient-to-r from-[#2EA3F2] to-[#2C8214] bg-clip-text text-transparent">
              Earn your way to paradise.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            The internal sales hub for Joshua Tree reps — track deals, climb the
            leaderboard, drop pins on the canvassing map, and rack up points
            toward the Hawaii trip.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <SignInButton mode="modal">
              <Button size="lg" className="rounded-xl bg-[#2EA3F2] text-white hover:bg-[#1d8fd8] shadow-lg">
                Sign in to continue
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="lg" variant="outline" className="rounded-xl border-2">
                Create account
              </Button>
            </SignUpButton>
          </div>
        </div>

        <div className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Trophy, color: "#FFBF00", title: "Leaderboard", body: "Live rankings, badges, and tiers." },
            { icon: MapPin, color: "#2EA3F2", title: "Canvassing Map", body: "Drop pins, track territory, win streets." },
            { icon: Gift, color: "#2C8214", title: "Incentive Vault", body: "Trade points for gear, PTO, and trips." },
            { icon: Zap, color: "#FFBF00", title: "Hype Feed", body: "Bot-posted wins, high-fives, comments." },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: f.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold text-slate-900">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.body}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
