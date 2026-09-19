import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AdminDriver,
  DriverFilters,
  PaginatedDriversResponse,
  VerifyDriverPayload,
} from "@/types/drivers";

const driverKeys = {
  all: ["drivers"] as const,
  list: (filters: DriverFilters) => ["drivers", filters] as const,
};

export function useDrivers(filters: DriverFilters = {}) {
  return useQuery({
    queryKey: driverKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<PaginatedDriversResponse>("/drivers", {
        params: filters,
      });
      return data;
    },
  });
}

export function useVerifyDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      driverId,
      payload,
    }: {
      driverId: string;
      payload: VerifyDriverPayload;
    }) => {
      const { data } = await api.patch<AdminDriver>(
        `/drivers/${driverId}/verify`,
        payload,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: driverKeys.all });
    },
  });
}

export function useDeleteDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (driverId: string) => {
      const { data } = await api.delete<{ message: string }>(
        `/drivers/${driverId}`,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: driverKeys.all });
    },
  });
}
