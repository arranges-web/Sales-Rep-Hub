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
import SalesCoachPage from "@/pages/SalesCoach";
import MessagesPage from "@/pages/Messages";
import OpportunitiesPage from "@/pages/Opportunities";
import DealsPage from "@/pages/Deals";
import ProfilePage from "@/pages/Profile";
import AdminPage from "@/pages/Admin";
import { useGetMe } from "@workspace/api-client-react";
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
    colorForeground: "#f3f4f6",
    colorMutedForeground: "#9ca3af",
    colorDanger: "#f87171",
    colorBackground: "#0c1219",
    colorInput: "#141a23",
    colorInputForeground: "#f3f4f6",
    colorNeutral: "#1f2630",
    colorModalBackdrop: "rgba(0, 0, 0, 0.75)",
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: "0.625rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox:
      "bg-[#0c1219] border border-[#1f2630] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-[#0a0f15] !rounded-none border-t border-[#1f2630]",
    headerTitle: "text-slate-50 font-bold text-2xl tracking-tight",
    headerSubtitle: "text-slate-400",
    socialButtonsBlockButtonText: "text-slate-100 font-medium",
    formFieldLabel: "text-slate-300 font-medium",
    footerActionLink: "text-[#2EA3F2] font-semibold hover:underline",
    footerActionText: "text-slate-400",
    dividerText: "text-slate-500",
    identityPreviewEditButton: "text-[#2EA3F2]",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-slate-200",
    logoBox: "justify-center mb-4",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton:
      "border border-[#1f2630] bg-[#141a23] hover:bg-[#1a2230] text-slate-100 rounded-lg",
    formButtonPrimary:
      "bg-[#2EA3F2] hover:bg-[#48b3f6] text-slate-950 font-semibold rounded-lg shadow-lg shadow-[#2EA3F2]/20",
    formFieldInput:
      "border border-[#1f2630] bg-[#141a23] text-slate-100 rounded-lg focus:border-[#2EA3F2] focus:ring-2 focus:ring-[#2EA3F2]/25",
    footerAction: "text-center",
    dividerLine: "bg-[#1f2630]",
    alert: "rounded-lg bg-[#141a23] border border-[#1f2630]",
    otpCodeFieldInput: "border-[#1f2630] bg-[#141a23] text-slate-100",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 jt-grid-bg opacity-50" />
      <div className="pointer-events-none absolute -left-40 top-10 z-0 h-[28rem] w-[28rem] rounded-full bg-[#2EA3F2]/15 blur-[120px]" />
      <div className="relative">
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
        />
      </div>
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 jt-grid-bg opacity-50" />
      <div className="pointer-events-none absolute -right-40 top-10 z-0 h-[28rem] w-[28rem] rounded-full bg-[#2C8214]/12 blur-[120px]" />
      <div className="relative">
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
        />
      </div>
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

function Protected({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  return (
    <>
      <Show when="signed-in">
        {adminOnly ? <AdminGuard>{children}</AdminGuard> : <AppShell>{children}</AppShell>}
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useGetMe();
  if (isLoading) return <AppShell>{null}</AppShell>;
  if (!me || me.role !== "admin") return <Redirect to="/dashboard" />;
  return <AppShell>{children}</AppShell>;
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
            <Route path="/opportunities">
              <Protected><OpportunitiesPage /></Protected>
            </Route>
            <Route path="/rewards">
              <Protected><RewardsPage /></Protected>
            </Route>
            <Route path="/training">
              <Protected><TrainingPage /></Protected>
            </Route>
            <Route path="/coach">
              <Protected><SalesCoachPage /></Protected>
            </Route>
            <Route path="/messages">
              <Protected><MessagesPage /></Protected>
            </Route>
            <Route path="/deals">
              <Protected><DealsPage /></Protected>
            </Route>
            <Route path="/profile">
              <Protected><ProfilePage /></Protected>
            </Route>
            <Route path="/admin/:tab?">
              <Protected adminOnly><AdminPage /></Protected>
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
