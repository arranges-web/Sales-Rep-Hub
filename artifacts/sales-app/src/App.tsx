import {
  Switch,
  Route,
  Redirect,
  Router as WouterRouter,
} from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import LandingPage from "@/pages/Landing";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import LeaderboardPage from "@/pages/Leaderboard";
import HypeFeedPage from "@/pages/HypeFeed";
import MapPage from "@/pages/Map";
import RewardsPage from "@/pages/Rewards";
import TrainingPage from "@/pages/Training";
import SalesCoachPage from "@/pages/SalesCoach";
import MessagesPage from "@/pages/Messages";
import OpportunitiesPage from "@/pages/Opportunities";
import CampaignsPage from "@/pages/Campaigns";
import DealsPage from "@/pages/Deals";
import ProfilePage from "@/pages/Profile";
import AdminPage from "@/pages/Admin";
import { useGetMe } from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <LandingPage />;
}

function LoginRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <LoginPage />;
}

function Protected({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect to="/login" />;
  if (adminOnly) return <AdminGuard>{children}</AdminGuard>;
  return <AppShell>{children}</AppShell>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useGetMe();
  if (isLoading) return <AppShell>{null}</AppShell>;
  if (!me || me.role !== "admin") return <Redirect to="/dashboard" />;
  return <AppShell>{children}</AppShell>;
}

function Routes() {
  return (
    <TooltipProvider>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/login" component={LoginRoute} />
        {/* Legacy Clerk routes now just land on the simple login screen. */}
        <Route path="/sign-in/*?" component={LoginRoute} />
        <Route path="/sign-up/*?" component={LoginRoute} />
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
        <Route path="/campaigns">
          <Protected><CampaignsPage /></Protected>
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
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Routes />
        </AuthProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
