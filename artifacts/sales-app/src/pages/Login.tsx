import { useEffect, useState } from "react";
import { useGetAuthConfig } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Loader2, ArrowRight } from "lucide-react";

/**
 * The whole sign-in flow: type your name, and the team password if the admin
 * set one. No accounts to create, no email, no Google.
 */
export default function LoginPage() {
  const { signIn } = useAuth();
  const { data: config, isLoading: configLoading } = useGetAuthConfig();
  const passwordRequired = config?.teamPasswordRequired ?? false;

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Prefill the last name used so returning reps don't retype it.
    try {
      const last = localStorage.getItem("jt:last-name");
      if (last) setName(last);
    } catch {
      /* ignore */
    }
  }, []);

  const canSubmit = name.trim().length > 0 && (!passwordRequired || password.length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(name, passwordRequired ? password : undefined);
      try {
        localStorage.setItem("jt:last-name", name.trim());
      } catch {
        /* ignore */
      }
      // AuthProvider flips isSignedIn; the router redirects to /dashboard.
    } catch (err) {
      const message =
        err && typeof err === "object" && "data" in err
          ? ((err as { data?: { error?: string } }).data?.error ?? null)
          : null;
      setError(message ?? "Couldn't sign in. Check your name and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 jt-grid-bg opacity-50" />
      <div className="pointer-events-none absolute -left-40 top-10 z-0 h-[28rem] w-[28rem] rounded-full bg-[#3DA935]/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 z-0 h-[26rem] w-[26rem] rounded-full bg-[#FFBF00]/10 blur-[120px]" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card/80 p-7 shadow-2xl backdrop-blur-sm"
      >
        <div className="flex flex-col items-center text-center">
          <Logo className="h-12 w-auto" />
          <h1 className="mt-5 text-xl font-extrabold tracking-tight">
            Welcome to the Hub
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Type your name to jump in.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marcus R."
              autoComplete="name"
              autoFocus
              className="mt-1 rounded-lg"
            />
          </div>

          {!configLoading && passwordRequired && (
            <div>
              <Label htmlFor="team-password">Team password</Label>
              <Input
                id="team-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ask your manager"
                autoComplete="off"
                className="mt-1 rounded-lg"
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={!canSubmit || submitting}
            className="w-full rounded-lg bg-[#3DA935] font-semibold text-slate-950 hover:bg-[#4FBF45]"
          >
            {submitting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-1.5 h-4 w-4" />
            )}
            Enter the Hub
          </Button>
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          Joshua Tree Inc. — internal use only.
        </p>
      </form>
    </div>
  );
}
