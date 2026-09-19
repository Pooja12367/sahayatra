"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CancelEmergencyRequestPayload,
  CreateEmergencyRequestPayload,
  EmergencyRequest,
} from "@/types/emergency-requests";

export const myRequestKeys = {
  all: ["my-requests"] as const,
  detail: (requestId: string) => ["my-requests", requestId] as const,
};

export function useMyRequests() {
  return useQuery({
    queryKey: myRequestKeys.all,
    queryFn: async () => {
      const { data } = await api.get<EmergencyRequest[]>("/my/requests");
      return data;
    },
  });
}

export function useMyRequest(requestId: string | null) {
  return useQuery({
    enabled: Boolean(requestId),
    queryKey: requestId ? myRequestKeys.detail(requestId) : ["my-requests", ""],
    queryFn: async () => {
      const { data } = await api.get<EmergencyRequest>(
        `/my/requests/${requestId}`,
      );
      return data;
    },
  });
}

export function useCreateEmergencyRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateEmergencyRequestPayload) => {
      const { data } = await api.post<EmergencyRequest>(
        "/emergency-requests",
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myRequestKeys.all });
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
    },
  });
}

export function useCancelMyRequest() {
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
        `/my/requests/${requestId}/cancel`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myRequestKeys.all });
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
    },
  });
}
