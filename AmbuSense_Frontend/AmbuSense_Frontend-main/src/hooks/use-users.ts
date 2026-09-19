"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AdminUser,
  CreateStaffUserResponse,
  PaginatedUsersResponse,
  StaffUserPayload,
  UpdateUserStatusPayload,
  UserFilters,
} from "@/types/users";

const userKeys = {
  all: ["users"] as const,
  list: (filters: UserFilters) => ["users", filters] as const,
};

export function getUserId(user: AdminUser) {
  return user.id ?? user._id ?? "";
}

export function useUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<PaginatedUsersResponse>("/users", {
        params: filters,
      });
      return data;
    },
  });
}

export function useCreateStaffUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: StaffUserPayload) => {
      const { data } = await api.post<CreateStaffUserResponse>(
        "/auth/staff",
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: string;
      payload: UpdateUserStatusPayload;
    }) => {
      const { data } = await api.patch<AdminUser>(
        `/users/${userId}/status`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete<{ message: string }>(
        `/users/${userId}`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
