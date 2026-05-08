import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk, useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Trophy,
  MessageSquareHeart,
  Map as MapIcon,
  Gift,
  GraduationCap,
  Briefcase,
  Settings,
  LogOut,
  Menu,
  X,
  UserCircle,
  Volume2,
  VolumeX,
  Flame,
  Bot,
} from "lucide-react";
import { isSoundEnabled, onSoundChanged, setSoundEnabled } from "@/lib/sound";
import {
  getGetMeQueryOptions,
  getGetMeQueryKey,
  getGetLeaderboardQueryKey,
  getGetLeaderboardSummaryQueryKey,
  getListFeedPostsQueryKey,
  getListPinsQueryKey,
  getListTerritoriesQueryKey,
  getListRewardsQueryKey,
  getListBadgesQueryKey,
  getListIncentiveTiersQueryKey,
  getMe,
  getLeaderboard,
  getLeaderboardSummary,
  listFeedPosts,
  listPins,
  listTerritories,
  listRewards,
  listBadges,
  listIncentiveTiers,
  listTrainingResources,
  listDeals,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { BADGES_ME_QUERY_KEY, fetchBadgesMe } from "@/lib/badgesMe";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { photoServingUrl } from "@/components/PhotoUpload";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/feed", label: "Hype Feed", icon: MessageSquareHeart },
  { href: "/map", label: "Canvassing Map", icon: MapIcon },
  { href: "/deals", label: "My Deals", icon: Briefcase },
  { href: "/rewards", label: "Incentive Vault", icon: Gift },
  { href: "/training", label: "Training Vault", icon: GraduationCap },
  { href: "/coach", label: "Sales Coach", icon: Bot },
];

