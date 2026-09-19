"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FullTripRoute } from "@/types/routes";

export const tripRouteKeys = {
  all: ["trip-route"] as const,
  full: (requestId: string) => ["trip-route", "full", requestId] as const,
};

export function useFullTripRoute(requestId: string, enabled = true) {
  return useQuery({
    enabled: enabled && Boolean(requestId),
    queryKey: tripRouteKeys.full(requestId),
    queryFn: async () => {
      const { data } = await api.get<FullTripRoute>(
        `/routes/request/${requestId}/full`,
      );
      return data;
    },
  });
}
