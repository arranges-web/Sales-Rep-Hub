import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/react";
import {
  useCreateUser,
  getGetMeQueryKey,
  getListBadgesQueryKey,
  getMe,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { BADGES_ME_QUERY_KEY } from "@/lib/badgesMe";

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
  // Bumped by the recovery effect after we clear a stale sessionStorage
  // flag. Adding it to the deps of the create effect guarantees that
  // recovery deterministically retriggers a sync attempt on the next
  // render, instead of waiting for some other prop to change.
  const [retryTick, setRetryTick] = useState(0);

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
        // Targeted invalidation for the keys we KNOW changed (me/badges).
        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        qc.invalidateQueries({ queryKey: getListBadgesQueryKey() });
        qc.invalidateQueries({ queryKey: BADGES_ME_QUERY_KEY });
        // Plus: rescue any protected queries that fired BEFORE this create
        // resolved and got a 401 "User not registered". Only refetches the
        // ones currently in error state, so warm boots (no error queries)
        // don't trigger a second-paint flash. This is the "first-login
        // recovery path" — without it, the dashboard can sit in error/empty
        // state until the user manually refreshes.
        qc.refetchQueries({
          type: "all",
          predicate: (q) => q.state.status === "error",
        });
      })
      .catch(() => {
        synced.current = null;
      });
  }, [isLoaded, isSignedIn, user, mutateAsync, qc, retryTick]);

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
      // Force the create effect to re-run on the next render so recovery
      // is deterministic, not a "wait for some other prop to change."
      setRetryTick((t) => t + 1);
    }
  }, [user, probe.isError]);

  return null;
}
