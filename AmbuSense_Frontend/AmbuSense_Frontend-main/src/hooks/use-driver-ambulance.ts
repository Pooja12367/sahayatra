"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { api } from "@/lib/api";
import type { Ambulance, AmbulanceStatus } from "@/types/ambulances";

export const driverAmbulanceKeys = {
  myAmbulance: ["driver", "my-ambulance"] as const,
};

export function useDriverAmbulance(enabled = true) {
  return useQuery({
    enabled,
    queryKey: driverAmbulanceKeys.myAmbulance,
    queryFn: async () => {
      try {
        const { data } = await api.get<Ambulance>("/ambulances/my-ambulance");
        return data;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    // Poll every 5s as a safety net in case a socket event is missed
    refetchInterval: 5000,
  });
}

export function useUpdateAmbulanceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ambulanceId,
      status,
    }: {
      ambulanceId: string;
      status: AmbulanceStatus;
    }) => {
      const { data } = await api.patch<Ambulance>(
        `/ambulances/${ambulanceId}/status`,
        { status },
      );
      return data;
    },
    onSuccess: async (savedAmbulance) => {
      queryClient.setQueryData(
        driverAmbulanceKeys.myAmbulance,
        savedAmbulance,
      );
      queryClient.invalidateQueries({
        queryKey: driverAmbulanceKeys.myAmbulance,
      });
    },
  });
}
