import { useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useClerk,
} from "@clerk/react";
import { shadcn } from "@clerk/themes";
import {
  Switch,
  Route,
  Redirect,
  useLocation,
  Router as WouterRouter,
} from "wouter";
import {
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthSync } from "@/components/AuthSync";
import { AppShell } from "@/components/AppShell";
import LandingPage from "@/pages/Landing";
import DashboardPage from "@/pages/Dashboard";
import LeaderboardPage from "@/pages/Leaderboard";
import HypeFeedPage from "@/pages/HypeFeed";
import MapPage from "@/pages/Map";
import RewardsPage from "@/pages/Rewards";
import TrainingPage from "@/pages/Training";
import DealsPage from "@/pages/Deals";
import AdminPage from "@/pages/Admin";
import NotFound from "@/pages/not-found";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl:
      typeof window !== "undefined"
        ? `${window.location.origin}${basePath}/logo.svg`
        : "",
  },
  variables: {
    colorPrimary: "#2EA3F2",
    colorForeground: "#1f2937",
    colorMutedForeground: "#6b7280",
    colorDanger: "#ef4444",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#1f2937",
    colorNeutral: "#e5e7eb",
    colorModalBackdrop: "rgba(15, 23, 42, 0.55)",
    fontFamily: "'Open Sans', system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox:
      "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-slate-900 font-bold text-2xl",
    headerSubtitle: "text-slate-600",
    socialButtonsBlockButtonText: "text-slate-800 font-medium",
    formFieldLabel: "text-slate-700 font-medium",
    footerActionLink: "text-[#2EA3F2] font-semibold hover:underline",
    footerActionText: "text-slate-600",
    dividerText: "text-slate-500",
    identityPreviewEditButton: "text-[#2EA3F2]",
    formFieldSuccessText: "text-emerald-600",
    alertText: "text-slate-800",
    logoBox: "justify-center mb-4",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton:
      "border border-slate-200 hover:bg-slate-50 rounded-lg",
    formButtonPrimary:
      "bg-[#2EA3F2] hover:bg-[#1d8fd8] text-white font-semibold rounded-lg",
    formFieldInput:
      "border border-slate-200 rounded-lg focus:border-[#2EA3F2] focus:ring-2 focus:ring-[#2EA3F2]/20",
    footerAction: "text-center",
    dividerLine: "bg-slate-200",
    alert: "rounded-lg",
    otpCodeFieldInput: "border-slate-200",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <AppShell>{children}</AppShell>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    return addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prev.current !== undefined && prev.current !== id) qc.clear();
      prev.current = id;
    });
  }, [addListener, qc]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <AuthSync />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/dashboard">
              <Protected><DashboardPage /></Protected>
            </Route>
            <Route path="/leaderboard">
              <Protected><LeaderboardPage /></Protected>
            </Route>
            <Route path="/feed">
              <Protected><HypeFeedPage /></Protected>
            </Route>
            <Route path="/map">
              <Protected><MapPage /></Protected>
            </Route>
            <Route path="/rewards">
              <Protected><RewardsPage /></Protected>
            </Route>
            <Route path="/training">
              <Protected><TrainingPage /></Protected>
            </Route>
            <Route path="/deals">
              <Protected><DealsPage /></Protected>
            </Route>
            <Route path="/admin/:tab?">
              <Protected><AdminPage /></Protected>
            </Route>
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
