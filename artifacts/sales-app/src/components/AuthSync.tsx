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

  // Probe getMe so we can self-heal a stale sessionStorage flag (e.g. backend
  // was reset, DB reseeded, or sessionStorage outlived the server's record).
  // If the probe fails with "not registered", we clear the flag and force
  // the create flow to run again below.
  const probe = useQuery({
    queryKey: getGetMeQueryKey(),
    queryFn: getMe,
    enabled: !!isSignedIn && !!user,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (synced.current === user.id) return;

    // If a previous session said we synced, but the server now says we are
    // not registered (probe error), drop the flag so we re-create below.
    if (alreadySynced(user.id) && probe.isError) {
      clearSynced(user.id);
    }

    if (alreadySynced(user.id)) {
      synced.current = user.id;
      return;
    }

    // Don't fire create until we have a definitive probe answer (success or
    // error). This prevents racing against the first getMe roundtrip.
    if (probe.isLoading) return;

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
        // Only invalidate user-derived queries instead of nuking the entire
        // cache. This avoids the "everything reloads after first paint" flash.
        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        qc.invalidateQueries({ queryKey: getListBadgesQueryKey() });
      })
      .catch(() => {
        // Allow another attempt on the next render; useQuery's probe will
        // re-run on focus/remount and trigger this effect again.
        synced.current = null;
      });
  }, [
    isLoaded,
    isSignedIn,
    user,
    mutateAsync,
    qc,
    probe.isLoading,
    probe.isError,
  ]);

  return null;
}
