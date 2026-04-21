import { useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useCreateUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function AuthSync() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { mutateAsync } = useCreateUser();
  const qc = useQueryClient();
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (synced.current === user.id) return;
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
      .then(() => qc.invalidateQueries())
      .catch(() => {
        synced.current = null;
      });
  }, [isLoaded, isSignedIn, user, mutateAsync, qc]);

  return null;
}
