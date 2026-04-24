import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // Keep most data fresh for a minute so navigating between pages
      // doesn't trigger a flash of skeleton + refetch on every hop.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    },
  },
});