// Map of route → query prefetchers. Fired on hover so navigating to a tab
// renders with cached data instead of an empty skeleton.
type Prefetcher = () => Array<{ queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }>;
const PREFETCHERS: Record<string, Prefetcher> = {
  "/dashboard": () => [
    { queryKey: getGetMeQueryKey(), queryFn: () => getMe() },
    { queryKey: getGetLeaderboardSummaryQueryKey(), queryFn: () => getLeaderboardSummary() },
    { queryKey: getListIncentiveTiersQueryKey(), queryFn: () => listIncentiveTiers() },
    { queryKey: BADGES_ME_QUERY_KEY, queryFn: fetchBadgesMe },
  ],
  "/leaderboard": () => [
    { queryKey: getGetLeaderboardQueryKey(), queryFn: () => getLeaderboard() },
  ],
  "/feed": () => [
    { queryKey: getListFeedPostsQueryKey(), queryFn: () => listFeedPosts() },
  ],
  "/map": () => [
    { queryKey: getListPinsQueryKey(), queryFn: () => listPins() },
    { queryKey: getListTerritoriesQueryKey(), queryFn: () => listTerritories() },
  ],
  "/deals": () => [
    { queryKey: ["/api/deals"] as const, queryFn: () => listDeals() },
  ],
  "/rewards": () => [
    { queryKey: getListRewardsQueryKey(), queryFn: () => listRewards() },
  ],
  "/training": () => [
    { queryKey: ["/api/training"] as const, queryFn: () => listTrainingResources() },
  ],
  "/profile": () => [
    // Profile mostly reuses cached data (getMe, leaderboard, feed, pins)
    // populated by other tabs. Pre-warming again here makes a cold profile
    // hop instant when those caches haven't been touched yet.
    { queryKey: getGetMeQueryKey(), queryFn: () => getMe() },
    { queryKey: getGetLeaderboardQueryKey(), queryFn: () => getLeaderboard() },
    { queryKey: getListFeedPostsQueryKey(), queryFn: () => listFeedPosts() },
    { queryKey: getListPinsQueryKey(), queryFn: () => listPins() },
  ],
};

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isLoaded, isSignedIn } = useAuth();
  const authReady = isLoaded && !!isSignedIn;
  const qc = useQueryClient();
  // Gate on auth-ready so AppShell doesn't fire unauthenticated requests that
  // immediately 401 and force a re-fetch once Clerk resolves.
  const { data: me } = useQuery({ ...getGetMeQueryOptions(), enabled: authReady });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  useEffect(() => onSoundChanged(setSoundOn), []);

  const isAdmin = me?.role === "admin";

  const prefetchedRef = useMemo(() => new Set<string>(), []);
  const prefetchRoute = (href: string) => {
    // Don't prefetch until auth is ready — prefetching without a token would
    // write 401 errors into the cache and cause flashes on subsequent renders.
    if (!authReady) return;
    if (prefetchedRef.has(href)) return;
    const make = PREFETCHERS[href];
    if (!make) return;
    prefetchedRef.add(href);
    for (const { queryKey, queryFn } of make()) {
      qc.prefetchQuery({ queryKey, queryFn, staleTime: 60_000 }).catch(() => {
        prefetchedRef.delete(href);
      });
    }
  };

  // Pre-warm the cache for the most likely first hop (Dashboard's badges).
  // Uses the same /badges/me key Dashboard consumes — no redundant fetch.
  // Guard on authReady so we don't fire an unauthenticated prefetch that would
  // 401 and write an error into the cache before me?.id even resolves.
  useEffect(() => {
    if (!authReady || !me?.id) return;
    qc.prefetchQuery({
      queryKey: BADGES_ME_QUERY_KEY,
      queryFn: fetchBadgesMe,
      staleTime: 60_000,
    }).catch(() => {});
  }, [authReady, me?.id, qc]);

  const NavItem = ({
    href,
    label,
    Icon,
    active,
    accentColor = "#2EA3F2",
  }: {
    href: string;
    label: string;
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    active: boolean;
    accentColor?: string;
  }) => (
    <Link
      href={href}
      onClick={() => setMobileOpen(false)}
      onMouseEnter={() => prefetchRoute(href)}
      onFocus={() => prefetchRoute(href)}
      onTouchStart={() => prefetchRoute(href)}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
          style={{ background: accentColor }}
        />
      )}
      <Icon
        className={cn("h-[18px] w-[18px] shrink-0")}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span className="truncate">{label}</span>
    </Link>
  );

  const Sidebar = (
    <aside className="flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
        <Logo className="h-8" />
        <div className="ml-auto flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[#2EA3F2]"
            aria-hidden
          />
          SWFL
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Workspace
        </div>
        {NAV_ITEMS.map((item) => {
          const active =
            location === item.href || location.startsWith(item.href + "/");
          return (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.icon}
              active={active}
            />
          );
        })}
        {isAdmin && (
          <>
            <div className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Admin
            </div>
            <NavItem
              href="/admin"
              label="Admin Panel"
              Icon={Settings}
              active={location.startsWith("/admin")}
              accentColor="#FFBF00"
            />
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-2 space-y-1.5">
        <Link
          href="/profile"
          onClick={() => setMobileOpen(false)}
          onMouseEnter={() => prefetchRoute("/profile")}
          onFocus={() => prefetchRoute("/profile")}
          onTouchStart={() => prefetchRoute("/profile")}
          className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-sidebar-accent"
        >
          <div
            className="rounded-full p-[1.5px]"
            style={{ background: me?.accentColor || "#2EA3F2" }}
          >
            <Avatar className="h-8 w-8 ring-1 ring-background">
              <AvatarImage
                src={
                  me?.avatarUrl
                    ? photoServingUrl(me.avatarUrl) ?? me.avatarUrl
                    : user?.imageUrl
                }
              />
              <AvatarFallback
                className="text-white text-xs font-bold"
                style={{ background: me?.accentColor || "#2EA3F2" }}
              >
                {(me?.name || user?.firstName || "R").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-foreground">
                {me?.name || user?.fullName || "Sales Rep"}
              </span>
              {me?.level != null && (
                <span className="font-stat rounded border border-border bg-background/60 px-1 text-[9px] font-bold text-[#2EA3F2]">
                  L{me.level}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="font-stat">
                {(me?.totalPoints ?? 0).toLocaleString()} pts
              </span>
              {me?.currentStreak ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-bold",
                    me.streakAtRisk ? "text-[#FFBF00]" : "text-[#2C8214]",
                  )}
                >
                  <Flame className="h-2.5 w-2.5" />
                  {me.currentStreak}
                </span>
              ) : null}
              {isAdmin && <span className="text-[#FFBF00] font-bold">• Admin</span>}
            </div>
          </div>
          <UserCircle className="h-4 w-4 text-muted-foreground" />
        </Link>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 justify-start gap-2 rounded-lg text-xs"
            onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
          <Button
            variant="outline"
            size="sm"
            title={soundOn ? "Mute celebrations" : "Enable celebrations"}
            className="h-8 w-8 rounded-lg p-0"
            onClick={() => setSoundEnabled(!soundOn)}
          >
            {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">{Sidebar}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">{Sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo className="h-7" />
          <div className="w-9" />
        </header>
        <main key={location} className="min-w-0 flex-1 jt-route-fade">{children}</main>
      </div>

      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          className="fixed right-4 top-4 z-50 rounded-full border border-border bg-card p-2 text-foreground shadow-lg lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
