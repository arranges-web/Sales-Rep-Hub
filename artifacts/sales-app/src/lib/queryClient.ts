import { QueryClient } from "@tanstack/react-query";
import {
  getListRewardsQueryKey,
  getListIncentiveTiersQueryKey,
} from "@workspace/api-client-react";

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

// Catalog-style data (rewards, incentive tiers, badge catalog, training)
// changes rarely — admin edits only. Holding it fresh for 5 minutes makes
// page navigation effectively instant for these slow-moving lists.
const CATALOG_STALE_MS = 5 * 60_000;
queryClient.setQueryDefaults(getListRewardsQueryKey(), { staleTime: CATALOG_STALE_MS });
queryClient.setQueryDefaults(getListIncentiveTiersQueryKey(), { staleTime: CATALOG_STALE_MS });
queryClient.setQueryDefaults(["/api/training"], { staleTime: CATALOG_STALE_MS });
