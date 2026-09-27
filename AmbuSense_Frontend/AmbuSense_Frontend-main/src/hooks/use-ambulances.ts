"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Ambulance,
  AmbulanceFilters,
  AmbulanceFormPayload,
  AmbulanceStatus,
  PaginatedAmbulancesResponse,
  UpdateAmbulancePayload,
} from "@/types/ambulances";

const ambulanceKeys = {
  all: ["ambulances"] as const,
  list: (filters: AmbulanceFilters) => ["ambulances", filters] as const,
};

export function getAmbulanceId(ambulance: Ambulance) {
  return ambulance.id ?? ambulance._id ?? "";
}

export function useAmbulances(filters: AmbulanceFilters = {}) {
  return useQuery({
    queryKey: ambulanceKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<PaginatedAmbulancesResponse>(
        "/ambulances",
        {
          params: filters,
        },
      );
      return data;
    },
  });
}

export function useCreateAmbulance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AmbulanceFormPayload) => {
      const { data } = await api.post<Ambulance>("/ambulances", payload);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ambulanceKeys.all }),
  });
}

export function useUpdateAmbulance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ambulanceId,
      payload,
    }: {
      ambulanceId: string;
      payload: UpdateAmbulancePayload;
    }) => {
      await api.patch<Ambulance>(
        `/ambulances/${ambulanceId}`,
        payload,
      );
      const { data } = await api.get<Ambulance>(
        `/ambulances/${ambulanceId}`,
      );
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ambulanceKeys.all }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ambulanceKeys.all });
    },
  });
}

export function useDeleteAmbulance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ambulanceId: string) => {
      const { data } = await api.delete<{ message: string }>(
        `/ambulances/${ambulanceId}`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ambulanceKeys.all });
    },
  });
}
