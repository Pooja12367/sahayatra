"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  EmergencyRequest,
  UpdateEmergencyRequestStatusPayload,
} from "@/types/emergency-requests";

export const driverTripKeys = {
  all: ["driver", "my-trip"] as const,
};

export function useDriverMyTrip(enabled = true) {
  return useQuery({
    enabled,
    queryKey: driverTripKeys.all,
    queryFn: async () => {
      const { data } = await api.get<EmergencyRequest[]>("/driver/my-trip");
      return data;
    },
    // Poll every 5s as a safety net in case a socket event is missed
    refetchInterval: 5000,
  });
}

export function useUpdateDriverTripStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: UpdateEmergencyRequestStatusPayload & { requestId: string },
    ) => {
      const { data } = await api.patch<EmergencyRequest>(
        `/driver/my-trip/${encodeURIComponent(payload.requestId)}/status`,
        { status: payload.status },
      );
      return data;
    },
    onSuccess: (updatedTrip) => {
      const updatedTripId = updatedTrip.id ?? updatedTrip._id;
      queryClient.setQueryData<EmergencyRequest[]>(
        driverTripKeys.all,
        (trips = []) => {
          if (
            updatedTrip.status === "completed" ||
            updatedTrip.status === "cancelled"
          ) {
            return trips.filter(
              (trip) => (trip.id ?? trip._id) !== updatedTripId,
            );
          }

          const hasTrip = trips.some(
            (trip) => (trip.id ?? trip._id) === updatedTripId,
          );
          return hasTrip
            ? trips.map((trip) =>
                (trip.id ?? trip._id) === updatedTripId ? updatedTrip : trip,
              )
            : [...trips, updatedTrip];
        },
      );
      return queryClient.invalidateQueries({ queryKey: driverTripKeys.all });
    },
  });
}

export function useRejectDriverTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data } = await api.patch<{ message: string }>(
        `/driver/my-trip/${encodeURIComponent(requestId)}/reject`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverTripKeys.all });
      queryClient.invalidateQueries({ queryKey: ["driver", "my-ambulance"] });
    },
  });
}
