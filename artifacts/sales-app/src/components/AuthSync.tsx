import { useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import {
  useCreateUser,
  getGetMeQueryKey,
  getListBadgesQueryKey,
  getMe,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";

const SYNC_KEY_PREFIX = "jt:user-synced:";

function alreadySynced(clerkId: string): boolean {
  try {
    return sessionStorage.getItem(SYNC_KEY_PREFIX + clerkId) === "1";
  } catch {
    return false;
  }
}

function markSynced(clerkId: string): void {
  try {
    sessionStorage.setItem(SYNC_KEY_PREFIX + clerkId, "1");
  } catch {
    /* ignore */
  }
}

function clearSynced(clerkId: string): void {
  try {
    sessionStorage.removeItem(SYNC_KEY_PREFIX + clerkId);
  } catch {
    /* ignore */
  }
}

export function AuthSync() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { mutateAsync } = useCreateUser();
  const qc = useQueryClient();
  const synced = useRef<string | null>(null);

  // Fire POST /users immediately on first sign-in, in parallel with whatever
  // queries the rest of the app is firing (notably getMe in AppShell). On
  // warm boots we skip entirely so there's nothing to flash on second paint.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (synced.current === user.id) return;
    if (alreadySynced(user.id)) {
      synced.current = user.id;
      return;
    }
    synced.current = user.id;
    mutateAsync({
      data: {
        clerkId: user.id,
        name:
          user.fullName ||
          user.firstName ||
          user.username ||
          user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
          "Sales Rep",
        email:
          user.primaryEmailAddress?.emailAddress ??
          user.emailAddresses?.[0]?.emailAddress ??
          `${user.id}@no-email.local`,
        avatarUrl: user.imageUrl ?? null,
      },
    })
      .then(() => {
        markSynced(user.id);
        // Targeted invalidation only — avoids the "everything reloads" flash
        // that comes from invalidating the entire cache.
        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        qc.invalidateQueries({ queryKey: getListBadgesQueryKey() });
      })
      .catch(() => {
        synced.current = null;
      });
  }, [isLoaded, isSignedIn, user, mutateAsync, qc]);

  // Separately, observe the existing getMe query (deduped — does not fire a
  // second request). If it errors AND we previously thought we'd synced this
  // session, clear the flag so the next render can re-create the user. This
  // keeps recovery logic OFF the critical path of first-login.
  const probe = useQuery({
    queryKey: getGetMeQueryKey(),
    queryFn: getMe,
    enabled: !!isSignedIn && !!user,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user) return;
    if (!probe.isError) return;
    if (alreadySynced(user.id)) {
      clearSynced(user.id);
      synced.current = null;
    }
  }, [user, probe.isError]);

  return null;
}
