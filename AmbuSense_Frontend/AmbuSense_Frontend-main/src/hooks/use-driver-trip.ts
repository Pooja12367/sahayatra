"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
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
      try {
        const { data } = await api.get<EmergencyRequest>("/driver/my-trip");
        return data;
      } catch (error) {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 404
        ) {
          return null;
        }

        throw error;
      }
    },
    // Poll every 5s as a safety net in case a socket event is missed
    refetchInterval: 5000,
  });
}

export function useUpdateDriverTripStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateEmergencyRequestStatusPayload) => {
      const { data } = await api.patch<EmergencyRequest>(
        "/driver/my-trip/status",
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverTripKeys.all });
    },
  });
}

export function useRejectDriverTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.patch<{ message: string }>(
        "/driver/my-trip/reject",
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverTripKeys.all });
      queryClient.invalidateQueries({ queryKey: ["driver", "my-ambulance"] });
    },
  });
}
