"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CancelEmergencyRequestPayload,
  DispatchEmergencyRequestPayload,
  EmergencyRequest,
  EmergencyRequestFilters,
  UpdateEmergencyRequestStatusPayload,
} from "@/types/emergency-requests";

const emergencyRequestKeys = {
  all: ["emergency-requests"] as const,
  list: (filters: EmergencyRequestFilters) =>
    ["emergency-requests", filters] as const,
};

export function getEmergencyRequestId(request: EmergencyRequest) {
  return request.id ?? request._id ?? "";
}

export function useEmergencyRequests(filters: EmergencyRequestFilters = {}) {
  return useQuery({
    queryKey: emergencyRequestKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<EmergencyRequest[]>(
        "/emergency-requests",
        {
          params: filters,
        },
      );
      return data;
    },
  });
}

export function useDispatchEmergencyRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      payload,
    }: {
      requestId: string;
      payload: DispatchEmergencyRequestPayload;
    }) => {
      const { data } = await api.patch<EmergencyRequest>(
        `/emergency-requests/${requestId}/dispatch`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emergencyRequestKeys.all });
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
    },
  });
}

export function useUpdateEmergencyRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      payload,
    }: {
      requestId: string;
      payload: UpdateEmergencyRequestStatusPayload;
    }) => {
      const { data } = await api.patch<EmergencyRequest>(
        `/emergency-requests/${requestId}/status`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emergencyRequestKeys.all });
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
    },
  });
}

export function useCancelEmergencyRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      payload,
    }: {
      requestId: string;
      payload: CancelEmergencyRequestPayload;
    }) => {
      const { data } = await api.patch<EmergencyRequest>(
        `/emergency-requests/${requestId}/cancel`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emergencyRequestKeys.all });
    },
  });
}
