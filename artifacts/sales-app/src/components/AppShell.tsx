import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
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
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: me } = useGetMe();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = me?.role === "admin";

  const Sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center justify-center border-b border-sidebar-border px-5 py-5">
        <Logo className="h-10" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[#2EA3F2] text-white shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              location.startsWith("/admin")
                ? "bg-[#FFBF00] text-slate-900 shadow-sm"
                : "text-sidebar-foreground hover:bg-sidebar-accent",
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span>Admin Panel</span>
          </Link>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-2">
        <Link
          href="/profile"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-sidebar-accent"
        >
          <div
            className="rounded-full p-[2px]"
            style={{ background: me?.accentColor || "#2C8214" }}
          >
            <Avatar className="h-9 w-9 ring-2 ring-white">
              <AvatarImage src={me?.avatarUrl ?? user?.imageUrl} />
              <AvatarFallback
                className="text-white font-bold"
                style={{ background: me?.accentColor || "#2C8214" }}
              >
                {(me?.name || user?.firstName || "R").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {me?.name || user?.fullName || "Sales Rep"}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {me?.totalPoints ?? 0} pts
              {isAdmin && <span className="ml-1 text-[#FFBF00] font-bold">• Admin</span>}
            </div>
          </div>
          <UserCircle className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 rounded-xl"
          onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
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
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">{Sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
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
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          className="fixed right-4 top-4 z-50 rounded-full bg-white p-2 shadow-lg lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
