"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Hospital,
  HospitalFilters,
  HospitalFormPayload,
  PaginatedHospitalsResponse,
  UpdateHospitalPayload,
} from "@/types/hospitals";

export const hospitalKeys = {
  all: ["hospitals"] as const,
  list: (filters: HospitalFilters) => ["hospitals", filters] as const,
};

export function getHospitalId(hospital: Hospital) {
  return hospital.id ?? hospital._id ?? "";
}

export function useHospitals(filters: HospitalFilters = {}) {
  return useQuery({
    queryKey: hospitalKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<PaginatedHospitalsResponse>(
        "/hospitals",
        {
          params: filters,
        },
      );
      return data;
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

export function useCreateHospital() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: HospitalFormPayload) => {
      const { data } = await api.post<Hospital>("/hospitals", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hospitalKeys.all });
    },
  });
}

export function useUpdateHospital() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      hospitalId,
      payload,
    }: {
      hospitalId: string;
      payload: UpdateHospitalPayload;
    }) => {
      const { data } = await api.patch<Hospital>(
        `/hospitals/${hospitalId}`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hospitalKeys.all });
    },
  });
}

export function useDeleteHospital() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (hospitalId: string) => {
      const { data } = await api.delete<{ message: string }>(
        `/hospitals/${hospitalId}`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hospitalKeys.all });
    },
  });
}
